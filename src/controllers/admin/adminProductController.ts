import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { AdminProductService } from '../../services/admin/adminProductService';
import { adminEditProductSchema } from '../../validations/admin/adminProductSchemas';

export class AdminProductController {
  /**
   * GET /api/admin/products
   * Liste des produits pour le catalogue avec infos de stock
   * Query: ?search=&page=1&limit=20
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { search, page = '1', limit = '20' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const where: Prisma.ProductWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { category: { name: { contains: search as string, mode: 'insensitive' } } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            images: true,
            totalStock: true,
            category: {
              select: { id: true, name: true },
            },
            variants: {
              where: { isActive: true },
              select: { id: true, name: true, price: true },
            },
            stockInfo: {
              select: { status: true, minThreshold: true },
            },
          },
          orderBy: { name: 'asc' },
          skip,
          take: limitNum,
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category.name,
          image: product.images[0] || '',
          price: Number(product.price),
          totalStock: product.totalStock,
          variantCount: product.variants.length,
          stockStatus: product.stockInfo?.status || 'UNKNOWN',
          minThreshold: product.stockInfo?.minThreshold || 5,
        })),
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      });
    } catch (error) {
      console.error('[Admin products] Erreur listage:', error);
      res.status(500).json({ error: 'Erreur lors du chargement des produits' });
    }
  }

  /**
   * GET /api/admin/products/:productId
   * Récupère les détails complets d'un produit pour édition
   */
  static async getOne(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const product = await AdminProductService.getProductDetail(productId);

      if (!product) {
        res.status(404).json({ error: 'Produit non trouvé' });
        return;
      }

      res.json(product);
    } catch (error) {
      console.error('[Admin products] Erreur récupération détails:', error);
      res.status(500).json({ error: 'Erreur lors du chargement du produit' });
    }
  }

  /**
   * PATCH /api/admin/products/:productId
   * Met à jour un produit (nom, description, prix, seuil de stock)
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      // Validation des données
      const validation = adminEditProductSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation échouée',
          details: validation.error.flatten(),
        });
        return;
      }

      const product = await AdminProductService.updateProduct(productId, validation.data);

      if (!product) {
        res.status(404).json({ error: 'Produit non trouvé' });
        return;
      }

      res.json(product);
    } catch (error) {
      console.error('[Admin products] Erreur mise à jour:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
    }
  }
}
