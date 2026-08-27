import { Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/auth';
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
 * DELETE /api/me/image
 * Nettoie le champ `image` si il contient du base64 (reliquat de l'ancienne implémentation).
 * Appeler une seule fois après migration vers Cloudinary, puis se déconnecter/reconnecter.
 */
router.delete('/me/image', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const user = await UserService.findById(userId);
    if (user?.image?.startsWith('data:')) {
      await UserService.updateUser(userId, { image: undefined });
      res.json({ message: 'Champ image nettoyé (base64 supprimé)', cleaned: true });
    } else {
      res.json({ message: 'Aucun base64 trouvé dans image', cleaned: false });
    }
  } catch (error) {
    console.error('[Cleanup image]', error);
    res.status(500).json({ error: 'Erreur lors du nettoyage' });
  }
});

export default router;
