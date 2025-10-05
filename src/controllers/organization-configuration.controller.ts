import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpPut, httpGet, httpPost, request, response } from 'inversify-express-utils';
import { TYPES } from '../inversify.types.js';
import { OrganizationConfigurationService, SafeConfig } from '../services/org/organization-configuration.service.js';
import { Principal } from '../services/auth.service.js';
import {
    updateSafeConfigSchema,
    validateSafeConfigSchema,
    UpdateSafeConfigDTO
} from '../validation/organization.validation.js';

@controller('/api/v1/organization/configuration')
export class OrganizationConfigurationController {
  constructor(
    @inject(TYPES.OrganizationConfigurationService)
    private organizationConfigurationService: OrganizationConfigurationService,
  ) {}

  @httpGet('/chains')
  public async getSupportedChains(
    @response() res: Response,
  ): Promise<Response> {
    try {
      const chains = this.organizationConfigurationService.getSupportedChains();
      return res.status(200).json({ chains });
    } catch (error) {
      return res.status(500).json({
        message: 'Failed to get supported chains',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @httpPost('/validate')
  public async validateSafeConfig(
    @request() req: { user: Principal; body: UpdateSafeConfigDTO },
    @response() res: Response,
  ): Promise<Response> {
    try {
      // Validate request body using Joi schema
      const { error, value } = validateSafeConfigSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map((detail: any) => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }

      // Perform comprehensive blockchain validation
      const validationResult = await this.organizationConfigurationService.validateSafeConfig(value);

      return res.status(200).json(validationResult);
    } catch (error) {
      return res.status(500).json({
        message: 'Validation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @httpPut('/')
  public async updateSafeConfig(
    @request() req: { user: Principal; body: UpdateSafeConfigDTO },
    @response() res: Response,
  ): Promise<Response> {
    try {
      const { organizationId } = req.user;

      // Validate request body using Joi schema
      const { error, value } = updateSafeConfigSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.details.map((detail: any) => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }

      // Perform comprehensive blockchain validation before updating
      const validationResult = await this.organizationConfigurationService.validateSafeConfig(value);

      if (!validationResult.isValid) {
        return res.status(400).json({
          message: 'Configuration validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
      }

      // Update configuration
      const updatedOrganization = await this.organizationConfigurationService.updateSafeConfig(
        organizationId,
        value,
      );

      return res.status(200).json({
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
      return res.status(500).json({
        message: 'Failed to update configuration',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}