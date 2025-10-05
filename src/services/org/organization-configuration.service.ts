import { injectable } from 'inversify';
import { getRepository, Repository } from 'typeorm';
import { Organization, RecognitionTokenMode } from '../../entities/org/organization.model.js';
import { ethers } from 'ethers';
import { SafeConfigValidationResponse, ChainConfigDTO } from '../../validation/organization.validation.js';

/**
 * Defines the structure for the Safe configuration data.
 * Note: Decimals are fetched from contracts, not provided as input.
 */
export interface SafeConfig {
    safeAddress: string;
    safeChainId: number;
    stablecoinAddress: string;
    recognitionTokenAddress?: string;
    recognitionTokenMode: RecognitionTokenMode;
}

@injectable()
export class OrganizationConfigurationService {
    private orgRepository: Repository<Organization>;

    constructor() {
        this.orgRepository = getRepository(Organization);
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

        const provider = new ethers.JsonRpcProvider(this.getRpcUrl(config.safeChainId));

        // Validate Safe address by checking if it has owners using direct contract call
        const safeAbi = ['function getOwners() view returns (address[])'];
        const safeContract = new ethers.Contract(config.safeAddress, safeAbi, provider);
        try {
            const owners = await safeContract.getOwners();
            if (owners.length === 0) {
                throw new Error('Safe address is not a valid Gnosis Safe or has no owners');
            }
        } catch (error) {
            throw new Error('Safe address is not a valid deployed Safe contract');
        }

        // Fetch stablecoin decimals from contract
        const stablecoinContract = new ethers.Contract(config.stablecoinAddress, ['function decimals() view returns (uint8)'], provider);
        let stablecoinDecimals: number;
        try {
            const decimals = await stablecoinContract.decimals();
            stablecoinDecimals = Number(decimals);
        } catch (error) {
            throw new Error('Invalid stablecoin contract or unable to fetch decimals');
        }

        // If a recognition token is provided, fetch its decimals
        let recognitionTokenDecimals: number | undefined;
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

            try {
                const decimals = await tokenContract.decimals();
                recognitionTokenDecimals = Number(decimals);
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

        // Update organization fields with fetched decimals
        organization.safeAddress = config.safeAddress;
        organization.safeChainId = config.safeChainId;
        organization.stablecoinAddress = config.stablecoinAddress;
        organization.stablecoinDecimals = stablecoinDecimals;
        organization.recognitionTokenAddress = config.recognitionTokenAddress;
        organization.recognitionTokenDecimals = recognitionTokenDecimals;
        organization.recognitionTokenMode = config.recognitionTokenMode;

        return this.orgRepository.save(organization);
    }

    /**
     * Returns list of supported blockchain networks
     */
    public getSupportedChains(): ChainConfigDTO[] {
        return [
            {
                chainId: 1,
                name: 'Ethereum Mainnet',
                rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
                blockExplorerUrl: 'https://etherscan.io',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                isSupported: true
            },
            {
                chainId: 42161,
                name: 'Arbitrum One',
                rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
                blockExplorerUrl: 'https://arbiscan.io',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                isSupported: true
            },
            {
                chainId: 421614,
                name: 'Arbitrum Sepolia',
                rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
                blockExplorerUrl: 'https://sepolia.arbiscan.io',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                isSupported: true
            },
            {
                chainId: 42220,
                name: 'Celo Mainnet',
                rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
                blockExplorerUrl: 'https://explorer.celo.org',
                nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                isSupported: true
            },
            {
                chainId: 44787,
                name: 'Celo Alfajores Testnet',
                rpcUrl: process.env.CELO_ALFAJORES_RPC_URL || 'https://alfajores-forno.celo-testnet.org',
                blockExplorerUrl: 'https://alfajores.celoscan.io',
                nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                isSupported: true
            }
        ];
    }

    /**
     * Performs comprehensive validation of Safe configuration including blockchain checks
     */
    public async validateSafeConfig(config: any): Promise<SafeConfigValidationResponse> {
        const errors: string[] = [];
        const warnings: string[] = [];
        let safeInfo;
        let tokenInfo;

        try {
            // Validate Safe address
            if (!ethers.isAddress(config.safeAddress)) {
                errors.push('Invalid Safe address format');
                return { isValid: false, errors, warnings };
            }

            const provider = new ethers.JsonRpcProvider(this.getRpcUrl(config.safeChainId));

            // Validate Safe deployment by checking if it has code
            try {
                const code = await provider.getCode(config.safeAddress);
                if (code === '0x') {
                    errors.push('Safe address is not a deployed contract');
                    return { isValid: false, errors, warnings };
                }

                // Try to get Safe info using basic contract calls
                const safeAbi = [
                    'function getOwners() view returns (address[])',
                    'function getThreshold() view returns (uint256)',
                    'function VERSION() view returns (string)'
                ];
                const safeContract = new ethers.Contract(config.safeAddress, safeAbi, provider);

                try {
                    const owners = await safeContract.getOwners();
                    const threshold = await safeContract.getThreshold();
                    let version = '1.3.0';
                    try {
                        version = await safeContract.VERSION();
                    } catch {
                        // VERSION method might not exist in older Safe versions
                    }

                    if (owners.length === 0) {
                        errors.push('Safe address has no owners');
                    }

                    safeInfo = {
                        owners,
                        threshold: Number(threshold),
                        version
                    };
                } catch (error) {
                    warnings.push('Could not fetch Safe details, but address appears to be a contract');
                }
            } catch (error) {
                errors.push('Safe address is not a valid deployed Safe contract');
                return { isValid: false, errors, warnings };
            }

            // Validate stablecoin if provided
            if (config.stablecoinAddress) {
                if (!ethers.isAddress(config.stablecoinAddress)) {
                    errors.push('Invalid stablecoin address format');
                } else {
                    try {
                        const erc20Abi = [
                            'function decimals() view returns (uint8)',
                            'function symbol() view returns (string)',
                            'function name() view returns (string)',
                            'function balanceOf(address) view returns (uint256)'
                        ];
                        const tokenContract = new ethers.Contract(config.stablecoinAddress, erc20Abi, provider);
                        const decimals = await tokenContract.decimals();
                        const symbol = await tokenContract.symbol();
                        const name = await tokenContract.name();
                        const balance = await tokenContract.balanceOf(config.safeAddress);

                        tokenInfo = {
                            stablecoin: {
                                name,
                                symbol,
                                decimals: Number(decimals),
                                balance: ethers.formatUnits(balance, decimals)
                            }
                        };

                        if (balance === 0n) {
                            warnings.push('Safe has zero stablecoin balance');
                        }
                    } catch (error) {
                        errors.push('Stablecoin address is not a valid ERC20 token');
                    }
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                safeInfo,
                tokenInfo
            };
        } catch (error) {
            errors.push(error instanceof Error ? error.message : 'Unknown validation error');
            return { isValid: false, errors, warnings };
        }
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
        const chains = this.getSupportedChains();
        const chain = chains.find(c => c.chainId === chainId);
        if (!chain) {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }
        return chain.rpcUrl;
    }
}
