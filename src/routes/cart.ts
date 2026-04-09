import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { CartService } from '../services/cartService';
import { addToCartSchema, updateCartItemSchema } from '../validations/cartSchemas';

const router = Router();

/**
 * Routes pour la gestion du panier
 * Toutes les routes sont protégées par authMiddleware (Better Auth cookies)
 * req.user et req.session sont automatiquement disponibles
 */

/**
 * GET /api/cart
 * Récupère le panier de l'utilisateur connecté
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cart = await CartService.getCart(req.user!.id);
    res.status(200).json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du panier' });
  }
});

/**
 * POST /api/cart/items
 * Ajoute un produit au panier
 */
router.post(
  '/items',
  authMiddleware,
  validateBody(addToCartSchema),
  async (req: Request, res: Response) => {
    try {
      const cartItem = await CartService.addToCart(req.user!.id, req.body);
      res.status(201).json({ success: true, item: cartItem });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Erreur lors de l\'ajout au panier' });
      }
    }
  }
);

/**
 * PATCH /api/cart/items/:productId
 * Met à jour la quantité d'un article
 */
router.patch(
  '/items/:productId',
  authMiddleware,
  validateBody(updateCartItemSchema),
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;

      // Valider que productId est un UUID valide
      if (!productId || productId.length !== 36) {
        res.status(400).json({ error: 'ID produit invalide' });
        return;
      }

      const cartItem = await CartService.updateCartItem(req.user!.id, productId, req.body);
      res.status(200).json({ success: true, item: cartItem });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Erreur lors de la mise à jour du panier' });
      }
    }
  }
);

/**
 * DELETE /api/cart/items/:productId
 * Supprime un article du panier
 */
router.delete('/items/:productId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    // Valider que productId est un UUID valide
    if (!productId || productId.length !== 36) {
      res.status(400).json({ error: 'ID produit invalide' });
      return;
    }

    const result = await CartService.removeFromCart(req.user!.id, productId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erreur lors de la suppression du panier' });
    }
  }
});

/**
 * POST /api/cart/validate
 * CRITIQUE: Valide le panier avant checkout
 * Recalcule TOUS les prix, taxes, stocks, promo codes
 * Defense ultime contre tampering du client
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validation = await CartService.validateCart(req.user!.id);

    if (!validation.valid) {
      res.status(422).json({
        success: false,
        message: 'Panier invalide',
        validation,
      });
      return;
    }

    res.status(200).json({ success: true, validation });
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({ error: 'Erreur lors de la validation du panier' });
  }
});

/**
 * DELETE /api/cart
 * Vide complètement le panier
 */
router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await CartService.clearCart(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Erreur lors du vidage du panier' });
  }
});

export default router;
