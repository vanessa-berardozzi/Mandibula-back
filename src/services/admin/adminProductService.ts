import { ProductVatCategory, PromotionType, StockMode } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface ProductDetailDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  totalStock: number;
  reservedStock: number;
  stockMode: StockMode;
  vatCategory: ProductVatCategory;
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
    totalStock?: number | null;
    reservedStock?: number | null;
    availableStock?: number;
    minThreshold?: number;
    stockStatus?: string;
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
  totalStock?: number;
  initialStock?: number;
  minThreshold?: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  price?: number;
  categoryId?: string;
  vatCategory?: ProductVatCategory;
  stockMode?: StockMode;
  minThreshold?: number;
  promotionType?: PromotionType;
  promotionValue?: number | null;
  featured?: boolean;
  shippingWeight?: number | null;
  isPublished?: boolean;
  variants?: UpdateProductVariantInput[];
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  images: string[];
  vatCategory: ProductVatCategory;
  stockMode?: StockMode;
  initialStock: number;
  minThreshold: number;
  promotionType: PromotionType;
  promotionValue?: number | null;
  featured: boolean;
  shippingWeight?: number | null;
  isPublished: boolean;
  variants: UpdateProductVariantInput[];
}

export class AdminProductService {
  /**
   * Crée un produit avec ses variantes et son suivi de stock selon son mode (SHARED_POOL ou PER_VARIANT).
   */
  static async createProduct(input: CreateProductInput): Promise<ProductDetailDto | null> {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) return null;

    // Détermination du mode : par défaut SHARED_POOL pour animaux vivants, PER_VARIANT pour autres biens
    const stockMode: StockMode =
      input.stockMode ??
      (input.vatCategory === ProductVatCategory.LIVE_ANIMALS
        ? StockMode.SHARED_POOL
        : StockMode.PER_VARIANT);

    const isPerVariant = stockMode === StockMode.PER_VARIANT;

    // Pour PER_VARIANT, le totalStock du produit est la somme des stocks des variantes
    const totalProductStock = isPerVariant
      ? input.variants.reduce((acc, v) => acc + (v.initialStock ?? v.totalStock ?? 0), 0)
      : input.initialStock;

    const createdProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          price: input.price,
          categoryId: input.categoryId,
          images: input.images,
          vatCategory: input.vatCategory,
          stockMode,
          totalStock: totalProductStock,
          reservedStock: 0,
          promotionType: input.promotionType,
          promotionValue: input.promotionType === 'NONE' ? null : (input.promotionValue ?? null),
          featured: input.featured,
          shippingWeight: input.shippingWeight ?? null,
          isPublished: input.isPublished,
          stockInfo: {
            create: { minThreshold: input.minThreshold },
          },
        },
        select: { id: true },
      });

      // Création des variantes
      for (const variant of input.variants) {
        const variantInitialStock = isPerVariant
          ? (variant.initialStock ?? variant.totalStock ?? 0)
          : null;

        const createdVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            name: variant.name,
            price: variant.price,
            lotSize: isPerVariant ? 1 : (variant.lotSize || 1),
            isActive: variant.isActive ?? true,
            totalStock: variantInitialStock,
            reservedStock: isPerVariant ? 0 : null,
          },
        });

        if (isPerVariant) {
          const vMinThreshold = variant.minThreshold ?? input.minThreshold ?? 5;
          const vStock = variantInitialStock ?? 0;
          const vStatus =
            vStock === 0 ? 'OUT_OF_STOCK' : vStock <= vMinThreshold ? 'LOW_STOCK' : 'IN_STOCK';

          await tx.stockInfo.create({
            data: {
              variantId: createdVariant.id,
              minThreshold: vMinThreshold,
              status: vStatus,
            },
          });

          if (vStock > 0) {
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                variantId: createdVariant.id,
                type: 'ENTRY',
                quantity: vStock,
                reason: 'Stock initial à la création',
              },
            });
          }
        }
      }

      // Si SHARED_POOL et stock initial > 0, mouvement de stock initial sur la première variante
      if (!isPerVariant && input.initialStock > 0) {
        const firstVariant = await tx.productVariant.findFirst({
          where: { productId: product.id },
          select: { id: true },
        });

        if (firstVariant) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              variantId: firstVariant.id,
              type: 'ENTRY',
              quantity: input.initialStock,
              reason: 'Stock initial à la création',
            },
          });
        }
      }

      return product;
    });

    await this.recalculateStockStatus(createdProduct.id);

    return this.getProductDetail(createdProduct.id);
  }

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
          },
        },
      },
    });

    if (!product) return null;

    const isPerVariant = product.stockMode === StockMode.PER_VARIANT;

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      images: product.images,
      totalStock: product.totalStock,
      reservedStock: product.reservedStock,
      stockMode: product.stockMode,
      vatCategory: product.vatCategory,
      category: {
        id: product.category.id,
        name: product.category.name,
      },
      variants: product.variants.map((v) => {
        const vTotal = v.totalStock ?? 0;
        const vReserved = v.reservedStock ?? 0;
        const vAvailable = Math.max(0, vTotal - vReserved);
        return {
          id: v.id,
          name: v.name,
          price: Number(v.price),
          lotSize: v.lotSize,
          isActive: v.isActive,
          totalStock: v.totalStock,
          reservedStock: v.reservedStock,
          availableStock: isPerVariant ? vAvailable : undefined,
          minThreshold: v.stockInfos?.minThreshold,
          stockStatus: v.stockInfos?.status,
        };
      }),
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
        ...(input.vatCategory && { vatCategory: input.vatCategory }),
        ...(input.stockMode && { stockMode: input.stockMode }),
        ...(input.shippingWeight !== undefined && { shippingWeight: input.shippingWeight }),
        ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
      },
    });

    const targetStockMode = input.stockMode ?? product.stockMode;

    if (input.variants) {
      await this.syncVariants(productId, targetStockMode, input.variants, input.minThreshold);
    }

    // Mise à jour du seuil de stock si fourni
    if (input.minThreshold !== undefined) {
      await prisma.stockInfo.upsert({
        where: { productId },
        create: { productId, minThreshold: input.minThreshold },
        update: { minThreshold: input.minThreshold },
      });
    }

    // Recalcul du statut
    await this.recalculateStockStatus(productId);

    // Retour du produit mis à jour
    return this.getProductDetail(productId);
  }

  /**
   * Aligne les variantes en base sur la liste envoyée par l'admin.
   * Une variante retirée est supprimée, ou simplement désactivée si elle est déjà référencée par une commande.
   */
  private static async syncVariants(
    productId: string,
    stockMode: StockMode,
    variants: UpdateProductVariantInput[],
    defaultMinThreshold?: number
  ): Promise<void> {
    const isPerVariant = stockMode === StockMode.PER_VARIANT;

    const existing = await prisma.productVariant.findMany({
      where: { productId },
      select: { id: true, totalStock: true, reservedStock: true },
    });
    const existingMap = new Map(existing.map((v) => [v.id, v]));
    const keptIds = new Set(
      variants.map((v) => v.id).filter((id): id is string => !!id && existingMap.has(id)),
    );

    await prisma.$transaction(async (tx) => {
      for (const variant of variants) {
        if (variant.id && existingMap.has(variant.id)) {
          const existingVar = existingMap.get(variant.id)!;
          const data: {
            name: string;
            price: number;
            lotSize: number;
            isActive: boolean;
            totalStock?: number | null;
          } = {
            name: variant.name,
            price: variant.price,
            lotSize: isPerVariant ? 1 : (variant.lotSize || 1),
            isActive: variant.isActive,
          };

          if (isPerVariant) {
            if (variant.totalStock !== undefined) {
              data.totalStock = variant.totalStock;
            } else if (existingVar.totalStock === null) {
              data.totalStock = variant.initialStock ?? 0;
            }
          }

          await tx.productVariant.update({ where: { id: variant.id }, data });

          if (isPerVariant) {
            const vMinThreshold = variant.minThreshold ?? defaultMinThreshold ?? 5;
            const currentTotal = data.totalStock ?? existingVar.totalStock ?? 0;
            const currentReserved = existingVar.reservedStock ?? 0;
            const available = currentTotal - currentReserved;
            const status = available <= 0 ? 'OUT_OF_STOCK' : available <= vMinThreshold ? 'LOW_STOCK' : 'IN_STOCK';

            await tx.stockInfo.upsert({
              where: { variantId: variant.id },
              create: { variantId: variant.id, minThreshold: vMinThreshold, status },
              update: { minThreshold: vMinThreshold, status },
            });
          }
        } else {
          // Nouvelle variante
          const vStock = isPerVariant ? (variant.initialStock ?? variant.totalStock ?? 0) : null;
          const created = await tx.productVariant.create({
            data: {
              productId,
              name: variant.name,
              price: variant.price,
              lotSize: isPerVariant ? 1 : (variant.lotSize || 1),
              isActive: variant.isActive ?? true,
              totalStock: vStock,
              reservedStock: isPerVariant ? 0 : null,
            },
          });

          if (isPerVariant) {
            const vMinThreshold = variant.minThreshold ?? defaultMinThreshold ?? 5;
            const status = (vStock ?? 0) <= 0 ? 'OUT_OF_STOCK' : (vStock ?? 0) <= vMinThreshold ? 'LOW_STOCK' : 'IN_STOCK';

            await tx.stockInfo.create({
              data: {
                variantId: created.id,
                minThreshold: vMinThreshold,
                status,
              },
            });

            if ((vStock ?? 0) > 0) {
              await tx.stockMovement.create({
                data: {
                  productId,
                  variantId: created.id,
                  type: 'ENTRY',
                  quantity: vStock!,
                  reason: 'Stock initial variante créée',
                },
              });
            }
          }
        }
      }

      const removedIds = [...existingMap.keys()].filter((id) => !keptIds.has(id));
      if (removedIds.length > 0) {
        const referenced = await tx.orderItem.findMany({
          where: { variantId: { in: removedIds } },
          select: { variantId: true },
          distinct: ['variantId'],
        });
        const referencedIds = new Set(referenced.map((item) => item.variantId));

        const deletableIds = removedIds.filter((id) => !referencedIds.has(id));
        if (deletableIds.length > 0) {
          await tx.cartItem.deleteMany({ where: { variantId: { in: deletableIds } } });
          await tx.stockInfo.deleteMany({ where: { variantId: { in: deletableIds } } });
          await tx.productVariant.deleteMany({ where: { id: { in: deletableIds } } });
        }
        if (referencedIds.size > 0) {
          await tx.productVariant.updateMany({
            where: { id: { in: [...referencedIds] } },
            data: { isActive: false },
          });
        }
      }

      // Si PER_VARIANT, recalculer le totalStock et reservedStock du Product comme la somme des variantes
      if (isPerVariant) {
        const allVars = await tx.productVariant.findMany({
          where: { productId },
          select: { totalStock: true, reservedStock: true },
        });
        const sumTotal = allVars.reduce((acc, v) => acc + (v.totalStock ?? 0), 0);
        const sumReserved = allVars.reduce((acc, v) => acc + (v.reservedStock ?? 0), 0);

        await tx.product.update({
          where: { id: productId },
          data: { totalStock: sumTotal, reservedStock: sumReserved },
        });
      }
    });
  }

  /**
   * Recalcule le statut de stock d'un produit (et de ses variantes en PER_VARIANT)
   */
  static async recalculateStockStatus(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        stockInfo: true,
        variants: {
          include: { stockInfos: true },
        },
      },
    });

    if (!product) return;

    if (product.stockMode === StockMode.PER_VARIANT) {
      let sumTotal = 0;
      let sumReserved = 0;
      let allOutOfStock = true;
      let anyLowStock = false;

      for (const variant of product.variants) {
        const vTotal = variant.totalStock ?? 0;
        const vReserved = variant.reservedStock ?? 0;
        sumTotal += vTotal;
        sumReserved += vReserved;

        const vAvailable = Math.max(0, vTotal - vReserved);
        const vThreshold = variant.stockInfos?.minThreshold ?? product.stockInfo?.minThreshold ?? 5;

        const vStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' =
          vAvailable <= 0 ? 'OUT_OF_STOCK' : vAvailable <= vThreshold ? 'LOW_STOCK' : 'IN_STOCK';

        if (vStatus !== 'OUT_OF_STOCK') allOutOfStock = false;
        if (vStatus === 'LOW_STOCK') anyLowStock = true;

        if (variant.stockInfos) {
          await prisma.stockInfo.update({
            where: { id: variant.stockInfos.id },
            data: { status: vStatus },
          });
        } else {
          await prisma.stockInfo.create({
            data: { variantId: variant.id, minThreshold: vThreshold, status: vStatus },
          });
        }
      }

      await prisma.product.update({
        where: { id: productId },
        data: { totalStock: sumTotal, reservedStock: sumReserved },
      });

      const productStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' =
        allOutOfStock || product.variants.length === 0
          ? 'OUT_OF_STOCK'
          : anyLowStock
            ? 'LOW_STOCK'
            : 'IN_STOCK';

      if (product.stockInfo) {
        await prisma.stockInfo.update({
          where: { id: product.stockInfo.id },
          data: { status: productStatus },
        });
      }
    } else {
      // SHARED_POOL
      if (!product.stockInfo) return;

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
}
