import { Request, Response, Router } from 'express';
import { adminMiddleware, authMiddleware } from '../middleware/auth';
import { UserService } from '../services/userService';

const router = Router();

/**
 * GET /api/me
 * Retourne les informations de l'utilisateur connecté
 */
router.get('/me', authMiddleware, (req: Request, res: Response): void => {
  res.json({
    user: req.user,
    session: {
      expiresAt: req.session?.expiresAt,
    },
  });
});

/**
 * DELETE /api/me
 * Supprime le compte de l'utilisateur connecté
 */
router.delete('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Utiliser le service pour supprimer l'utilisateur
    await UserService.deleteUser(userId);

    res.json({
      message: 'Compte supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
  }
});

/**
 * GET /api/admin/dashboard
 * Route accessible uniquement aux admins
 */
router.get(
  '/admin/dashboard',
  authMiddleware,
  adminMiddleware,
  (req: Request, res: Response): void => {
    res.json({
      message: 'Bienvenue sur le dashboard admin',
      user: req.user,
    });
  }
);

export default router;
