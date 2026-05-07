import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createCheckoutSchema } from '../validations/checkout.validation';

const router = Router();

/**
 * POST /api/checkout
 * Crée un checkout de paiement et retourne l'URL de redirection
 * Requiert une authentification
 */
router.post(
  '/',
  authMiddleware,
  validateBody(createCheckoutSchema),
  CheckoutController.createCheckout
);

/**
 * GET /api/checkout/order/:orderId/status
 * Vérifie le statut d'une commande
 * Requiert une authentification
 */
router.get(
  '/order/:orderId/status',
  authMiddleware,
  CheckoutController.checkOrderStatus
);

export default router;
