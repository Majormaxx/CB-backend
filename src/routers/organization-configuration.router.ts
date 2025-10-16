import { Router } from 'express';

// Note: The controller is not directly referenced here.
// Inversify-express-utils handles the routing based on the controller's annotations.

const organizationConfigurationRouter = Router();

// TODO: Add authentication and admin authorization middleware
// organizationConfigurationRouter.use(authenticate, isAdmin);

export { organizationConfigurationRouter };