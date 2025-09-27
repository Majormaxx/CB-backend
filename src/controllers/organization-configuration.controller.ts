import { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpPut, request, response } from 'inversify-express-utils';
import { TYPES } from '../inversify.types';
import { OrganizationConfigurationService } from '../services/org/organization-configuration.service';
import { Principal } from '../services/auth.service';
import { UpdateSafeConfigDTO } from '../services/org/organization.dto';

@controller('/api/v1/organization/configuration')
export class OrganizationConfigurationController {
  constructor(
    @inject(TYPES.OrganizationConfigurationService)
    private organizationConfigurationService: OrganizationConfigurationService,
  ) {}

  @httpPut('/')
  public async updateSafeConfig(
    @request() req: { user: Principal },
    @response() res: Response,
  ): Promise<Response> {
    const { organizationId } = req.user;
    const config = req.body as UpdateSafeConfigDTO;

    await this.organizationConfigurationService.updateSafeConfig(
      organizationId,
      config,
    );
    return res.status(200).send({ message: 'Configuration updated successfully' });
  }
}