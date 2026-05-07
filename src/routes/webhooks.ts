import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';
import { validateBody } from '../middleware/validation';
import { sumupWebhookSchema } from '../validations/checkout.validation';

const router = Router();

/**
 * POST /api/webhooks/sumup
 * Webhook appelé par SumUp après un paiement
 * Public (pas d'authentification, SumUp appelle directement)
 */
router.post(
  '/sumup',
  validateBody(sumupWebhookSchema),
  CheckoutController.handleSumUpWebhook
);

export default router;
