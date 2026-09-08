import { Request, Response } from 'express';
import { z } from 'zod';
import { AdminBannerService } from '../../services/admin/adminBannerService';
import { adminUpdateBannerSchema } from '../../validations/admin/adminBannerSchemas';

export class AdminBannerController {
  /**
   * GET /api/admin/banner
   * Récupère le bandeau d'information courant.
   */
  static async get(_req: Request, res: Response): Promise<void> {
    try {
      const banner = await AdminBannerService.get();
      res.json(banner);
    } catch (error) {
      console.error('Erreur récupération bandeau:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * POST /api/admin/banner
   * Met à jour le message et le statut du bandeau.
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const validated = adminUpdateBannerSchema.parse({
        message: req.body.message,
        status: req.body.status,
      });

      const banner = await AdminBannerService.update(validated);
      res.json(banner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        res.status(400).json({ error: messages });
        return;
      }
      console.error('Erreur mise à jour bandeau:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
}
