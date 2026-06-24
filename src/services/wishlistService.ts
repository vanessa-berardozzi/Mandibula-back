import { prisma } from '../lib/prisma';

export class WishlistService {
  static async getWishlist(userId: string) {
    return prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: { select: { name: true, slug: true } },
            variants: {
              where: { isActive: true },
              orderBy: { lotSize: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async add(userId: string, productId: string) {
    // Vérifie que le produit existe
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Produit introuvable');

    return prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
  }

  static async remove(userId: string, productId: string) {
    await prisma.wishlist.deleteMany({ where: { userId, productId } });
  }

  static async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const entry = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    return !!entry;
  }
}
