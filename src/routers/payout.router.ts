import { Router } from 'express';
import { container } from '../inversify.config.js';
import { PayoutController } from '../controllers/payout.controller.js';

const router = Router();
const payoutController = container.get<PayoutController>(PayoutController);

router.get('/preview', payoutController.previewPayout);
router.post('/propose', payoutController.proposePayout);

export default router;