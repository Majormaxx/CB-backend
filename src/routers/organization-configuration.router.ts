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
    // Public endpoint: list supported chains
    this._router.get('/supported-chains', (req, res) =>
      this.organizationConfigurationController.getSupportedChains(res)
    );

    // Admin endpoints: validate and update Safe configuration
    this._router.post(
      '/validate-safe-config',
      jwtMiddleware,
      adminMiddleware,
      (req, res) => this.organizationConfigurationController.validateSafeConfig(req as any, res)
    );

    this._router.put(
      '/safe-config',
      jwtMiddleware,
      adminMiddleware,
      (req, res) => this.organizationConfigurationController.updateSafeConfig(req as any, res)
    );
  }

  public get router(): Router {
    return this._router;
  }
}
