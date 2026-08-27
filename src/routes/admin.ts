import { NextFunction, Request, Response, Router } from 'express';
import { AdminDashboardController } from '../controllers/admin/adminDashboardController';
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

export default router;
