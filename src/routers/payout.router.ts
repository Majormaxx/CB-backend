import { Router } from 'express';
import { container } from '../inversify.config.js';
import { PayoutController } from '../controllers/payout.controller.js';

const router = Router();
const payoutController = container.get<PayoutController>(PayoutController);

// Module II API Endpoints - exactly as specified in the document
router.get('/rounds', payoutController.getIncompleteRounds);     // GET /payouts/rounds?orgId=
router.get('/preview', payoutController.previewPayout);         // GET /payouts/preview?roundId=
router.post('/propose', payoutController.proposePayout);        // POST /payouts/propose { roundId, tokenType }
router.get('/status', payoutController.getPayoutStatus);        // GET /payouts/status?roundId=

export { router as payoutRouter };
