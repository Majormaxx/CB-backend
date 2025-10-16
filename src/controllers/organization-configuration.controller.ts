import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpPut, httpGet, httpPost, request, response } from 'inversify-express-utils';
import { TYPES } from '../inversify.types.js';
import { OrganizationConfigurationService, SafeConfig } from '../services/org/organization-configuration.service.js';
import { UpdateSafeConfigDTO } from '../services/org/organization.dto.js';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

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
    @request() req: { user: any; body: UpdateSafeConfigDTO },
    @response() res: Response,
  ): Promise<Response> {
    try {
      // Validate DTO
      const dto = plainToClass(UpdateSafeConfigDTO, req.body);
      const validationErrors = await validate(dto);

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: validationErrors.map(error => ({
            property: error.property,
            constraints: error.constraints
          }))
        });
      }

      // Perform comprehensive validation
      const validationResult = await this.organizationConfigurationService.validateSafeConfig(dto);

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
    @request() req: { user: any; body: UpdateSafeConfigDTO },
    @response() res: Response,
  ): Promise<Response> {
    try {
      const { organizationId } = req.user;

      // Validate DTO
      const dto = plainToClass(UpdateSafeConfigDTO, req.body);
      const validationErrors = await validate(dto);

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: validationErrors.map(error => ({
            property: error.property,
            constraints: error.constraints
          }))
        });
      }

      // Perform comprehensive validation before updating
      const validationResult = await this.organizationConfigurationService.validateSafeConfig(dto);

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
        dto,
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