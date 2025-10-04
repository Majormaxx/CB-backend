import { injectable, inject } from 'inversify';
import { Request, Response } from 'express';
import { PayoutService } from '../services/payout.service.js';
import { TYPES } from '../inversify.types.js';

@injectable()
export class PayoutController {
    constructor(@inject(TYPES.PayoutService) private payoutService: PayoutService) {}

    /**
     * GET /payouts/rounds?orgId= → List incomplete rounds
     */
    public getIncompleteRounds = async (req: Request, res: Response): Promise<void> => {
        try {
            const { orgId } = req.query;

            if (!orgId) {
                res.status(400).json({ error: 'Organization ID is required' });
                return;
            }

            const rounds = await this.payoutService.getIncompleteRounds(orgId as string);
            res.status(200).json(rounds);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /payouts/preview?roundId= → Recipient list (human + base-unit), totals, preflight checks, chunk plan
     */
    public previewPayout = async (req: Request, res: Response): Promise<void> => {
        try {
            const { roundId } = req.query;

            if (!roundId) {
                res.status(400).json({ error: 'Round ID is required' });
                return;
            }

            const preview = await this.payoutService.previewPayout(roundId as string);
            res.status(200).json(preview);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /payouts/propose { roundId, tokenType } → Build batched calls, create Safe transaction, propose it, store proposal, return Safe link
     */
    public proposePayout = async (req: Request, res: Response): Promise<void> => {
        try {
            const { roundId, tokenType } = req.body;

            if (!roundId || !tokenType) {
                res.status(400).json({ error: 'Round ID and token type are required' });
                return;
            }

            if (!['STABLECOIN', 'RECOGNITION'].includes(tokenType)) {
                res.status(400).json({ error: 'Token type must be STABLECOIN or RECOGNITION' });
                return;
            }

            const proposal = await this.payoutService.proposePayout(roundId, tokenType);
            res.status(200).json(proposal);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /payouts/status?roundId= → Poll Transaction Service for statuses; update records accordingly
     */
    public getPayoutStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const { roundId } = req.query;

            if (!roundId) {
                res.status(400).json({ error: 'Round ID is required' });
                return;
            }

            const status = await this.payoutService.getPayoutStatus(roundId as string);
            res.status(200).json(status);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
