import { injectable, inject } from 'inversify';
import { Repository } from 'typeorm';
import { Organization, RecognitionTokenMode } from '../../entities/org/organization.model.js';
import { validate } from 'class-validator';
import { ethers } from 'ethers';
import { AppDataSource } from '../../data-source.js';

/**
 * Defines the structure for the Safe configuration data.
 */
export interface SafeConfig {
    safeAddress: string;
    safeChainId: number;
    stablecoinAddress: string;
    stablecoinDecimals: number;
    recognitionTokenAddress?: string;
    recognitionTokenDecimals?: number;
    recognitionTokenMode: RecognitionTokenMode;
}

@injectable()
export class OrganizationConfigurationService {
    private orgRepository: Repository<Organization>;

    constructor() {
        this.orgRepository = AppDataSource.getRepository(Organization);
    }

    /**
     * Returns the list of supported blockchain networks.
     * @returns Array of supported chain configurations
     */
    public getSupportedChains(): Array<{ chainId: number; name: string; rpcUrl: string }> {
        return [
            {
                chainId: 1,
                name: 'Ethereum Mainnet',
                rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com'
            },
            {
                chainId: 42161,
                name: 'Arbitrum One',
                rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
            },
            {
                chainId: 421614,
                name: 'Arbitrum Sepolia',
                rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'
            },
            {
                chainId: 42220,
                name: 'Celo Mainnet',
                rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org'
            },
            {
                chainId: 44787,
                name: 'Celo Alfajores',
                rpcUrl: process.env.CELO_ALFAJORES_RPC_URL || 'https://alfajores-forno.celo-testnet.org'
            }
        ];
    }

    /**
     * Validates Safe configuration without saving to database.
     * @param config The Safe configuration to validate
     * @returns Validation result with errors, warnings, and metadata
     */
    public async validateSafeConfig(config: SafeConfig): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        safeInfo?: {
            owners: string[];
            threshold: number;
        };
        tokenInfo?: {
            stablecoin: {
                name?: string;
                symbol?: string;
                decimals: number;
            };
            recognition?: {
                name?: string;
                symbol?: string;
                decimals: number;
                balance?: string;
                hasMintingRole?: boolean;
            };
        };
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];
        let safeInfo: any = undefined;
        let tokenInfo: any = undefined;

        // Validate Safe address format
        if (!ethers.isAddress(config.safeAddress)) {
            errors.push('Invalid Safe address format');
            return { isValid: false, errors, warnings };
        }

        // Validate stablecoin address format
        if (!ethers.isAddress(config.stablecoinAddress)) {
            errors.push('Invalid stablecoin address format');
            return { isValid: false, errors, warnings };
        }

        try {
            const provider = new ethers.JsonRpcProvider(this.getRpcUrl(config.safeChainId));

            // Validate Safe address by checking if it has owners
            const { default: Safe } = await import('@safe-global/protocol-kit');
            const safeSdk = await (Safe as any).init({
                provider: this.getRpcUrl(config.safeChainId),
                safeAddress: config.safeAddress
            });
            const owners = await safeSdk.getOwners();
            const threshold = await safeSdk.getThreshold();

            if (owners.length === 0) {
                errors.push('Safe address is not a valid Gnosis Safe or has no owners');
            } else {
                safeInfo = {
                    owners,
                    threshold
                };
            }

            // Validate stablecoin contract and decimals
            const stablecoinAbi = [
                'function decimals() view returns (uint8)',
                'function name() view returns (string)',
                'function symbol() view returns (string)'
            ];
            const stablecoinContract = new ethers.Contract(config.stablecoinAddress, stablecoinAbi, provider);
            try {
                const decimals = await stablecoinContract.decimals();
                const name = await stablecoinContract.name().catch(() => undefined);
                const symbol = await stablecoinContract.symbol().catch(() => undefined);

                tokenInfo = {
                    stablecoin: {
                        name,
                        symbol,
                        decimals: Number(decimals)
                    }
                };

                if (decimals !== BigInt(config.stablecoinDecimals)) {
                    errors.push(`Stablecoin decimals mismatch: expected ${config.stablecoinDecimals}, got ${decimals}`);
                }
            } catch (error) {
                errors.push('Invalid stablecoin contract or unable to fetch decimals');
            }

            // Validate recognition token if provided
            if (config.recognitionTokenMode !== RecognitionTokenMode.NONE && config.recognitionTokenAddress) {
                if (!ethers.isAddress(config.recognitionTokenAddress)) {
                    errors.push('Invalid recognition token address format');
                } else {
                    const tokenAbi = [
                        'function decimals() view returns (uint8)',
                        'function name() view returns (string)',
                        'function symbol() view returns (string)',
                        'function MINTER_ROLE() view returns (bytes32)',
                        'function hasRole(bytes32 role, address account) view returns (bool)',
                        'function balanceOf(address account) view returns (uint256)'
                    ];
                    const tokenContract = new ethers.Contract(config.recognitionTokenAddress, tokenAbi, provider);

                    try {
                        const decimals = await tokenContract.decimals();
                        const name = await tokenContract.name().catch(() => undefined);
                        const symbol = await tokenContract.symbol().catch(() => undefined);

                        if (config.recognitionTokenDecimals !== undefined
                            && decimals !== BigInt(config.recognitionTokenDecimals)) {
                            errors.push(`Recognition token decimals mismatch: expected ${config.recognitionTokenDecimals}, got ${decimals}`);
                        }

                        if (!tokenInfo) { tokenInfo = { stablecoin: { decimals: config.stablecoinDecimals } }; }
                        tokenInfo.recognition = {
                            name,
                            symbol,
                            decimals: Number(decimals)
                        };
                    } catch (error) {
                        errors.push('Invalid recognition token contract or unable to fetch decimals');
                    }

                    // Check minting permission for MINT mode
                    if (config.recognitionTokenMode === RecognitionTokenMode.MINT) {
                        const hasMintingPermission = await this.validateMintingPermission(
                            config.safeAddress,
                            config.recognitionTokenAddress,
                            provider
                        );
                        if (tokenInfo?.recognition) {
                            tokenInfo.recognition.hasMintingRole = hasMintingPermission;
                        }
                        if (!hasMintingPermission) {
                            errors.push(
                                `Safe address does not have minting permission on the recognition token. ` +
                                'The Safe must have MINTER_ROLE, ADMIN_ROLE, or be the contract owner.'
                            );
                        }
                    }

                    // Check balance for TRANSFER mode
                    if (config.recognitionTokenMode === RecognitionTokenMode.TRANSFER) {
                        try {
                            const balance = await tokenContract.balanceOf(config.safeAddress);
                            if (tokenInfo?.recognition) {
                                tokenInfo.recognition.balance = balance.toString();
                            }
                            if (balance <= 0) {
                                warnings.push('Safe address has no balance of the recognition token');
                            }
                        } catch (error) {
                            errors.push('Could not verify the recognition token balance of the Safe address');
                        }
                    }
                }
            }
        } catch (error) {
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            safeInfo,
            tokenInfo
        };
    }

    /**
     * Updates the Safe configuration for a given organization.
     *
     * @param organizationId The ID of the organization to update.
     * @param config The new Safe configuration data.
     * @returns The updated organization.
     */
    public async updateSafeConfig(organizationId: string, config: SafeConfig): Promise<Organization> {
        const organization = await this.orgRepository.findOne({ where: { id: organizationId } });
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Basic validation
        if (!ethers.isAddress(config.safeAddress)) {
            throw new Error('Invalid Safe address');
        }

        if (!ethers.isAddress(config.stablecoinAddress)) {
            throw new Error('Invalid stablecoin address');
        }

        // Validate Safe address by checking if it has owners (is a valid Safe)
        const provider = new ethers.JsonRpcProvider(this.getRpcUrl(config.safeChainId));
        const { default: Safe } = await import('@safe-global/protocol-kit');
        const safeSdk = await (Safe as any).init({
            provider: this.getRpcUrl(config.safeChainId),
            safeAddress: config.safeAddress
        });
        const owners = await safeSdk.getOwners();
        if (owners.length === 0) {
            throw new Error('Safe address is not a valid Gnosis Safe or has no owners');
        }

        // Fetch stablecoin decimals from chain (do not trust input)
        const stablecoinContract = new ethers.Contract(
            config.stablecoinAddress,
            ['function decimals() view returns (uint8)'],
            provider
        );
        let stablecoinDecimalsOnChain: number;
        try {
            const decimals = await stablecoinContract.decimals();
            stablecoinDecimalsOnChain = Number(decimals);
        } catch (error) {
            throw new Error('Invalid stablecoin contract or unable to fetch decimals');
        }

        // If a recognition token is provided, validate it
        if (config.recognitionTokenMode !== RecognitionTokenMode.NONE && config.recognitionTokenAddress) {
            if (!ethers.isAddress(config.recognitionTokenAddress)) {
                throw new Error('Invalid recognition token address');
            }

            const tokenAbi = [
                'function decimals() view returns (uint8)',
                'function MINTER_ROLE() view returns (bytes32)',
                'function hasRole(bytes32 role, address account) view returns (bool)',
                'function balanceOf(address account) view returns (uint256)'
            ];
            const tokenContract = new ethers.Contract(config.recognitionTokenAddress, tokenAbi, provider);

            // Fetch recognition token decimals from chain if provided (do not trust input)
            let recognitionTokenDecimalsOnChain: number | undefined = undefined;
            try {
                const decimals = await tokenContract.decimals();
                recognitionTokenDecimalsOnChain = Number(decimals);
            } catch (error) {
                throw new Error('Invalid recognition token contract or unable to fetch decimals');
            }

            if (config.recognitionTokenMode === RecognitionTokenMode.MINT) {
                const hasMintingPermission = await this.validateMintingPermission(
                    config.safeAddress,
                    config.recognitionTokenAddress,
                    provider
                );
                if (!hasMintingPermission) {
                    throw new Error(
                        `Safe address ${config.safeAddress} does not have minting permission on the recognition token contract ${config.recognitionTokenAddress}. ` +
                        'The Safe must have either MINTER_ROLE, ADMIN_ROLE, or be the contract owner to mint tokens.'
                    );
                }
            } else if (config.recognitionTokenMode === RecognitionTokenMode.TRANSFER) {
                try {
                    const balance = await tokenContract.balanceOf(config.safeAddress);
                    if (balance <= 0) {
                        throw new Error('Safe address has no balance of the recognition token');
                    }
                } catch (error) {
                    throw new Error('Could not verify the recognition token balance of the Safe address');
                }
            }
        }

        // Update organization fields (persist fetched decimals)
        organization.safeAddress = config.safeAddress;
        organization.safeChainId = config.safeChainId;
        organization.stablecoinAddress = config.stablecoinAddress;
        organization.stablecoinDecimals = stablecoinDecimalsOnChain;
        organization.recognitionTokenAddress = config.recognitionTokenAddress;
        // If recognition token is configured, use fetched on-chain decimals; otherwise leave null
        organization.recognitionTokenDecimals = typeof (organization.recognitionTokenAddress) === 'string'
            ? (await (async () => {
                try {
                    const tokenAbi = ['function decimals() view returns (uint8)'];
                    const tokenContract2 = new ethers.Contract(organization.recognitionTokenAddress!, tokenAbi, provider);
                    const d = await tokenContract2.decimals();
                    return Number(d);
                } catch {
                    return config.recognitionTokenDecimals ?? null as any;
                }
            })())
            : null as any;
        organization.recognitionTokenMode = config.recognitionTokenMode;

        // Validate and save the updated entity
        const errors = await validate(organization);
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.toString()}`);
        }

        return this.orgRepository.save(organization);
    }

    /**
     * Validates minting permission for TeamPoints or other ERC20 tokens with role-based access.
     * Supports both MINTER_ROLE (standard) and ADMIN_ROLE (TeamPoints) patterns.
     *
     * @param safeAddress The Safe address to check permissions for
     * @param tokenAddress The token contract address
     * @param provider The ethers provider
     * @returns Promise<boolean> indicating if the Safe has minting permission
     */
    private async validateMintingPermission(
        safeAddress: string,
        tokenAddress: string,
        provider: ethers.JsonRpcProvider
    ): Promise<boolean> {
        // Extended ABI to support both MINTER_ROLE and ADMIN_ROLE patterns
        const extendedTokenAbi = [
            'function decimals() view returns (uint8)',
            'function MINTER_ROLE() view returns (bytes32)',
            'function ADMIN_ROLE() view returns (bytes32)',
            'function hasRole(bytes32 role, address account) view returns (bool)',
            'function balanceOf(address account) view returns (uint256)',
            'function name() view returns (string)',
            'function symbol() view returns (string)'
        ];

        const tokenContract = new ethers.Contract(tokenAddress, extendedTokenAbi, provider);

        try {
            // First, try to check for MINTER_ROLE (standard ERC20 with AccessControl)
            try {
                const minterRole = await tokenContract.MINTER_ROLE();
                const hasMinterRole = await tokenContract.hasRole(minterRole, safeAddress);
                if (hasMinterRole) {
                    console.log(`Safe ${safeAddress} has MINTER_ROLE on token ${tokenAddress}`);
                    return true;
                }
            } catch (minterRoleError) {
                // MINTER_ROLE not found, continue to check ADMIN_ROLE
                console.log(`MINTER_ROLE not found on token ${tokenAddress}, checking ADMIN_ROLE`);
            }

            // Check for ADMIN_ROLE (TeamPoints pattern)
            try {
                const adminRole = await tokenContract.ADMIN_ROLE();
                const hasAdminRole = await tokenContract.hasRole(adminRole, safeAddress);
                if (hasAdminRole) {
                    console.log(`Safe ${safeAddress} has ADMIN_ROLE on token ${tokenAddress}`);
                    return true;
                }
            } catch (adminRoleError) {
                // ADMIN_ROLE not found either
                console.log(`ADMIN_ROLE not found on token ${tokenAddress}, checking owner pattern`);
            }

            // If neither role is found, check if it's a standard ERC20 with owner pattern
            try {
                const ownerAbi = ['function owner() view returns (address)'];
                const ownerContract = new ethers.Contract(tokenAddress, ownerAbi, provider);
                const owner = await ownerContract.owner();
                if (owner.toLowerCase() === safeAddress.toLowerCase()) {
                    console.log(`Safe ${safeAddress} is owner of token ${tokenAddress}`);
                    return true;
                }
            } catch (ownerError) {
                // Owner pattern not found either
                console.log(`Owner pattern not found on token ${tokenAddress}`);
            }

            console.log(`Safe ${safeAddress} has no minting permission on token ${tokenAddress}`);
            return false;
        } catch (error) {
            console.error('Error validating minting permission:', error);
            return false;
        }
    }

    /**
     * Returns the RPC URL for a given chain ID.
     *
     * @param chainId The chain ID.
     * @returns The RPC URL.
     */
    private getRpcUrl(chainId: number): string {
        const rpcUrls: Record<number, string> = {
            1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
            11155111: process.env.ETHEREUM_SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
            42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
            421614: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
            42220: process.env.CELO_RPC_URL || 'https://forno.celo.org',
            44787: process.env.CELO_ALFAJORES_RPC_URL || 'https://alfajores-forno.celo-testnet.org'
        };
        const url = rpcUrls[chainId];
        if (!url) {
            throw new Error('Unsupported chain ID');
        }
        return url;
    }
}
