import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { WishlistService } from '../services/wishlistService';

const router = Router();

// Toutes les routes wishlist nécessitent d'être connecté
router.use(authMiddleware);

/**
 * GET /api/wishlist
 * Retourne la liste des favoris de l'utilisateur connecté
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await WishlistService.getWishlist(req.user!.id);
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Erreur lors de la récupération des favoris' });
  }
});

/**
 * POST /api/wishlist/:productId
 * Ajoute un produit aux favoris
 */
router.post('/:productId', async (req: Request, res: Response) => {
  try {
    await WishlistService.add(req.user!.id, req.params.productId);
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Produit introuvable') {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Erreur lors de l\'ajout aux favoris' });
  }
});

/**
 * DELETE /api/wishlist/:productId
 * Retire un produit des favoris
 */
router.delete('/:productId', async (req: Request, res: Response) => {
  try {
    await WishlistService.remove(req.user!.id, req.params.productId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la suppression du favori' });
  }
});

export default router;
