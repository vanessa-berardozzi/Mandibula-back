import { Prisma, PromotionType, StockMode } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { calculateDiscountedPrice } from '../utils/pricing';

const router = Router();

const variantInclude = {
  variants: {
    where: { isActive: true },
    orderBy: { lotSize: 'asc' as const },
    select: {
      id: true,
      name: true,
      lotSize: true,
      price: true,
      isActive: true,
      totalStock: true,
      reservedStock: true,
    },
  },
  category: {
    select: { id: true, name: true, slug: true, parentId: true },
  },
} as const;

/**
 * Calcule les prix après promotions et la disponibilité selon le stockMode :
 * - SHARED_POOL (animaux) : stock global partagé sur le produit, variantes = lots
 * - PER_VARIANT (accessoires) : stock distinct par variante
 */
function withAvailableStock<
  T extends {
    totalStock: number;
    reservedStock: number;
    stockMode?: StockMode;
    promotionType: PromotionType;
    promotionValue: Prisma.Decimal | null;
    variants: {
      id?: string;
      price: Prisma.Decimal | number;
      lotSize?: number;
      totalStock?: number | null;
      reservedStock?: number | null;
    }[];
  },
>(product: T) {
  const isPerVariant = product.stockMode === StockMode.PER_VARIANT;
  const promotionValue = product.promotionValue ? Number(product.promotionValue) : null;

  const variantsWithStock = product.variants.map((variant) => {
    const originalPrice = Number(variant.price);
    const price = calculateDiscountedPrice(originalPrice, product.promotionType, promotionValue);

    let variantAvailableStock = 0;
    if (isPerVariant) {
      variantAvailableStock = Math.max(0, (variant.totalStock ?? 0) - (variant.reservedStock ?? 0));
    } else {
      const globalAvailable = Math.max(0, product.totalStock - product.reservedStock);
      variantAvailableStock = Math.max(0, Math.floor(globalAvailable / (variant.lotSize || 1)));
    }

    return {
      ...(variant as Record<string, unknown>),
      availableStock: variantAvailableStock,
      price,
      originalPrice: price < originalPrice ? originalPrice : undefined,
    };
  });

  const productAvailableStock = isPerVariant
    ? variantsWithStock.reduce((acc, v) => acc + (v.availableStock || 0), 0)
    : Math.max(0, product.totalStock - product.reservedStock);

  return {
    ...product,
    availableStock: productAvailableStock,
    variants: variantsWithStock,
  };
}

/**
 * GET /api/products
 * Liste des produits avec variants et catégorie
 * Query: ?categoryId=&search=&page=1&limit=20
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { categoryId, search, page = '1', limit = '20' } = req.query;
    const pageNum  = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip     = (pageNum - 1) * limitNum;

    const where: Prisma.ProductWhereInput = {
      isPublished: true,
      variants: { some: { isActive: true } },
    };
    if (categoryId) where.categoryId = categoryId as string;
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: variantInclude,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products.map(withAvailableStock),
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

/**
 * GET /api/products/variants/batch?ids=id1,id2,...
 * Infos variante + produit pour un lot d'IDs (usage panier)
 */
router.get('/variants/batch', async (req: Request, res: Response) => {
  try {
    const { ids } = req.query;
    if (!ids || typeof ids !== 'string') {
      res.status(400).json({ error: 'Paramètre ids requis' });
      return;
    }
    const idList = ids.split(',').map((id) => id.trim()).filter((id) => id.length === 36);
    if (idList.length === 0) {
      res.json([]);
      return;
    }
    if (idList.length > 50) {
      res.status(400).json({ error: 'Maximum 50 variantes par requête' });
      return;
    }
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: idList } },
      select: {
        id: true,
        name: true,
        price: true,
        lotSize: true,
        totalStock: true,
        reservedStock: true,
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            vatCategory: true,
            stockMode: true,
            totalStock: true,
            reservedStock: true,
            promotionType: true,
            promotionValue: true,
          },
        },
      },
    });
    res.json(
      variants.map((variant) => {
        const originalPrice = Number(variant.price);
        const promotionValue = variant.product.promotionValue ? Number(variant.product.promotionValue) : null;
        const price = calculateDiscountedPrice(originalPrice, variant.product.promotionType, promotionValue);
        const isPerVariant = variant.product.stockMode === StockMode.PER_VARIANT;
        const availableStock = isPerVariant
          ? Math.max(0, (variant.totalStock ?? 0) - (variant.reservedStock ?? 0))
          : Math.max(0, Math.floor((variant.product.totalStock - variant.product.reservedStock) / (variant.lotSize || 1)));

        return {
          ...variant,
          price,
          originalPrice: price < originalPrice ? originalPrice : undefined,
          availableStock,
        };
      }),
    );
  } catch (error) {
    console.error('Error fetching variants batch:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des variantes' });
  }
});

/**
 * GET /api/products/:id
 * Détail d'un produit avec ses variantes
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: variantInclude,
    });

    if (!product) {
      res.status(404).json({ error: 'Produit non trouvé' });
      return;
    }
    if (!product.isPublished) {
      res.status(404).json({ error: 'Produit non trouvé' });
      return;
    }
    res.json(withAvailableStock(product));
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

/**
 * GET /api/products/category/:slug
 * Produits d'une catégorie par son slug.
 * Si catégorie parente → inclut aussi les produits de ses enfants.
 */
router.get('/category/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: { slug },
      include: { children: { where: { isActive: true }, select: { id: true } } },
    });
    if (!category) {
      res.status(404).json({ error: 'Catégorie non trouvée' });
      return;
    }

    // Collecte l'id de la catégorie + ceux de ses éventuels enfants
    const categoryIds = [category.id, ...category.children.map((c) => c.id)];

    const products = await prisma.product.findMany({
      where: {
        categoryId: { in: categoryIds },
        isPublished: true,
        variants: { some: { isActive: true } },
      },
      include: variantInclude,
      orderBy: { name: 'asc' },
    });

    res.json({ category, data: products.map(withAvailableStock), total: products.length });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

/**
 * GET /api/categories
 * Toutes les catégories actives, racines avec leurs enfants
 */
router.get('/categories/all', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      select: {
        id: true,
        name: true,
        slug: true,
        children: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
  }
});

export default router;
