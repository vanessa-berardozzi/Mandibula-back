import { Request, Response } from 'express';
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
}
