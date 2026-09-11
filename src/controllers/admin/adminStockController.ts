import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

const adjustStockSchema = z.object({
  quantity: z.number().int('La quantité doit être un entier').min(-10000).max(10000),
  reason: z.string().min(3).max(500).optional(),
  type: z.enum(['ENTRY', 'LOSS', 'ADJUSTMENT']).optional(),
  variantId: z.string().optional(),
});

import { StockMode } from '@prisma/client';
import { AdminProductService } from '../../services/admin/adminProductService';

export class AdminStockController {
  /**
   * PATCH /api/admin/stock/product/:productId
   * Ajuste le stock d'un produit (global si SHARED_POOL, ou par variante si PER_VARIANT)
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

    const { quantity, reason, type, variantId } = validation.data;

    if (quantity === 0) {
      res.status(400).json({ error: 'La quantité ne peut pas être nulle' });
      return;
    }

    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
          stockInfo: true,
        },
      });

      if (!product) {
        res.status(404).json({ error: 'Produit non trouvé' });
        return;
      }

      if (product.stockMode === StockMode.PER_VARIANT) {
        // En mode PER_VARIANT, on doit cibler une variante
        const targetVariant = variantId
          ? product.variants.find((v) => v.id === variantId)
          : product.variants.length === 1
            ? product.variants[0]
            : null;

        if (!targetVariant) {
          res.status(400).json({
            error: 'Variante requise',
            message: 'Veuillez spécifier la variante dont vous souhaitez ajuster le stock',
          });
          return;
        }

        const currentVariantStock = targetVariant.totalStock ?? 0;
        const newVariantStock = currentVariantStock + quantity;
        if (newVariantStock < 0) {
          res.status(400).json({
            error: 'Stock insuffisant',
            message: `Stock actuel de la variante "${targetVariant.name}": ${currentVariantStock}, impossible de retirer ${Math.abs(quantity)}`,
          });
          return;
        }

        const result = await prisma.$transaction(async (tx) => {
          await tx.productVariant.update({
            where: { id: targetVariant.id },
            data: { totalStock: newVariantStock },
          });

          await tx.stockMovement.create({
            data: {
              productId: productId,
              variantId: targetVariant.id,
              type: type ?? (quantity > 0 ? 'ENTRY' : 'ADJUSTMENT'),
              quantity: Math.abs(quantity),
              reason:
                reason ||
                `Ajustement manuel (${targetVariant.name}) par ${req.user?.name || 'Admin'}`,
            },
          });

          // Recalculer le totalStock du produit
          const allVariants = await tx.productVariant.findMany({
            where: { productId },
            select: { totalStock: true, reservedStock: true },
          });
          const sumTotal = allVariants.reduce((acc, v) => acc + (v.totalStock ?? 0), 0);

          const updatedProduct = await tx.product.update({
            where: { id: productId },
            data: { totalStock: sumTotal },
            select: { id: true, name: true, totalStock: true },
          });

          return updatedProduct;
        });

        await AdminProductService.recalculateStockStatus(productId);

        res.json({
          message: 'Stock de la variante ajusté avec succès',
          product: result,
        });
        return;
      }

      // Mode SHARED_POOL (Animaux vivants)
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

        const targetVariant = variantId
          ? product.variants.find((v) => v.id === variantId)
          : product.variants[0];

        if (targetVariant) {
          await tx.stockMovement.create({
            data: {
              productId: productId,
              variantId: targetVariant.id,
              type: type ?? (quantity > 0 ? 'ENTRY' : 'ADJUSTMENT'),
              quantity: Math.abs(quantity),
              reason: reason || `Ajustement manuel par ${req.user?.name || 'Admin'}`,
            },
          });
        }

        return updated;
      });

      await AdminProductService.recalculateStockStatus(productId);

      res.json({
        message: 'Stock ajusté avec succès',
        product: result,
      });
    } catch (error) {
      console.error('[Admin stock] Erreur ajustement stock:', error);
      res.status(500).json({ error: "Erreur lors de l'ajustement du stock" });
    }
  }

  /**
   * GET /api/admin/stock/product/:productId
   * Récupère les détails de stock d'un produit et de ses variantes
   */
  static async getProductStock(req: Request, res: Response): Promise<void> {
    const { productId } = req.params;

    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          stockMode: true,
          totalStock: true,
          reservedStock: true,
          variants: {
            select: {
              id: true,
              name: true,
              lotSize: true,
              isActive: true,
              price: true,
              totalStock: true,
              reservedStock: true,
              stockInfos: {
                select: {
                  minThreshold: true,
                  status: true,
                },
              },
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

      const isPerVariant = product.stockMode === StockMode.PER_VARIANT;

      res.json({
        product: {
          ...product,
          variants: product.variants.map((v) => ({
            ...v,
            availableStock: isPerVariant
              ? Math.max(0, (v.totalStock ?? 0) - (v.reservedStock ?? 0))
              : Math.max(0, Math.floor((product.totalStock - product.reservedStock) / (v.lotSize || 1))),
          })),
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