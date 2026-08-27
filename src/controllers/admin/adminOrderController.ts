import { Request, Response } from 'express';
import { AdminOrderService } from '../../services/admin/adminOrderService';
import {
    adminOrdersQuerySchema,
    updateOrderStatusSchema,
} from '../../validations/admin/adminOrderSchemas';

function invalidParams(res: Response, issues: { path: PropertyKey[]; message: string }[]): void {
  res.status(400).json({
    error: 'Paramètres invalides',
    details: issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export class AdminOrderController {
  /**
   * GET /api/admin/orders
   */
  static async list(req: Request, res: Response): Promise<void> {
    const validation = adminOrdersQuerySchema.safeParse(req.query);
    if (!validation.success) {
      invalidParams(res, validation.error.issues);
      return;
    }

    try {
      const result = await AdminOrderService.list(validation.data);
      res.json(result);
    } catch (error) {
      console.error('[Admin orders] Erreur récupération commandes:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
    }
  }

  /**
   * GET /api/admin/orders/:orderId
   */
  static async getOne(req: Request, res: Response): Promise<void> {
    try {
      const order = await AdminOrderService.getById(req.params.orderId);
      if (!order) {
        res.status(404).json({ error: 'Commande introuvable' });
        return;
      }
      res.json({ order });
    } catch (error) {
      console.error('[Admin orders] Erreur récupération commande:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
    }
  }

  /**
   * PATCH /api/admin/orders/:orderId/status
   */
  static async updateStatus(req: Request, res: Response): Promise<void> {
    const validation = updateOrderStatusSchema.safeParse(req.body);
    if (!validation.success) {
      invalidParams(res, validation.error.issues);
      return;
    }

    try {
      const order = await AdminOrderService.updateStatus(
        req.params.orderId,
        validation.data.status
      );
      if (!order) {
        res.status(404).json({ error: 'Commande introuvable' });
        return;
      }
      res.json({ order });
    } catch (error) {
      console.error('[Admin orders] Erreur mise à jour du statut:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
    }
  }
}
