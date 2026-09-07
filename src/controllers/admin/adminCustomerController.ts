import { Request, Response } from 'express';
import { AdminCustomerService } from '../../services/admin/adminCustomerService';
import { adminCustomersQuerySchema } from '../../validations/admin/adminCustomerSchemas';

export class AdminCustomerController {
  /**
   * GET /api/admin/customers
   * Query params: page, limit, search, sort, direction
   */
  static async list(req: Request, res: Response): Promise<void> {
    const validation = adminCustomersQuerySchema.safeParse(req.query);
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
      res.json(await AdminCustomerService.list(validation.data));
    } catch (error) {
      console.error('[Admin customers] Erreur récupération clients:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
    }
  }
}
