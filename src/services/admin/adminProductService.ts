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
  shippingWeight: number | null;
  isPublished: boolean;
}

export interface UpdateProductVariantInput {
  id?: string;
  name: string;
  price: number;
  lotSize: number;
  isActive: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  price?: number;
  categoryId?: string;
  minThreshold?: number;
  promotionType?: PromotionType;
  promotionValue?: number | null;
  featured?: boolean;
  shippingWeight?: number | null;
  isPublished?: boolean;
  variants?: UpdateProductVariantInput[];
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
      shippingWeight: product.shippingWeight ? Number(product.shippingWeight) : null,
      isPublished: product.isPublished,
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
        ...(input.categoryId && { categoryId: input.categoryId }),
        ...(input.shippingWeight !== undefined && { shippingWeight: input.shippingWeight }),
        ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
      },
    });

    if (input.variants) {
      await this.syncVariants(productId, input.variants);
    }

    // Mise à jour du seuil de stock si fourni
    if (input.minThreshold !== undefined) {
      await prisma.stockInfo.upsert({
        where: { productId },
        create: { productId, minThreshold: input.minThreshold },
        update: { minThreshold: input.minThreshold },
      });

      // Recalcul du statut
      await this.recalculateStockStatus(productId);
    }

    // Retour du produit mis à jour
    return this.getProductDetail(productId);
  }

  /**
   * Aligne les variantes en base sur la liste envoyée par l'admin.
   * Une variante retirée est supprimée, ou simplement désactivée si elle est déjà référencée par une commande.
   */
  private static async syncVariants(
    productId: string,
    variants: UpdateProductVariantInput[],
  ): Promise<void> {
    const existing = await prisma.productVariant.findMany({
      where: { productId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((v) => v.id));
    const keptIds = new Set(
      variants.map((v) => v.id).filter((id): id is string => !!id && existingIds.has(id)),
    );

    await prisma.$transaction(async (tx) => {
      for (const variant of variants) {
        const data = {
          name: variant.name,
          price: variant.price,
          lotSize: variant.lotSize,
          isActive: variant.isActive,
        };

        if (variant.id && existingIds.has(variant.id)) {
          await tx.productVariant.update({ where: { id: variant.id }, data });
        } else {
          await tx.productVariant.create({ data: { ...data, productId } });
        }
      }

      const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
      if (removedIds.length === 0) return;

      const referenced = await tx.orderItem.findMany({
        where: { variantId: { in: removedIds } },
        select: { variantId: true },
        distinct: ['variantId'],
      });
      const referencedIds = new Set(referenced.map((item) => item.variantId));

      const deletableIds = removedIds.filter((id) => !referencedIds.has(id));
      if (deletableIds.length > 0) {
        await tx.cartItem.deleteMany({ where: { variantId: { in: deletableIds } } });
        await tx.productVariant.deleteMany({ where: { id: { in: deletableIds } } });
      }
      if (referencedIds.size > 0) {
        await tx.productVariant.updateMany({
          where: { id: { in: [...referencedIds] } },
          data: { isActive: false },
        });
      }
    });
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
