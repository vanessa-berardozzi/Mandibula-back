import { Request, Response, Router } from 'express';
import { AdminBannerService } from '../services/admin/adminBannerService';

const router = Router();

/**
 * GET /api/banner
 * Bandeau d'information affiché en haut du site (public).
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const banner = await AdminBannerService.get();
    res.json(banner);
  } catch (error) {
    console.error('Erreur récupération bandeau:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
