import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { AdminBannerController } from '../controllers/admin/adminBannerController';
import { AdminCustomerController } from '../controllers/admin/adminCustomerController';
import { AdminDashboardController } from '../controllers/admin/adminDashboardController';
import { AdminOrderController } from '../controllers/admin/adminOrderController';
import { AdminProductController } from '../controllers/admin/adminProductController';
import { AdminPromotionController } from '../controllers/admin/adminPromotionController';
import { AdminStockController } from '../controllers/admin/adminStockController';
import { uploadToCloudinary } from '../lib/cloudinary';
import { prisma } from '../lib/prisma';
import { adminMiddleware, authMiddleware } from '../middleware/auth';

const router = Router();

// Stockage mémoire : le fichier ne touche jamais le disque du serveur
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Seules les images sont acceptées'));
      return;
    }
    cb(null, true);
  },
});

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
router.post('/products', AdminProductController.create);

/**
 * POST /api/admin/products/image
 * Upload une image produit vers Cloudinary et retourne son URL.
 */
router.post(
  '/products/image',
  uploadImage.single('image'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Aucun fichier fourni' });
        return;
      }

      const { secure_url } = await uploadToCloudinary(req.file.buffer, {
        folder: 'mandibula/products',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      });

      res.json({ url: secure_url });
    } catch (error) {
      console.error('[Admin products] Erreur upload image:', error);
      res.status(500).json({ error: "Erreur lors de l'upload de l'image" });
    }
  }
);

router.get('/products/:productId', AdminProductController.getOne);
router.patch('/products/:productId', AdminProductController.update);

router.get('/customers', AdminCustomerController.list);

// Bandeau d'information du site (singleton)
router.get('/banner', AdminBannerController.get);
router.post('/banner', AdminBannerController.update);

// Promotions endpoints
router.get('/promotions', AdminPromotionController.list);
router.post('/promotions', AdminPromotionController.create);
router.patch('/promotions/:id', AdminPromotionController.update);
router.delete('/promotions/:id', AdminPromotionController.delete);

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
