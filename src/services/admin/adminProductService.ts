import { PromotionType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface ProductDetailDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  totalStock: number;
  reservedStock: number;
  category: {
    id: string;
    name: string;
  };
  variants: {
    id: string;
    name: string;
    price: number;
    lotSize: number;
    isActive: boolean;
  }[];
  stockInfo: {
    minThreshold: number;
    status: string;
  } | null;
  promotionType?: PromotionType;
  promotionValue?: number | null;
  featured?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  price?: number;
  minThreshold?: number;
  promotionType?: PromotionType;
  promotionValue?: number | null;
  featured?: boolean;
}

export class AdminProductService {
  /**
   * Récupère les détails complets d'un produit pour édition
   */
  static async getProductDetail(productId: string): Promise<ProductDetailDto | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: { id: true, name: true },
        },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            lotSize: true,
            isActive: true,
          },
        },
        stockInfo: {
          select: {
            minThreshold: true,
            status: true,
          },
        },
      },
    });

    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      images: product.images,
      totalStock: product.totalStock,
      reservedStock: product.reservedStock,
      category: {
        id: product.category.id,
        name: product.category.name,
      },
      variants: product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: Number(v.price),
        lotSize: v.lotSize,
        isActive: v.isActive,
      })),
      stockInfo: product.stockInfo
        ? {
            minThreshold: product.stockInfo.minThreshold,
            status: product.stockInfo.status,
          }
        : null,
      promotionType: product.promotionType,
      promotionValue: product.promotionValue ? Number(product.promotionValue) : null,
      featured: product.featured,
    };
  }

  /**
   * Met à jour les informations d'un produit (nom, description, prix)
   * Recalcule le statut de stock si minThreshold change
   */
  static async updateProduct(
    productId: string,
    input: UpdateProductInput,
  ): Promise<ProductDetailDto | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stockInfo: true },
    });

    if (!product) return null;

    // Mise à jour du produit
    await prisma.product.update({
      where: { id: productId },
      data: {
        ...(input.promotionType && { promotionType: input.promotionType }),
        ...(input.promotionValue !== undefined && { promotionValue: input.promotionValue }),
        ...(input.featured !== undefined && { featured: input.featured }),
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price && { price: input.price }),
      },
    });

    // Mise à jour du seuil de stock si fourni
    if (input.minThreshold !== undefined && product.stockInfo) {
      await prisma.stockInfo.update({
        where: { id: product.stockInfo.id },
        data: { minThreshold: input.minThreshold },
      });

      // Recalcul du statut
      await this.recalculateStockStatus(productId);
    }

    // Retour du produit mis à jour
    return this.getProductDetail(productId);
  }

  /**
   * Recalcule le statut de stock d'un produit basé sur stock disponible et seuil
   */
  static async recalculateStockStatus(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stockInfo: true },
    });

    if (!product || !product.stockInfo) return;

    const availableStock = product.totalStock - product.reservedStock;
    let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

    if (availableStock <= 0) {
      status = 'OUT_OF_STOCK';
    } else if (availableStock <= product.stockInfo.minThreshold) {
      status = 'LOW_STOCK';
    } else {
      status = 'IN_STOCK';
    }

    await prisma.stockInfo.update({
      where: { id: product.stockInfo.id },
      data: { status },
    });
  }
}
