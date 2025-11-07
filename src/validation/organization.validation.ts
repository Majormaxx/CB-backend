import Joi from 'joi';
import { RecognitionTokenMode } from '../entities/org/organization.model.js';

/**
 * Supported blockchain networks for Safe wallet deployment
 */
export const SUPPORTED_CHAINS = [
    1,        // Ethereum Mainnet
    42161,    // Arbitrum One
    421614,   // Arbitrum Sepolia
    42220,    // Celo Mainnet
    44787     // Celo Alfajores Testnet
] as const;

/**
 * Ethereum address validation pattern
 */
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validation schema for updating Safe configuration
 * Allows partial updates with at least one field required
 */
export const updateSafeConfigSchema = Joi.object({
    safeAddress: Joi.string()
        .pattern(ETH_ADDRESS_REGEX)
        .optional()
        .messages({
            'string.pattern.base': 'Safe address must be a valid Ethereum address'
        }),

    safeChainId: Joi.number()
        .integer()
        .valid(...SUPPORTED_CHAINS)
        .optional()
        .messages({
            'any.only': `Chain ID must be one of: ${SUPPORTED_CHAINS.join(', ')}`
        }),

    stablecoinAddress: Joi.string()
        .pattern(ETH_ADDRESS_REGEX)
        .optional()
        .messages({
            'string.pattern.base': 'Stablecoin address must be a valid Ethereum address'
        }),

    recognitionTokenMode: Joi.string()
        .valid(...Object.values(RecognitionTokenMode))
        .optional()
        .messages({
            'any.only': `Recognition token mode must be one of: ${Object.values(RecognitionTokenMode).join(', ')}`
        }),

    recognitionTokenAddress: Joi.string()
        .pattern(ETH_ADDRESS_REGEX)
        .optional()
        .allow(null)
        .messages({
            'string.pattern.base': 'Recognition token address must be a valid Ethereum address'
        })
}).min(1).messages({
    'object.min': 'At least one configuration field must be provided'
});

/**
 * Validation schema for complete Safe configuration validation
 * Requires all essential fields for Safe operation
 */
export const validateSafeConfigSchema = Joi.object({
    safeAddress: Joi.string()
        .pattern(ETH_ADDRESS_REGEX)
        .required()
        .messages({
            'string.pattern.base': 'Safe address must be a valid Ethereum address',
            'any.required': 'Safe address is required'
        }),

    safeChainId: Joi.number()
        .integer()
        .valid(...SUPPORTED_CHAINS)
        .required()
        .messages({
            'any.only': `Chain ID must be one of: ${SUPPORTED_CHAINS.join(', ')}`,
            'any.required': 'Chain ID is required'
        }),

    stablecoinAddress: Joi.string()
        .pattern(ETH_ADDRESS_REGEX)
        .optional()
        .messages({
            'string.pattern.base': 'Stablecoin address must be a valid Ethereum address'
        }),

    recognitionTokenMode: Joi.string()
        .valid(...Object.values(RecognitionTokenMode))
        .optional()
        .messages({
            'any.only': `Recognition token mode must be one of: ${Object.values(RecognitionTokenMode).join(', ')}`
        }),

    recognitionTokenAddress: Joi.string()
        .pattern(ETH_ADDRESS_REGEX)
        .optional()
        .allow(null)
        .messages({
            'string.pattern.base': 'Recognition token address must be a valid Ethereum address'
        })
});

/**
 * TypeScript interface for Safe configuration update data
 */
export interface UpdateSafeConfigDTO {
    safeAddress?: string;
    safeChainId?: number;
    stablecoinAddress?: string;
    recognitionTokenMode?: RecognitionTokenMode;
    recognitionTokenAddress?: string | null;
}

/**
 * Response structure for Safe configuration validation
 */
export interface SafeConfigValidationResponse {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    safeInfo?: {
        owners: string[];
        threshold: number;
        version: string;
    };
    tokenInfo?: {
        stablecoin: {
            name: string;
            symbol: string;
            decimals: number;
            balance?: string;
        };
        recognitionToken?: {
            name: string;
            symbol: string;
            decimals: number;
            balance?: string;
            hasMinterRole?: boolean;
        };
    };
}

/**
 * Chain configuration structure
 */
export interface ChainConfigDTO {
    chainId: number;
    name: string;
    rpcUrl: string;
    blockExplorerUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    isSupported: boolean;
}

