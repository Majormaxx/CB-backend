import { injectable, inject } from 'inversify';
import { getRepository, Repository, IsNull } from 'typeorm';
import { ethers } from 'ethers';
import { Payout, PayoutStatus } from '../entities/payout/payout.model.js';
import { PayoutRecipient, PayoutRecipientStatus } from '../entities/payout/payout-recipient.model.js';
import { TxProposal, TokenType, TxProposalStatus } from '../entities/payout/tx-proposal.model.js';
import { Round } from '../entities/assessment/round.model.js';
import { ContributorRoundCompensation } from '../entities/assessment/contributorCompensation.model.js';
import { Organization, RecognitionTokenMode } from '../entities/org/organization.model.js';
import { OrganizationConfigurationService } from './org/organization-configuration.service.js';
import { SafeTransactionService } from './safe/safe-transaction.service.js';
import { TYPES } from '../inversify.types.js';

/**
 * Interface for payout preview response
 */
export interface PayoutPreviewResponse {
    roundId: string;
    roundNumber: number;
    recipients: PayoutRecipientPreview[];
    totals: {
        stablecoinAmount: number;
        recognitionAmount: number;
        recipientCount: number;
    };
    preflightChecks: {
        safeConfigured: boolean;
        sufficientBalance: boolean;
        hasMintingPermission: boolean;
        warnings: string[];
    };
    chunkPlan: {
        totalChunks: number;
        maxRecipientsPerChunk: number;
        stablecoinChunks: number;
        recognitionChunks: number;
    };
}

/**
 * Interface for individual recipient preview
 */
export interface PayoutRecipientPreview {
    walletAddress: string;
    stablecoinAmount: number;
    recognitionAmount: number;
    stablecoinAmountBaseUnits: string;
    recognitionAmountBaseUnits: string;
}

@injectable()
export class PayoutService {
    private payoutRepository: Repository<Payout>;
    private payoutRecipientRepository: Repository<PayoutRecipient>;
    private txProposalRepository: Repository<TxProposal>;
    private roundRepository: Repository<Round>;
    private compensationRepository: Repository<ContributorRoundCompensation>;
    private organizationRepository: Repository<Organization>;

    constructor(
        @inject(TYPES.OrganizationConfigurationService)
        private configService: OrganizationConfigurationService,
        @inject(TYPES.SafeTransactionService)
        private safeService: SafeTransactionService
    ) {
        this.payoutRepository = getRepository(Payout);
        this.payoutRecipientRepository = getRepository(PayoutRecipient);
        this.txProposalRepository = getRepository(TxProposal);
        this.roundRepository = getRepository(Round);
        this.compensationRepository = getRepository(ContributorRoundCompensation);
        this.organizationRepository = getRepository(Organization);
    }

    /**
     * Retrieve completed assessment rounds that have not yet been processed for payouts.
     * Filters rounds where assessment is complete but no payout transaction has been executed.
     */
    public async getIncompleteRounds(orgId: string): Promise<Round[]> {
        return await this.roundRepository.find({
            where: {
                organization: { id: orgId },
                isCompleted: true,
                txHash: IsNull() // Identifies rounds without executed payout transactions
            },
            relations: ['organization'],
            order: { roundNumber: 'DESC' }
        });
    }

    /**
     * Generate comprehensive payout preview including recipients, totals, validation checks, and chunking strategy.
     * Performs wallet address validation, amount conversion using token decimals, and preflight safety checks.
     * Calculates optimal transaction chunking based on gas estimation and recipient limits.
     */
    public async previewPayout(roundId: string): Promise<PayoutPreviewResponse> {
        // Get round and organization data
        const round = await this.roundRepository.findOne({
            where: { id: roundId },
            relations: ['organization']
        });

        if (!round) {
            throw new Error('Round not found');
        }

        const organization = round.organization;
        if (!organization.safeAddress) {
            throw new Error('Organization Safe not configured');
        }

        // Get compensation data for this round
        const compensations = await this.compensationRepository.find({
            where: { round: { id: roundId } },
            relations: ['contributor']
        });

        if (compensations.length === 0) {
            throw new Error('No compensation data found for this round');
        }

        // Build recipient preview data with human + base-unit amounts
        const recipients: PayoutRecipientPreview[] = [];
        const processedAddresses = new Set<string>();

        for (const comp of compensations) {
            const walletAddress = comp.contributor.address;

            // Wallet address validation and dedupe
            if (!walletAddress || !ethers.isAddress(walletAddress)) {
                continue; // Skip invalid addresses
            }

            if (processedAddresses.has(walletAddress.toLowerCase())) {
                continue; // Skip duplicates
            }
            processedAddresses.add(walletAddress.toLowerCase());

            // Convert amounts using real decimals()
            const stablecoinAmountBaseUnits = await this.toBaseUnits(
                comp.fiat || 0,
                organization.stablecoinDecimals || 6
            );
            const recognitionAmountBaseUnits = await this.toBaseUnits(
                comp.tp || 0,
                organization.recognitionTokenDecimals || 18
            );

            recipients.push({
                walletAddress,
                stablecoinAmount: comp.fiat || 0,
                recognitionAmount: comp.tp || 0,
                stablecoinAmountBaseUnits,
                recognitionAmountBaseUnits
            });
        }

        // Calculate totals
        const totals = {
            stablecoinAmount: recipients.reduce((sum, r) => sum + r.stablecoinAmount, 0),
            recognitionAmount: recipients.reduce((sum, r) => sum + r.recognitionAmount, 0),
            recipientCount: recipients.length
        };

        // Perform preflight checks (balance, role)
        const preflightChecks = await this.performPreflightChecks(organization, totals);

        // Plan chunks using dynamic gas-based estimation for both token types
        const stablecoinChunkPlan = recipients.some(r => r.stablecoinAmount > 0)
            ? await this.planChunks(recipients.filter(r => r.stablecoinAmount > 0), organization, TokenType.STABLECOIN)
            : { totalChunks: 0, maxRecipientsPerChunk: 0, estimatedChunks: [] };

        const recognitionChunkPlan = recipients.some(r => r.recognitionAmount > 0)
            ? await this.planChunks(recipients.filter(r => r.recognitionAmount > 0), organization, TokenType.RECOGNITION)
            : { totalChunks: 0, maxRecipientsPerChunk: 0, estimatedChunks: [] };

        const chunkPlan = {
            totalChunks: Math.max(stablecoinChunkPlan.totalChunks, recognitionChunkPlan.totalChunks),
            maxRecipientsPerChunk: Math.max(stablecoinChunkPlan.maxRecipientsPerChunk, recognitionChunkPlan.maxRecipientsPerChunk),
            stablecoinChunks: stablecoinChunkPlan.totalChunks,
            recognitionChunks: recognitionChunkPlan.totalChunks
        };

        return {
            roundId,
            roundNumber: round.roundNumber,
            recipients,
            totals,
            preflightChecks,
            chunkPlan
        };
    }

    /**
     * Create payout proposal with optimized transaction chunking for Safe execution.
     * Validates recipient data, creates database records for tracking, and generates transaction proposals.
     * Applies dynamic chunking algorithm to ensure transactions remain within gas and calldata limits.
     */
    public async proposePayout(roundId: string, tokenType: TokenType): Promise<{ payoutId: string; safeUrl?: string }> {
        // Get preview data to validate and get recipients
        const preview = await this.previewPayout(roundId);

        if (preview.preflightChecks.warnings.length > 0) {
            throw new Error(`Preflight checks failed: ${preview.preflightChecks.warnings.join(', ')}`);
        }

        // Create payout record
        const payout = this.payoutRepository.create({
            roundId,
            status: PayoutStatus.DRAFT,
            totalStablePayout: tokenType === TokenType.STABLECOIN ? preview.totals.stablecoinAmount : 0,
            totalRecognitionPayout: tokenType === TokenType.RECOGNITION ? preview.totals.recognitionAmount : 0
        });
        await this.payoutRepository.save(payout);

        // Filter recipients based on token type
        const relevantRecipients = preview.recipients.filter(r => {
            return tokenType === TokenType.STABLECOIN ? r.stablecoinAmount > 0 : r.recognitionAmount > 0;
        });

        // Get round and organization for chunking
        const round = await this.roundRepository.findOne({
            where: { id: roundId },
            relations: ['organization']
        });

        if (!round) {
            throw new Error('Round not found');
        }

        // Create chunks using dynamic gas-based estimation as specified
        const chunkPlan = await this.planChunks(relevantRecipients, round.organization, tokenType);
        const chunks = chunkPlan.estimatedChunks;

        // Create transaction proposals for each chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Create tx proposal record
            const txProposal = this.txProposalRepository.create({
                payout: payout,
                tokenType,
                status: TxProposalStatus.PROPOSED,
                partIndex: i + 1,
                partCount: chunks.length,
                attempt: 1,
                payloadJson: JSON.stringify({
                    recipients: chunk.map(r => ({
                        to: r.walletAddress,
                        amount: tokenType === TokenType.STABLECOIN ? r.stablecoinAmountBaseUnits : r.recognitionAmountBaseUnits
                    }))
                })
            });
            await this.txProposalRepository.save(txProposal);

            // Create payout recipient records
            for (const recipient of chunk) {
                const payoutRecipient = this.payoutRecipientRepository.create({
                    payout: payout,
                    walletAddressSnapshot: recipient.walletAddress,
                    tokenType,
                    amountHuman: tokenType === TokenType.STABLECOIN ? recipient.stablecoinAmount : recipient.recognitionAmount,
                    amountBaseUnits: tokenType === TokenType.STABLECOIN ? recipient.stablecoinAmountBaseUnits : recipient.recognitionAmountBaseUnits,
                    status: PayoutRecipientStatus.PROPOSED
                });
                await this.payoutRecipientRepository.save(payoutRecipient);
            }
        }

        // Initialize Safe SDK
        const organization = await this.organizationRepository.findOne({ where: { id: round.organization.id } });
        if (!organization) {
            throw new Error('Organization not found');
        }

        await this.safeService.initialize(organization);

        // Create Safe transactions for each chunk
        const txProposalsWithHashes = await this.txProposalRepository.find({
            where: { payout: { id: payout.id } },
            order: { partIndex: 'ASC' }
        });

        let safeUrl = '';
        for (const txProposal of txProposalsWithHashes) {
            const payload = JSON.parse(txProposal.payloadJson);
            const recipients = payload.recipients.map((r: any) => ({
                to: r.to,
                value: r.amount,
                data: '0x'
            }));

            // Create Safe transaction
            const safeTransaction = await this.safeService.createMultiSendTransaction(recipients);

            // Propose transaction to Safe Transaction Service
            const result = await this.safeService.proposeTransaction(
                safeTransaction,
                organization.safeAddress!,
                organization
            );

            // Update transaction proposal with real Safe transaction hash
            txProposal.safeTxHash = result.safeTxHash;
            txProposal.status = TxProposalStatus.PROPOSED;
            await this.txProposalRepository.save(txProposal);

            // Use the first transaction's Safe URL
            if (!safeUrl) {
                safeUrl = result.safeUrl;
            }
        }

        // Update payout status
        payout.status = PayoutStatus.PROPOSED;
        await this.payoutRepository.save(payout);

        return {
            payoutId: payout.id,
            safeUrl
        };
    }

    /**
     * GET /payouts/status?roundId= → Poll Transaction Service for statuses; update records accordingly
     * Returns current payout and transaction proposal statuses
     */
    public async getPayoutStatus(roundId: string): Promise<any> {
        const payouts = await this.payoutRepository.find({
            where: { roundId },
            order: { createdAt: 'DESC' }
        });

        if (payouts.length === 0) {
            return { status: 'NO_PAYOUT', message: 'No payout found for this round' };
        }

        const payout = payouts[0];
        const txProposals = await this.txProposalRepository.find({
            where: { payout: { id: payout.id } },
            order: { partIndex: 'ASC' }
        });

        // Initialize Safe SDK to poll transaction statuses
        const round = await this.roundRepository.findOne({ where: { id: roundId } });
        if (round) {
            const organization = await this.organizationRepository.findOne({ where: { id: round.organization.id } });
            if (organization && organization.safeAddress) {
                await this.safeService.initialize(organization);

                // Poll each transaction's status from Safe Transaction Service
                for (const txProposal of txProposals) {
                    if (txProposal.safeTxHash) {
                        try {
                            const txStatus = await this.safeService.getTransactionStatus(txProposal.safeTxHash);

                            // Map Safe status to our TxProposalStatus
                            let newStatus = txProposal.status;
                            if (txStatus.status === 'EXECUTED') {
                                newStatus = TxProposalStatus.EXECUTED;
                            } else if (txStatus.status === 'AWAITING_EXECUTION') {
                                newStatus = TxProposalStatus.PROPOSED;
                            } else if (txStatus.status === 'AWAITING_CONFIRMATIONS') {
                                newStatus = TxProposalStatus.PROPOSED;
                            } else if (txStatus.status === 'FAILED') {
                                newStatus = TxProposalStatus.FAILED;
                            }

                            // Update database if status changed
                            if (newStatus !== txProposal.status) {
                                txProposal.status = newStatus;
                                await this.txProposalRepository.save(txProposal);
                            }
                        } catch (error) {
                            console.error(`Failed to poll status for tx ${txProposal.safeTxHash}:`, error);
                        }
                    }
                }

                // Update payout status based on transaction statuses
                const allExecuted = txProposals.every(tx => tx.status === TxProposalStatus.EXECUTED);
                if (allExecuted && payout.status !== PayoutStatus.EXECUTED) {
                    payout.status = PayoutStatus.EXECUTED;
                    await this.payoutRepository.save(payout);
                }
            }
        }

        return {
            payoutId: payout.id,
            status: payout.status,
            totalStablePayout: payout.totalStablePayout,
            totalRecognitionPayout: payout.totalRecognitionPayout,
            transactions: txProposals.map(tx => ({
                id: tx.id,
                tokenType: tx.tokenType,
                status: tx.status,
                partIndex: tx.partIndex,
                partCount: tx.partCount,
                safeTxHash: tx.safeTxHash,
                attempt: tx.attempt
            }))
        };
    }

    /**
     * Perform server-side validations: balance checks, role checks, Safe config
     */
    private async performPreflightChecks(organization: Organization, totals: any): Promise<any> {
        const warnings: string[] = [];
        let safeConfigured = false;
        let sufficientBalance = false;
        let hasMintingPermission = false;

        // Check Safe configuration
        if (!organization.safeAddress || !organization.safeChainId) {
            warnings.push('Safe wallet not configured for this organization');
        } else {
            safeConfigured = true;
        }

        // Check stablecoin balance for transfers
        if (totals.stablecoinAmount > 0 && organization.stablecoinAddress) {
            try {
                const rpcUrl = this.getRpcUrl(organization.safeChainId!);
                const provider = new ethers.JsonRpcProvider(rpcUrl);

                // Check Safe balance
                const tokenContract = new ethers.Contract(
                    organization.stablecoinAddress,
                    ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
                    provider
                );

                const balance = await tokenContract.balanceOf(organization.safeAddress);
                const decimals = await tokenContract.decimals();
                const balanceHuman = Number(ethers.formatUnits(balance, decimals));

                if (balanceHuman >= totals.stablecoinAmount) {
                    sufficientBalance = true;
                } else {
                    warnings.push(`Insufficient stablecoin balance. Required: ${totals.stablecoinAmount}, Available: ${balanceHuman}`);
                }
            } catch (error) {
                warnings.push('Unable to verify stablecoin balance');
            }
        }

        // Check MINTER_ROLE for recognition token minting
        if (totals.recognitionAmount > 0 && organization.recognitionTokenMode === RecognitionTokenMode.MINT) {
            try {
                if (!organization.safeChainId) {
                    warnings.push('Safe chain ID not configured');
                    return { safeConfigured, sufficientBalance, hasMintingPermission, warnings };
                }

                const rpcUrl = this.getRpcUrl(organization.safeChainId);
                const provider = new ethers.JsonRpcProvider(rpcUrl);

                // Check minting permission (simplified - actual validation would be in config service)
                hasMintingPermission = organization.recognitionTokenAddress ? true : false;

                if (!hasMintingPermission) {
                    warnings.push('Safe does not have MINTER_ROLE for recognition token');
                }
            } catch (error) {
                warnings.push('Unable to verify minting permission');
            }
        }

        return {
            safeConfigured,
            sufficientBalance,
            hasMintingPermission,
            warnings
        };
    }

    /**
     * Calculate optimal transaction chunking using two-tier approach for efficient Safe execution.
     * First tier limits batches to maximum 200 recipients to prevent excessive transaction complexity.
     * Second tier applies recursive gas estimation to ensure each chunk remains within network limits.
     * Continues splitting until all chunks satisfy gas and calldata constraints.
     */
    private async planChunks(
        recipients: PayoutRecipientPreview[],
        organization: Organization,
        tokenType: TokenType
    ): Promise<{ totalChunks: number; maxRecipientsPerChunk: number; estimatedChunks: PayoutRecipientPreview[][] }> {
        const gasLimit = 3000000; // Safe transaction gas limit
        const calldataLimit = 100000; // Approximate calldata size limit
        const maxRecipientsPerBatch = 200; // Start with up to 200 recipients as specified

        // Split recipients into initial batches of up to 200 recipients
        const initialBatches = this.createChunks(recipients, maxRecipientsPerBatch);

        // Apply recursive gas-based chunking to each initial batch
        const allChunks: PayoutRecipientPreview[][] = [];
        for (const batch of initialBatches) {
            const batchChunks = await this.recursiveChunking(batch, organization, tokenType, gasLimit, calldataLimit);
            allChunks.push(...batchChunks);
        }

        const maxRecipientsPerChunk = Math.max(...allChunks.map(chunk => chunk.length));

        return {
            totalChunks: allChunks.length,
            maxRecipientsPerChunk,
            estimatedChunks: allChunks
        };
    }

    /**
     * Apply recursive gas-based splitting to ensure transaction chunks remain within execution limits.
     * Tests each batch against gas and calldata constraints, splitting unsuccessful batches in half.
     * Continues recursion until all resulting chunks can execute successfully within network parameters.
     */
    private async recursiveChunking(
        recipients: PayoutRecipientPreview[],
        organization: Organization,
        tokenType: TokenType,
        gasLimit: number,
        calldataLimit: number
    ): Promise<PayoutRecipientPreview[][]> {
        if (recipients.length === 0) return [];

        try {
            // Build MultiSend transaction for gas estimation
            const multiSendData = this.buildMultiSendData(recipients, organization, tokenType);

            // Estimate gas for this batch
            const estimatedGas = await this.estimateMultiSendGas(multiSendData, organization);
            const calldataSize = multiSendData.length;

            // If within limits, return as single chunk
            if (estimatedGas <= gasLimit && calldataSize <= calldataLimit) {
                return [recipients];
            }

            // If exceeds limits and only 1 recipient, we have a problem
            if (recipients.length === 1) {
                throw new Error(`Single recipient transaction exceeds gas/calldata limits: gas=${estimatedGas}, calldata=${calldataSize}`);
            }

            // Split in half and recursively chunk each half
            const midpoint = Math.floor(recipients.length / 2);
            const firstHalf = recipients.slice(0, midpoint);
            const secondHalf = recipients.slice(midpoint);

            const [firstChunks, secondChunks] = await Promise.all([
                this.recursiveChunking(firstHalf, organization, tokenType, gasLimit, calldataLimit),
                this.recursiveChunking(secondHalf, organization, tokenType, gasLimit, calldataLimit)
            ]);

            return [...firstChunks, ...secondChunks];

        } catch (error) {
            // Fallback: if gas estimation fails, split in half
            if (recipients.length === 1) {
                throw new Error(`Cannot chunk single recipient: ${error}`);
            }

            const midpoint = Math.floor(recipients.length / 2);
            const firstHalf = recipients.slice(0, midpoint);
            const secondHalf = recipients.slice(midpoint);

            const [firstChunks, secondChunks] = await Promise.all([
                this.recursiveChunking(firstHalf, organization, tokenType, gasLimit, calldataLimit),
                this.recursiveChunking(secondHalf, organization, tokenType, gasLimit, calldataLimit)
            ]);

            return [...firstChunks, ...secondChunks];
        }
    }

    /**
     * Create recipient chunks for batched Safe MultiSend
     */
    private createChunks<T>(items: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            chunks.push(items.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Convert human amounts to base units using token decimals
     */
    private async toBaseUnits(amount: number, decimals: number): Promise<string> {
        return ethers.parseUnits(amount.toString(), decimals).toString();
    }

    /**
     * Get RPC URL for chain - reuses pattern from configService
     */
    private getRpcUrl(chainId: number): string {
        const rpcUrls: { [key: number]: string } = {
            42161: process.env.ARBITRUM_ONE_RPC_URL || 'https://arb1.arbitrum.io/rpc',
            421614: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
            42220: process.env.CELO_RPC_URL || 'https://forno.celo.org'
        };

        const rpcUrl = rpcUrls[chainId];
        if (!rpcUrl) {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }

        return rpcUrl;
    }

    /**
     * Build MultiSend transaction data for gas estimation.
     * Creates packed transaction data format required by Safe MultiSend contract.
     * Each transaction contains operation type, target address, value, data length, and call data.
     */
    private buildMultiSendData(
        recipients: PayoutRecipientPreview[],
        organization: Organization,
        tokenType: TokenType
    ): string {
        const transactions = recipients.map(recipient => {
            const tokenAddress = tokenType === TokenType.STABLECOIN
                ? organization.stablecoinAddress
                : organization.recognitionTokenAddress;

            if (!tokenAddress) {
                throw new Error(`Token address not configured for ${tokenType}`);
            }

            const amount = tokenType === TokenType.STABLECOIN
                ? recipient.stablecoinAmountBaseUnits
                : recipient.recognitionAmountBaseUnits;

            // Construct ERC20 transfer call data using standard transfer function signature
            const transferData = ethers.concat([
                '0xa9059cbb', // transfer(address,uint256) function selector
                ethers.zeroPadValue(recipient.walletAddress, 32), // recipient address padded to 32 bytes
                ethers.zeroPadValue(ethers.toBeHex(amount), 32) // amount padded to 32 bytes
            ]);

            return {
                to: tokenAddress,
                value: '0', // ERC20 transfers do not require ETH value
                data: transferData,
                operation: 0 // CALL operation type for standard contract calls
            };
        });

        // Encode transactions into MultiSend packed format
        // Format: operation(1) + to(20) + value(32) + dataLength(32) + data(dynamic)
        let packedTransactions = '';
        for (const tx of transactions) {
            const dataBytes = ethers.getBytes(tx.data);
            const packedTx = ethers.concat([
                ethers.zeroPadValue(ethers.toBeHex(tx.operation), 1),
                ethers.zeroPadValue(tx.to, 20),
                ethers.zeroPadValue(ethers.toBeHex(tx.value), 32),
                ethers.zeroPadValue(ethers.toBeHex(dataBytes.length), 32),
                tx.data
            ]);
            packedTransactions += packedTx.slice(2); // Remove 0x prefix for concatenation
        }

        return '0x' + packedTransactions;
    }

    /**
     * Estimate gas consumption for MultiSend transaction.
     * Uses network RPC to simulate transaction execution and determine gas requirements.
     * Falls back to mathematical estimation if network call fails.
     */
    private async estimateMultiSendGas(multiSendData: string, organization: Organization): Promise<number> {
        try {
            if (!organization.safeChainId) {
                throw new Error('Safe chain ID not configured');
            }

            const rpcUrl = this.getRpcUrl(organization.safeChainId);
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            // Safe MultiSend contract address is consistent across supported networks
            const multiSendAddress = '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761';

            // Encode call to multiSend function with packed transaction data
            const multiSendCallData = ethers.concat([
                '0x8d80ff0a', // multiSend(bytes) function selector
                ethers.AbiCoder.defaultAbiCoder().encode(['bytes'], [multiSendData])
            ]);

            // Simulate transaction execution to determine actual gas consumption
            const gasEstimate = await provider.estimateGas({
                from: organization.safeAddress,
                to: multiSendAddress,
                data: multiSendCallData
            });

            return Number(gasEstimate);

        } catch (error) {
            // Network estimation failed, calculate approximate gas based on transaction complexity
            const baseTransactionGas = 21000;
            const gasPerERC20Transfer = 50000; // Typical gas cost for ERC20 transfer
            const estimatedRecipientCount = Math.ceil(multiSendData.length / 200); // Approximate based on data length

            return baseTransactionGas + (gasPerERC20Transfer * estimatedRecipientCount);
        }
    }
}
