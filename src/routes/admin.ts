import { NextFunction, Request, Response, Router } from 'express';
import { AdminDashboardController } from '../controllers/admin/adminDashboardController';
import { AdminOrderController } from '../controllers/admin/adminOrderController';
import { adminMiddleware, authMiddleware } from '../middleware/auth';

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

router.get('/orders', AdminOrderController.list);
router.get('/orders/:orderId', AdminOrderController.getOne);
router.patch('/orders/:orderId/status', AdminOrderController.updateStatus);

export default router;
