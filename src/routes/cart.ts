import { Request, Response, Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { CartService } from '../services/cartService';
import { addToCartSchema, updateCartItemSchema } from '../validations/cartSchemas';

const router = Router();

/**
 * Extrait l'identifiant du panier depuis la requête :
 * - userId si connecté (priorité)
 * - guestToken via header X-Guest-Token sinon
 */
function getCartIdentifier(req: Request): { userId?: string; guestToken?: string } {
  const userId = req.user?.id;
  const guestToken = typeof req.headers['x-guest-token'] === 'string'
    ? req.headers['x-guest-token']
    : undefined;
  return { userId, guestToken };
}

/**
 * GET /api/cart
 * Récupère le panier (connecté ou anonyme)
 */
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, guestToken } = getCartIdentifier(req);
    if (!userId && !guestToken) {
      res.status(400).json({ error: 'Identifiant panier requis (session ou X-Guest-Token)' });
      return;
    }
    const cart = await CartService.getCart(userId, guestToken);
    res.status(200).json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du panier' });
  }
});

/**
 * POST /api/cart/items
 * Ajoute un produit au panier (connecté ou anonyme)
 */
router.post(
  '/items',
  optionalAuthMiddleware,
  validateBody(addToCartSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId, guestToken } = getCartIdentifier(req);
      if (!userId && !guestToken) {
        res.status(400).json({ error: 'Identifiant panier requis (session ou X-Guest-Token)' });
        return;
      }
      const cartItem = await CartService.addToCart(userId, guestToken, req.body);
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
 * PATCH /api/cart/items/:variantId
 * Met à jour la quantité d'un article (connecté ou anonyme)
 */
router.patch(
  '/items/:variantId',
  optionalAuthMiddleware,
  validateBody(updateCartItemSchema),
  async (req: Request, res: Response) => {
    try {
      const { variantId } = req.params;

      if (!variantId || variantId.length !== 36) {
        res.status(400).json({ error: 'ID variante invalide' });
        return;
      }

      const { userId, guestToken } = getCartIdentifier(req);
      if (!userId && !guestToken) {
        res.status(400).json({ error: 'Identifiant panier requis (session ou X-Guest-Token)' });
        return;
      }

      const cartItem = await CartService.updateCartItem(userId, guestToken, variantId, req.body);
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
 * DELETE /api/cart/items/:variantId
 * Supprime un article du panier (connecté ou anonyme)
 */
router.delete('/items/:variantId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;

    if (!variantId || variantId.length !== 36) {
      res.status(400).json({ error: 'ID variante invalide' });
      return;
    }

    const { userId, guestToken } = getCartIdentifier(req);
    if (!userId && !guestToken) {
      res.status(400).json({ error: 'Identifiant panier requis (session ou X-Guest-Token)' });
      return;
    }

    const result = await CartService.removeFromCart(userId, guestToken, variantId);
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
 * POST /api/cart/promo
 * Vérifie la validité d'un code promo par rapport au sous-total courant
 */
router.post('/promo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, subtotal } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Code promo manquant' });
      return;
    }

    const parsedSubtotal = typeof subtotal === 'number' ? subtotal : 0;
    const result = CartService.validatePromoCode(code, parsedSubtotal);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating promo:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du code promo' });
  }
});

/**
 * POST /api/cart/validate
 * CRITIQUE: Valide le panier avant checkout (requiert auth)
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const promoCode: string | undefined = typeof req.body?.promoCode === 'string' ? req.body.promoCode : undefined;
    const validation = await CartService.validateCart(req.user!.id, promoCode);

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
 * POST /api/cart/merge
 * Fusionne le panier guest dans le panier utilisateur connecté
 * Appelé juste après connexion/inscription quand un guestToken était actif
 */
router.post('/merge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { guestToken } = req.body;

    if (!guestToken || typeof guestToken !== 'string') {
      res.status(400).json({ error: 'guestToken manquant' });
      return;
    }

    await CartService.mergeGuestCart(guestToken, req.user!.id);
    const cart = await CartService.getCart(req.user!.id, undefined);
    res.status(200).json({ success: true, cart });
  } catch (error) {
    console.error('Error merging guest cart:', error);
    res.status(500).json({ error: 'Erreur lors de la fusion du panier' });
  }
});

/**
 * DELETE /api/cart
 * Vide complètement le panier (connecté ou anonyme)
 */
router.delete('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, guestToken } = getCartIdentifier(req);
    if (!userId && !guestToken) {
      res.status(400).json({ error: 'Identifiant panier requis (session ou X-Guest-Token)' });
      return;
    }
    if (userId) {
      await CartService.clearCart(userId);
    } else {
      await CartService.clearGuestCart(guestToken!);
    }
    res.status(200).json({ success: true, message: 'Panier vidé' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Erreur lors du vidage du panier' });
  }
});

export default router;
