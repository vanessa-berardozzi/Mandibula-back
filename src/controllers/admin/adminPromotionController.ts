import { Request, Response } from 'express';
import { z } from 'zod';
import { AdminPromotionService } from '../../services/admin/adminPromotionService';
import { adminCreatePromotionSchema, adminUpdatePromotionSchema } from '../../validations/admin/adminPromotionSchemas';

export class AdminPromotionController {
  /**
   * GET /api/admin/promotions
   * Liste tous les codes promotionnels
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const promotions = await AdminPromotionService.listAll();
      res.json(promotions);
    } catch (error) {
      console.error('Erreur récupération promotions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * POST /api/admin/promotions
   * Crée un nouveau code promotionnel
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      // Conversion des données du formulaire (strings → numbers/dates)
      const payload = {
        code: req.body.code,
        type: req.body.type,
        value: req.body.value ? Number(req.body.value) : undefined,
        minimumOrder: req.body.minimumOrder ? Number(req.body.minimumOrder) : 0,
        usageLimit: req.body.usageLimit ? Number(req.body.usageLimit) : null,
        startsAt: req.body.startsAt || null,
        endsAt: req.body.endsAt || null,
        isActive: req.body.isActive,
      };

      // Validation avec Zod
      const validated = adminCreatePromotionSchema.parse(payload);

      const promotion = await AdminPromotionService.create(validated);
      res.status(201).json(promotion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        res.status(400).json({ error: messages });
        return;
      }
      if ((error as Record<string, unknown>).code === 'P2002') {
        res.status(409).json({ error: 'Ce code existe déjà' });
        return;
      }
      console.error('Erreur création promotion:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * PATCH /api/admin/promotions/:id
   * Met à jour un code promotionnel
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Conversion des données du formulaire
      const payload = {
        code: req.body.code,
        type: req.body.type,
        value: req.body.value === undefined ? undefined : Number(req.body.value),
        minimumOrder: req.body.minimumOrder === undefined ? undefined : Number(req.body.minimumOrder),
        usageLimit: req.body.usageLimit === undefined
          ? undefined
          : req.body.usageLimit === null || req.body.usageLimit === ''
            ? null
            : Number(req.body.usageLimit),
        startsAt: req.body.startsAt || null,
        endsAt: req.body.endsAt || null,
        isActive: req.body.isActive,
      };

      // Validation avec Zod
      const validated = adminUpdatePromotionSchema.parse(payload);

      const promotion = await AdminPromotionService.update(id, validated);
      res.json(promotion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        res.status(400).json({ error: messages });
        return;
      }
      if ((error as Record<string, unknown>).code === 'P2025') {
        res.status(404).json({ error: 'Promotion non trouvée' });
        return;
      }
      if ((error as Record<string, unknown>).code === 'P2002') {
        res.status(409).json({ error: 'Ce code existe déjà' });
        return;
      }
      console.error('Erreur mise à jour promotion:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  /**
   * DELETE /api/admin/promotions/:id
   * Supprime un code promotionnel
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await AdminPromotionService.delete(id);
      res.json({ success: true });
    } catch (error: unknown) {
      if ((error as Record<string, unknown>).code === 'P2025') {
        res.status(404).json({ error: 'Promotion non trouvée' });
        return;
      }
      console.error('Erreur suppression promotion:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
}
