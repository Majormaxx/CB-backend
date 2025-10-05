import { Router } from 'express';
import { injectable } from 'inversify';
import { PayoutController } from '../controllers/payout.controller.js';

@injectable()
export class PayoutRouter {
  private readonly _router: Router;

  constructor(private payoutController: PayoutController) {
    this._router = Router({ strict: true });
    this.init();
  }

  private init(): void {
    this._router.get('/preview', this.payoutController.previewPayout);
    this._router.post('/propose', this.payoutController.proposePayout);
  }

  public get router(): Router {
    return this._router;
  }
}