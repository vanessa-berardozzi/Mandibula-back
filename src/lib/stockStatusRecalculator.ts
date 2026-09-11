import { AdminProductService } from '../services/admin/adminProductService';
import { prisma } from './prisma';

export interface RecalculationResult {
  processed: number;
  updated: number;
  errors: Array<{ productId: string; error: string }>;
}

/**
 * Recalcule le statut de stock pour TOUS les produits en fonction du stock réel
 * Utile après des modifications manuelles de stock
 *
 * @returns Statistiques du recalcul
 */
export async function recalculateAllStockStatuses(): Promise<RecalculationResult> {
  const result: RecalculationResult = {
    processed: 0,
    updated: 0,
    errors: [],
  };

  try {
    const products = await prisma.product.findMany({
      select: { id: true },
    });

    for (const product of products) {
      try {
        await AdminProductService.recalculateStockStatus(product.id);
        result.processed++;
        result.updated++;
      } catch (err) {
        result.errors.push({
          productId: product.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  } catch (err) {
    console.error('[Stock Status] Erreur lors du recalcul:', err);
    throw err;
  }

  return result;
}

/**
 * Recalcule le statut de stock pour un produit spécifique
 *
 * @param productId ID du produit
 * @returns Le nouveau statut ou null si le produit n'existe pas
 */
export async function recalculateStockStatusForProduct(
  productId: string
): Promise<'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | null> {
  try {
    await AdminProductService.recalculateStockStatus(productId);
    const stockInfo = await prisma.stockInfo.findUnique({
      where: { productId },
      select: { status: true },
    });

    return (stockInfo?.status as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK') ?? null;
  } catch (err) {
    console.error(
      `[Stock Status] Erreur recalcul produit ${productId}:`,
      err
    );
    throw err;
  }
}
