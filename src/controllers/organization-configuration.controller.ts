import { Request, Response } from 'express';
import { injectable } from 'inversify';
import { OrganizationConfigurationService } from '../services/org/organization-configuration.service.js';
import {
    updateSafeConfigSchema,
    validateSafeConfigSchema,
    UpdateSafeConfigDTO
} from '../validation/organization.validation.js';

interface AuthenticatedRequest extends Request {
  user?: any;
}

@injectable()
export class OrganizationConfigurationController {
  constructor(
    private organizationConfigurationService: OrganizationConfigurationService,
  ) {}

  public getSupportedChains = async (req: Request, res: Response): Promise<void> => {
    try {
      const chains = this.organizationConfigurationService.getSupportedChains();
      res.status(200).json({ chains });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to get supported chains',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public validateSafeConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate request body using Joi schema
      const { error, value } = validateSafeConfigSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map((detail: any) => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
        return;
      }

      // Perform comprehensive blockchain validation
      const validationResult = await this.organizationConfigurationService.validateSafeConfig(value);

      res.status(200).json(validationResult);
    } catch (error) {
      res.status(500).json({
        message: 'Validation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public updateSafeConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const { organizationId } = req.user;

      // Validate request body using Joi schema
      const { error, value } = updateSafeConfigSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map((detail: any) => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
        return;
      }

      // Perform comprehensive blockchain validation before updating
      const validationResult = await this.organizationConfigurationService.validateSafeConfig(value);

      if (!validationResult.isValid) {
        res.status(400).json({
          message: 'Configuration validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
        return;
      }

      // Update configuration
      const updatedOrganization = await this.organizationConfigurationService.updateSafeConfig(
        organizationId,
        value,
      );

      res.status(200).json({
        message: 'Configuration updated successfully',
        organization: {
          id: updatedOrganization.id,
          safeAddress: updatedOrganization.safeAddress,
          safeChainId: updatedOrganization.safeChainId,
          stablecoinAddress: updatedOrganization.stablecoinAddress,
          stablecoinDecimals: updatedOrganization.stablecoinDecimals,
          recognitionTokenAddress: updatedOrganization.recognitionTokenAddress,
          recognitionTokenDecimals: updatedOrganization.recognitionTokenDecimals,
          recognitionTokenMode: updatedOrganization.recognitionTokenMode
        },
        validationInfo: {
          warnings: validationResult.warnings,
          safeInfo: validationResult.safeInfo,
          tokenInfo: validationResult.tokenInfo
        }
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to update configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}