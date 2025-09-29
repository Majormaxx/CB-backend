import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './inversify.types.js';
import { OrganizationConfigurationService } from './services/org/organization-configuration.service.js';

// Import controllers to register them
import './controllers/payout.controller';
import './controllers/organization-configuration.controller';

const container = new Container();

// Bind services
container.bind<OrganizationConfigurationService>(TYPES.OrganizationConfigurationService).to(OrganizationConfigurationService);

export { container };