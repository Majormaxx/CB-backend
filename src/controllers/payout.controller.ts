import { injectable, inject } from 'inversify';
import { Request, Response } from 'express';
import { PayoutService } from '../services/payout.service.js';
import { TYPES } from '../inversify.types.js';
import { payoutRoundsQuerySchema } from '../models/payout/payout-rounds-query.model.js';
import { payoutPreviewQuerySchema } from '../models/payout/payout-preview-query.model.js';
import { proposePayoutSchema } from '../models/payout/propose-payout.model.js';
import { payoutStatusQuerySchema } from '../models/payout/payout-status-query.model.js';
import { TokenType } from '../entities/payout/tx-proposal.model.js';

@injectable()
export class PayoutController {
    constructor(@inject(TYPES.PayoutService) private payoutService: PayoutService) {}

    /**
     * GET /payouts/rounds?orgId= → List incomplete rounds
     */
    public getIncompleteRounds = async (req: Request, res: Response): Promise<void> => {
        try {
            const isValid = payoutRoundsQuerySchema.validate(req.query);
            if (isValid.error) {
                res.status(400).json({ message: isValid.error.message });
                return;
            }

            const { orgId } = req.query;
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
            const isValid = payoutPreviewQuerySchema.validate(req.query);
            if (isValid.error) {
                res.status(400).json({ message: isValid.error.message });
                return;
            }

            const { roundId } = req.query;
            const preview = await this.payoutService.previewPayout(roundId as string);
            res.status(200).json(preview);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * POST /payouts/propose { roundId, tokenType } →
     * Build batched calls, create Safe transaction, propose it, store proposal,
     *  return Safe link
     */
    public proposePayout = async (req: Request, res: Response): Promise<void> => {
        try {
            const isValid = proposePayoutSchema.validate(req.body);
            if (isValid.error) {
                res.status(400).json({ message: isValid.error.message });
                return;
            }

            const { roundId, tokenType } = req.body as { roundId: string; tokenType: 'STABLECOIN' | 'RECOGNITION' };
            const mappedTokenType: TokenType = tokenType === 'STABLECOIN' ? TokenType.STABLECOIN : TokenType.RECOGNITION;

            const proposal = await this.payoutService.proposePayout(roundId, mappedTokenType);
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
            const isValid = payoutStatusQuerySchema.validate(req.query);
            if (isValid.error) {
                res.status(400).json({ message: isValid.error.message });
                return;
            }

            const { roundId } = req.query;
            const status = await this.payoutService.getPayoutStatus(roundId as string);
            res.status(200).json(status);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
