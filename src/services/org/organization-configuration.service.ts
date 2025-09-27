import { injectable, inject } from 'inversify';
import { getRepository, Repository } from 'typeorm';
import { Organization, RecognitionTokenMode } from '../../entities/org/organization.model.js';
import { validate } from 'class-validator';
import { ethers } from 'ethers';
import EthersAdapter from '@safe-global/safe-ethers-lib';
import Safe from '@safe-global/safe-core-sdk';

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
        this.orgRepository = getRepository(Organization);
    }

    /**
     * Updates the Safe configuration for a given organization.
     *
     * @param organizationId The ID of the organization to update.
     * @param config The new Safe configuration data.
     * @returns The updated organization.
     */
    public async updateSafeConfiguration(organizationId: string, config: SafeConfig): Promise<Organization> {
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
        const safeOwner = await EthersAdapter.create({
            ethers,
            signerOrProvider: provider,
        });

        // Validate Safe address by checking if it has owners (is a valid Safe)
        const safeSdk = await Safe.create({ ethAdapter: safeOwner, safeAddress: config.safeAddress });
        const owners = await safeSdk.getOwners();
        if (owners.length === 0) {
            throw new Error('Safe address is not a valid Gnosis Safe or has no owners');
        }

        // Validate stablecoin by checking for `decimals` function
        const stablecoinContract = new ethers.Contract(config.stablecoinAddress, ['function decimals() view returns (uint8)'], provider);
        try {
            const decimals = await stablecoinContract.decimals();
            if (decimals !== BigInt(config.stablecoinDecimals)) {
                throw new Error('Mismatch in stablecoin decimals');
            }
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
                'function balanceOf(address account) view returns (uint256)',
            ];
            const tokenContract = new ethers.Contract(config.recognitionTokenAddress, tokenAbi, provider);

            try {
                const decimals = await tokenContract.decimals();
                if (decimals !== BigInt(config.recognitionTokenDecimals)) {
                    throw new Error('Mismatch in recognition token decimals');
                }
            } catch (error) {
                throw new Error('Invalid recognition token contract or unable to fetch decimals');
            }

            if (organization.recognitionTokenMode === RecognitionTokenMode.MINT) {
                try {
                    const minterRole = await tokenContract.MINTER_ROLE();
                    const hasMinterRole = await tokenContract.hasRole(minterRole, organization.safeAddress);
                    if (!hasMinterRole) {
                        throw new Error('Safe address does not have the MINTER_ROLE on the recognition token contract');
                    }
                } catch (error) {
                    throw new Error('Could not verify MINTER_ROLE on the recognition token contract');
                }
            } else if (organization.recognitionTokenMode === RecognitionTokenMode.TRANSFER) {
                try {
                    const balance = await tokenContract.balanceOf(organization.safeAddress);
                    if (balance <= 0) {
                        throw new Error('Safe address has no balance of the recognition token');
                    }
                } catch (error) {
                    throw new Error('Could not verify the recognition token balance of the Safe address');
                }
            }
        }

        // Update organization fields
        organization.safeAddress = config.safeAddress;
        organization.safeChainId = config.safeChainId;
        organization.stablecoinAddress = config.stablecoinAddress;
        organization.stablecoinDecimals = config.stablecoinDecimals;
        organization.recognitionTokenAddress = config.recognitionTokenAddress;
        organization.recognitionTokenDecimals = config.recognitionTokenDecimals;
        organization.recognitionTokenMode = config.recognitionTokenMode;

        // Validate and save the updated entity
        const errors = await validate(organization);
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.toString()}`);
        }

        return this.orgRepository.save(organization);
    }

    /**
     * Returns the RPC URL for a given chain ID.
     *
     * @param chainId The chain ID.
     * @returns The RPC URL.
     */
    private getRpcUrl(chainId: number): string {
        // This should be expanded with more networks or moved to a config file
        switch (chainId) {
            case 42161: // Arbitrum One
                return 'https://arb1.arbitrum.io/rpc';
            default:
                throw new Error('Unsupported chain ID');
        }
    }
}