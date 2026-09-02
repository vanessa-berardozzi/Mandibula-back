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
    const allStockInfo = await prisma.stockInfo.findMany({
      include: { product: true },
    });

    for (const stockInfo of allStockInfo) {
      try {
        const newStatus =
          stockInfo.product.totalStock === 0
            ? 'OUT_OF_STOCK'
            : stockInfo.product.totalStock <= stockInfo.minThreshold
              ? 'LOW_STOCK'
              : 'IN_STOCK';

        if (newStatus !== stockInfo.status) {
          await prisma.stockInfo.update({
            where: { id: stockInfo.id },
            data: { status: newStatus },
          });
          result.updated++;
        }

        result.processed++;
      } catch (err) {
        result.errors.push({
          productId: stockInfo.productId,
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
    const stockInfo = await prisma.stockInfo.findUnique({
      where: { productId },
      include: { product: true },
    });

    if (!stockInfo) return null;

    const newStatus =
      stockInfo.product.totalStock === 0
        ? 'OUT_OF_STOCK'
        : stockInfo.product.totalStock <= stockInfo.minThreshold
          ? 'LOW_STOCK'
          : 'IN_STOCK';

    await prisma.stockInfo.update({
      where: { id: stockInfo.id },
      data: { status: newStatus },
    });

    return newStatus;
  } catch (err) {
    console.error(
      `[Stock Status] Erreur recalcul produit ${productId}:`,
      err
    );
    throw err;
  }
}
