import { Request, Response } from 'express';
import { recalculateAllStockStatuses } from '../../lib/stockStatusRecalculator';
import { AdminDashboardService } from '../../services/admin/adminDashboardService';
import { dashboardPeriodSchema } from '../../validations/admin/adminCommonSchemas';

export class AdminDashboardController {
  /**
   * GET /api/admin/dashboard/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    const validation = dashboardPeriodSchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Paramètres invalides',
        details: validation.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    try {
      const stats = await AdminDashboardService.getStats(validation.data.period);
      res.json({ stats });
    } catch (error) {
      console.error('[Admin dashboard] Erreur récupération stats:', error);
      res.status(500).json({ error: 'Erreur lors du calcul des statistiques' });
    }
  }

  /**
   * GET /api/admin/stock-alerts
   */
  static async getStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const alerts = await AdminDashboardService.getStockAlerts();
      res.json({ alerts });
    } catch (error) {
      console.error('[Admin dashboard] Erreur récupération alertes stock:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des alertes de stock' });
    }
  }

  /**
   * POST /api/admin/stock/recalculate
   * Recalcule le statut de tous les produits en fonction du stock réel
   * Utile après des modifications manuelles de stock
   */
  static async recalculateStockStatuses(req: Request, res: Response): Promise<void> {
    try {
      const result = await recalculateAllStockStatuses();
      res.json({
        message: 'Recalcul des statuts de stock complété',
        result,
      });
    } catch (error) {
      console.error('[Admin stock] Erreur recalcul statuts:', error);
      res.status(500).json({ error: 'Erreur lors du recalcul des statuts de stock' });
    }
  }
}
