import { Router } from 'express';
import { injectable } from 'inversify';
import { jwtMiddleware } from '../middleware/jwt.middleware.js';
import { adminMiddleware } from '../middleware/admin.middleware.js';
import { OrganizationConfigurationController } from '../controllers/organization-configuration.controller.js';

@injectable()
export class OrganizationConfigurationRouter {
  private readonly _router: Router;

  constructor(private organizationConfigurationController: OrganizationConfigurationController) {
    this._router = Router({ strict: true });
    this.init();
  }

  private init(): void {
    this._router.get('/supported-chains', this.organizationConfigurationController.getSupportedChains);
    this._router.put('/safe-config', jwtMiddleware, adminMiddleware, this.organizationConfigurationController.updateSafeConfig);
    this._router.post('/validate-safe-config', jwtMiddleware, adminMiddleware, this.organizationConfigurationController.validateSafeConfig);
  }

  public get router(): Router {
    return this._router;
  }
}