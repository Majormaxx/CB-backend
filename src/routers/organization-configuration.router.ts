import { Router } from 'express';
import { authenticate, isAdmin } from '../middleware/auth';

// Note: The controller is not directly referenced here.
// Inversify-express-utils handles the routing based on the controller's annotations.

const organizationConfigurationRouter = Router();

// Applying authentication and admin authorization middleware to all routes in this file.
// The actual controller methods are linked by inversify-express-utils.
organizationConfigurationRouter.use(authenticate, isAdmin);

export { organizationConfigurationRouter };