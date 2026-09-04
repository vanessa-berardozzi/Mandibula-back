import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

const adjustStockSchema = z.object({
  quantity: z.number().int('La quantité doit être un entier').min(-10000).max(10000),
  reason: z.string().min(3).max(500).optional(),
  type: z.enum(['ENTRY', 'LOSS', 'ADJUSTMENT']).optional(),
});

export class AdminStockController {
  /**
   * PATCH /api/admin/stock/product/:productId
   * Ajuste le stock total d'un produit (ajoute ou enlève des unités)
   */
  static async adjustProductStock(req: Request, res: Response): Promise<void> {
    const { productId } = req.params;
    
    const validation = adjustStockSchema.safeParse(req.body);
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

    const { quantity, reason, type } = validation.data;

    if (quantity === 0) {
      res.status(400).json({ error: 'La quantité ne peut pas être nulle' });
      return;
    }

    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, totalStock: true },
      });

      if (!product) {
        res.status(404).json({ error: 'Produit non trouvé' });
        return;
      }

      const newStock = product.totalStock + quantity;
      if (newStock < 0) {
        res.status(400).json({
          error: 'Stock insuffisant',
          message: `Stock actuel: ${product.totalStock}, impossible de retirer ${Math.abs(quantity)}`,
        });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { totalStock: newStock },
          select: { id: true, name: true, totalStock: true },
        });

        // Le mouvement est rattaché à une variante : on prend la première disponible.
        const firstVariant = await tx.productVariant.findFirst({
          where: { productId },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
          select: { id: true },
        });

        if (firstVariant) {
          await tx.stockMovement.create({
            data: {
              productId: productId,
              variantId: firstVariant.id,
              type: type ?? (quantity > 0 ? 'ENTRY' : 'ADJUSTMENT'),
              quantity: Math.abs(quantity),
              reason: reason || `Ajustement manuel par ${req.user?.name || 'Admin'}`,
            },
          });
        }

        const stockInfo = await tx.stockInfo.findUnique({
          where: { productId },
        });
        const minThreshold = stockInfo?.minThreshold ?? 5;
        const newStatus =
          newStock === 0 ? 'OUT_OF_STOCK' :
          newStock <= minThreshold ? 'LOW_STOCK' :
          'IN_STOCK';

        await tx.stockInfo.upsert({
          where: { productId },
          create: { productId, minThreshold, status: newStatus },
          update: { status: newStatus },
        });

        return updated;
      });

      res.json({
        message: 'Stock ajusté avec succès',
        product: result,
      });
    } catch (error) {
      console.error('[Admin stock] Erreur ajustement stock:', error);
      res.status(500).json({ error: 'Erreur lors de l\'ajustement du stock' });
    }
  }

  /**
   * GET /api/admin/stock/product/:productId
   * Récupère les détails de stock d'un produit
   */
  static async getProductStock(req: Request, res: Response): Promise<void> {
    const { productId } = req.params;

    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          totalStock: true,
          variants: {
            select: {
              id: true,
              name: true,
              lotSize: true,
              isActive: true,
              price: true,
            },
          },
          stockInfo: {
            select: {
              minThreshold: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!product) {
        res.status(404).json({ error: 'Produit non trouvé' });
        return;
      }

      res.json({
        product: {
          ...product,
          totalStock: product.totalStock,
        },
      });
    } catch (error) {
      console.error('[Admin stock] Erreur récupération stock produit:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des stocks' });
    }
  }

  /**
   * GET /api/admin/stock/movements/:productId
   * Récupère l'historique des mouvements de stock d'un produit
   */
  static async getStockMovements(req: Request, res: Response): Promise<void> {
    const { productId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where: { productId },
          include: {
            variant: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.stockMovement.count({ where: { productId } }),
      ]);

      res.json({
        movements: movements.map((m) => ({
          id: m.id,
          variantName: m.variant.name,
          type: m.type,
          quantity: m.quantity,
          reason: m.reason,
          createdAt: m.createdAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('[Admin stock] Erreur récupération mouvements:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des mouvements' });
    }
  }
}