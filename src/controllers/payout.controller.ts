import { injectable } from 'inversify';
import { Request, Response } from 'express';
import { PayoutService } from '../services/payout.service.js';

@injectable()
export class PayoutController {

    constructor(private payoutService: PayoutService) { }

    /**
     * Preview payout for a round with recipient details and validation warnings.
     */
    public previewPayout = async (req: Request, res: Response) => {
        try {
            const { roundId } = req.query;
            const preview = await this.payoutService.previewPayout(roundId as string);
            res.status(200).json(preview);
        } catch (error) {
            console.error('Error previewing payout:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Propose payout transactions to Safe multisig for a round.
     */
    public proposePayout = async (req: Request, res: Response) => {
        try {
            const { roundId, tokenType } = req.body;
            const proposal = await this.payoutService.proposePayout(roundId, tokenType);
            res.status(200).json(proposal);
        } catch (error) {
            console.error('Error proposing payout:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}