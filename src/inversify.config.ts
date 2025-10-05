import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './inversify.types.js';
import { App } from './app.js';
import { UserRouter } from './routers/user.router.js';
import { OrgRouter } from './routers/org.router.js';
import { RoundsRouter } from './routers/rounds.router.js';
import { OrganizationConfigurationRouter } from './routers/organization-configuration.router.js';
import { UserController } from './controllers/user.controller.js';
import { OrganizationController } from './controllers/organization.controller.js';
import { RoundsController } from './controllers/rounds.controller.js';
import { OrganizationConfigurationController } from './controllers/organization-configuration.controller.js';
import { OrganizationConfigurationService } from './services/org/organization-configuration.service.js';
import { UserService } from './services/user.service.js';
import { OrganizationService } from './services/organization.service.js';
import { RoundService } from './services/round.service.js';

const container = new Container();

// Bind App
container.bind<App>(App).toSelf();

// Bind Routers
container.bind<UserRouter>(UserRouter).toSelf();
container.bind<OrgRouter>(OrgRouter).toSelf();
container.bind<RoundsRouter>(RoundsRouter).toSelf();
container.bind<OrganizationConfigurationRouter>(OrganizationConfigurationRouter).toSelf();

// Bind Controllers
container.bind<UserController>(UserController).toSelf();
container.bind<OrganizationController>(OrganizationController).toSelf();
container.bind<RoundsController>(RoundsController).toSelf();
container.bind<OrganizationConfigurationController>(OrganizationConfigurationController).toSelf();

// Bind Services
container.bind<UserService>(UserService).toSelf();
container.bind<OrganizationService>(OrganizationService).toSelf();
container.bind<RoundService>(RoundService).toSelf();
container.bind<OrganizationConfigurationService>(OrganizationConfigurationService).toSelf();

export { container };