import { NextFunction, Request, Response, Router } from 'express';
import { AdminDashboardController } from '../controllers/admin/adminDashboardController';
import { AdminOrderController } from '../controllers/admin/adminOrderController';
import { AdminProductController } from '../controllers/admin/adminProductController';
import { AdminStockController } from '../controllers/admin/adminStockController';
import { adminMiddleware, authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// Toute la surface admin est protégée au niveau du routeur, jamais route par route.
router.use(authMiddleware, adminMiddleware);
router.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/**
 * GET /api/admin/session
 * Permet au frontend de valider qu'une session admin est bien active.
 */
router.get('/session', (req: Request, res: Response): void => {
  res.json({
    user: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role,
    },
  });
});

router.get('/dashboard/stats', AdminDashboardController.getStats);
router.get('/stock-alerts', AdminDashboardController.getStockAlerts);
router.post('/stock/recalculate', AdminDashboardController.recalculateStockStatuses);

// Stock management endpoints
router.patch('/stock/product/:productId', AdminStockController.adjustProductStock);
router.get('/stock/product/:productId', AdminStockController.getProductStock);
router.get('/stock/movements/:productId', AdminStockController.getStockMovements);

router.get('/orders', AdminOrderController.list);
router.get('/orders/:orderId', AdminOrderController.getOne);
router.patch('/orders/:orderId/status', AdminOrderController.updateStatus);

router.get('/products', AdminProductController.list);
router.get('/products/:productId', AdminProductController.getOne);
router.patch('/products/:productId', AdminProductController.update);

/**
 * GET /api/admin/categories
 * Récupère toutes les catégories actives pour les dropdowns
 */
router.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
