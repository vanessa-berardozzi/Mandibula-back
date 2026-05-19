import { Prisma } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';

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
      stock: true,
      reservedStock: true,
      isActive: true,
    },
  },
  category: {
    select: { id: true, name: true, slug: true, parentId: true },
  },
} as const;

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
      data: products,
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
        stock: true,
        reservedStock: true,
        product: {
          select: { id: true, name: true, images: true },
        },
      },
    });
    res.json(variants);
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

    res.json(product);
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
        variants: { some: { isActive: true } },
      },
      include: variantInclude,
      orderBy: { name: 'asc' },
    });

    res.json({ category, data: products, total: products.length });
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
