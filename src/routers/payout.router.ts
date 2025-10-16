import { Router } from 'express';
import { injectable } from 'inversify';
import { PayoutController } from '../controllers/payout.controller.js';

@injectable()
export class PayoutRouter {
    private readonly _router: Router;

    constructor(private controller: PayoutController) {
        this._router = Router({ strict: true });
        this.init();
    }

    private init(): void {
        this._router.get('/rounds', this.controller.getIncompleteRounds);
        this._router.get('/preview', this.controller.previewPayout);
        this._router.post('/propose', this.controller.proposePayout);
        this._router.get('/status', this.controller.getPayoutStatus);
    }

    public get router(): Router {
        return this._router;
    }
}
