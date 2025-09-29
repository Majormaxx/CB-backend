import { IsString, IsNumber, IsEnum, IsOptional, IsEthereumAddress, Min, Max } from 'class-validator';
import { RecognitionTokenMode } from '../../entities/org/organization.model.js';

/**
 * DTO for updating Safe configuration
 */
export class UpdateSafeConfigDTO {
    @IsString()
    @IsEthereumAddress()
    safeAddress!: string;

    @IsNumber()
    @Min(1)
    @Max(999999999)
    safeChainId!: number;

    @IsString()
    @IsEthereumAddress()
    stablecoinAddress!: string;

    @IsNumber()
    @Min(0)
    @Max(18)
    stablecoinDecimals!: number;

    @IsOptional()
    @IsString()
    @IsEthereumAddress()
    recognitionTokenAddress?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(18)
    recognitionTokenDecimals?: number;

    @IsEnum(RecognitionTokenMode)
    recognitionTokenMode!: RecognitionTokenMode;
}

/**
 * Response DTO for Safe configuration validation
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
 * DTO for chain configuration
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
