import { injectable, inject } from 'inversify';
import { Request, Response } from 'express';
import { PayoutService } from '../services/payout.service.js';

@injectable()
export class PayoutController {
    constructor(@inject(PayoutService) private payoutService: PayoutService) {}

    public previewPayout = async (req: Request, res: Response): Promise<void> => {
        try {
            const { roundId } = req.query;
            const preview = await this.payoutService.previewPayout(roundId as string);
            res.status(200).json(preview);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    public proposePayout = async (req: Request, res: Response): Promise<void> => {
        try {
            const { roundId, tokenType } = req.body;
            const proposal = await this.payoutService.proposePayout(roundId, tokenType);
            res.status(200).json(proposal);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
