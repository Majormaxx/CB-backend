import { injectable } from 'inversify';
import { ethers } from 'ethers';
import { MetaTransactionData, OperationType } from '@safe-global/safe-core-sdk-types';
import { Organization } from '../../entities/index.js';

export interface SafeTransactionResult {
    safeTxHash: string;
    safeUrl: string;
}

export interface TransactionStatus {
    status: 'PENDING' | 'AWAITING_CONFIRMATIONS' | 'AWAITING_EXECUTION' | 'EXECUTED' | 'FAILED' | 'CANCELLED' | 'NOT_FOUND';
    confirmations: number;
    confirmationsRequired: number;
    isExecuted: boolean;
    transactionHash?: string;
}

@injectable()
export class SafeTransactionService {
    private apiKit: any | null = null;
    private protocolKit: any | null = null;

    /**
     * Initialize the Safe SDK instances for a specific organization
     */
    public async initialize(organization: Organization, signerPrivateKey?: string): Promise<void> {
        if (!organization.safeAddress || !organization.safeChainId) {
            throw new Error('Organization does not have Safe configured');
        }

        const chainId = BigInt(organization.safeChainId!);
        const rpcUrl = this.getRpcUrl(organization.safeChainId!);

        // Initialize API Kit for transaction service interaction
        const { default: SafeApiKit } = await import('@safe-global/api-kit');
        this.apiKit = new (SafeApiKit as any)({
            chainId,
            apiKey: process.env.SAFE_API_KEY
        });

        // Initialize Protocol Kit for transaction creation
        const { default: Safe } = await import('@safe-global/protocol-kit');
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // If signer private key provided, use it; otherwise use provider only (read-only mode)
        const signer = signerPrivateKey
            ? new ethers.Wallet(signerPrivateKey, provider)
            : undefined;

        this.protocolKit = await (Safe as any).init({
            provider: rpcUrl,
            signer: signer ? await signer.getAddress() : undefined,
            safeAddress: organization.safeAddress
        });
    }

    /**
     * Create a MultiSend transaction for batched token transfers
     */
    public async createMultiSendTransaction(
        recipients: Array<{ to: string; value: string; data?: string }>
    ): Promise<any> {
        if (!this.protocolKit) {
            throw new Error('Safe Protocol Kit not initialized');
        }

        const transactions: MetaTransactionData[] = recipients.map(recipient => ({
            to: recipient.to,
            value: recipient.value,
            data: recipient.data || '0x',
            operation: OperationType.Call
        }));

        return await this.protocolKit.createTransaction({
            transactions
        });
    }

    /**
     * Propose a transaction to the Safe Transaction Service
     */
    public async proposeTransaction(
        safeTransaction: any,
        senderAddress: string,
        organization: Organization
    ): Promise<SafeTransactionResult> {
        if (!this.protocolKit || !this.apiKit) {
            throw new Error('Safe SDK not initialized');
        }

        if (!organization.safeAddress) {
            throw new Error('Organization does not have Safe configured');
        }

        // Get transaction hash
        const safeTxHash = await this.protocolKit.getTransactionHash(safeTransaction);

        // Sign the transaction
        const senderSignature = await this.protocolKit.signHash(safeTxHash);

        // Propose to Safe Transaction Service
        await this.apiKit.proposeTransaction({
            safeAddress: organization.safeAddress,
            safeTransactionData: safeTransaction.data,
            safeTxHash,
            senderAddress,
            senderSignature: senderSignature.data
        });

        // Generate Safe URL
        const safeUrl = this.generateSafeUrl(organization.safeAddress!, organization.safeChainId!);

        return {
            safeTxHash,
            safeUrl
        };
    }

    /**
     * Get transaction status from Safe Transaction Service
     */
    public async getTransactionStatus(safeTxHash: string): Promise<TransactionStatus> {
        if (!this.apiKit) {
            throw new Error('Safe API Kit not initialized');
        }

        try {
            const transaction = await this.apiKit.getTransaction(safeTxHash);

            // Determine status based on transaction state
            let status: TransactionStatus['status'] = 'PENDING';

            if (transaction.isExecuted) {
                status = 'EXECUTED';
            } else if (transaction.confirmations && transaction.confirmations.length >= transaction.confirmationsRequired) {
                status = 'AWAITING_EXECUTION';
            } else if (transaction.confirmations && transaction.confirmations.length > 0) {
                status = 'AWAITING_CONFIRMATIONS';
            }

            return {
                status,
                confirmations: transaction.confirmations?.length || 0,
                confirmationsRequired: transaction.confirmationsRequired || 1,
                isExecuted: transaction.isExecuted || false,
                transactionHash: transaction.transactionHash || undefined
            };
        } catch (error: any) {
            if (error.message?.includes('not found') || error.response?.status === 404) {
                return {
                    status: 'NOT_FOUND',
                    confirmations: 0,
                    confirmationsRequired: 1,
                    isExecuted: false
                };
            }
            throw error;
        }
    }

    /**
     * Get RPC URL for a specific chain ID
     */
    private getRpcUrl(chainId: number): string {
        const rpcUrls: Record<number, string> = {
            1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
            11155111: process.env.ETHEREUM_SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
            42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
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
     * Generate Safe web interface URL for a transaction
     */
    private generateSafeUrl(safeAddress: string, chainId: number): string {
        const chainPrefixes: Record<number, string> = {
            1: 'eth',
            11155111: 'sep',
            42161: 'arb1',
            421614: 'arb-sep',
            42220: 'celo'
        };

        const prefix = chainPrefixes[chainId] || 'eth';
        return `https://app.safe.global/transactions/queue?safe=${prefix}:${safeAddress}`;
    }

    /**
     * Estimate gas for a MultiSend transaction
     */
    public async estimateTransactionGas(safeTransaction: any): Promise<bigint> {
        if (!this.protocolKit) {
            throw new Error('Safe Protocol Kit not initialized');
        }

        try {
            const gasEstimate = await this.protocolKit.estimateSafeTransactionGas(safeTransaction);
            return BigInt(gasEstimate);
        } catch (error) {
            throw new Error(`Failed to estimate gas: ${error}`);
        }
    }
}

