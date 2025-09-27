import { Container } from 'inversify';
import { PayoutController } from './controllers/payout.controller.js';
import { PayoutService } from './services/payout.service.js';

const container = new Container({
  autoBindInjectable: true,
  defaultScope: 'Singleton'
});

container.bind<PayoutService>(PayoutService).toSelf();
container.bind<PayoutController>(PayoutController).toSelf();

export { container };