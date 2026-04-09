import { prisma } from '../lib/prisma';
import type {
    AddToCartRequest,
    CartItemValidated,
    CartResponse,
    CartValidationResponse,
    UpdateCartItemRequest,
} from '../types/cart';

/**
 * Service métier pour la gestion du panier
 * Logique centralisée pour add, remove, update, validate
 */

const TAX_RATE = 0.2; // 20% TVA
const SHIPPING_COST = 5.99; // Frais de port fixes

export class CartService {
  /**
   * Récupère ou crée le panier de l'utilisateur
   */
  static async getOrCreateCart(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true } } },
      });
    }

    return cart;
  }

  /**
   * Ajoute un produit au panier ou augmente sa quantité
   */
  static async addToCart(userId: string, data: AddToCartRequest) {
    const { productId, quantity = 1 } = data;

    // Vérifier que le produit existe et son stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stockInfo: true },
    });

    if (!product) {
      throw new Error('Produit non trouvé');
    }

    // Vérifier le stock
    if (!product.stockInfo || product.stockInfo.quantity < quantity) {
      throw new Error('Stock insuffisant');
    }

    const cart = await this.getOrCreateCart(userId);

    // Vérifier si l'article existe déjà dans le panier
    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (existingItem) {
      // Mettre à jour la quantité
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > 100) {
        throw new Error('Quantité maximum: 100');
      }

      const updated = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity, updatedAt: new Date() },
        include: { product: true },
      });

      return updated;
    }

    // Créer un nouvel article
    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        price: product.price,
      },
      include: { product: true },
    });

    return cartItem;
  }

  /**
   * Met à jour la quantité d'un article
   */
  static async updateCartItem(userId: string, productId: string, data: UpdateCartItemRequest) {
    const { quantity } = data;

    if (quantity === 0) {
      // Si quantité 0, supprimer l'article
      return this.removeFromCart(userId, productId);
    }

    const cart = await this.getOrCreateCart(userId);

    const cartItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
      include: { product: true },
    });

    if (!cartItem) {
      throw new Error('Article non trouvé dans le panier');
    }

    // Vérifier le stock disponible
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { stockInfo: true },
    });

    if (!product || !product.stockInfo || product.stockInfo.quantity < quantity) {
      throw new Error('Stock insuffisant pour cette quantité');
    }

    const updated = await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity, updatedAt: new Date() },
      include: { product: true },
    });

    return updated;
  }

  /**
   * Supprime un article du panier
   */
  static async removeFromCart(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (!cartItem) {
      throw new Error('Article non trouvé dans le panier');
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    return { success: true, message: 'Article supprimé du panier' };
  }

  /**
   * Récupère le panier formaté avec totaux
   */
  static async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId);

    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: Number(item.product.price),
        image: item.product.images?.[0],
      },
      quantity: item.quantity,
      price: Number(item.price),
      total: item.quantity * Number(item.price),
    }));

    const subtotal = items.reduce((acc, item) => acc + item.total, 0);

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      subtotal,
      itemCount: cart.items.length,
    };
  }

  /**
   * CRITIQUE: Valide le panier avant checkout
   * Recalcule todos les prix, taxes, stocks, promo codes
   * Defense ultime contre tampering du client
   */
  static async validateCart(userId: string): Promise<CartValidationResponse> {
    const cart = await this.getOrCreateCart(userId);
    const errors: string[] = [];
    const validatedItems: CartItemValidated[] = [];

    // Valider chaque article
    for (const item of cart.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { stockInfo: true },
      });

      // Vérifier que le produit existe toujours
      if (!product) {
        errors.push(`Produit ${item.id} n'existe plus`);
        continue;
      }

      // Vérifier le stock
      if (!product.stockInfo || product.stockInfo.quantity < item.quantity) {
        errors.push(`Stock insuffisant pour ${product.name}: ${product.stockInfo?.quantity || 0} disponible(s)`);
        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(product.price),
          total: item.quantity * Number(product.price),
          available: false,
        });
        continue;
      }

      // Recalculer le prix (défense contre tampering)
      const currentPrice = Number(product.price);
      const savedPrice = Number(item.price);

      if (currentPrice !== savedPrice) {
        console.warn(`Prix différent pour ${product.name}: ${savedPrice} -> ${currentPrice}`);
      }

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: currentPrice, // Utiliser le prix serveur
        total: item.quantity * currentPrice,
        available: true,
      });
    }

    // Calculer les totaux
    const subtotal = validatedItems
      .filter((item) => item.available)
      .reduce((acc, item) => acc + item.total, 0);

    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = subtotal + tax + SHIPPING_COST;

    return {
      valid: errors.length === 0 && validatedItems.length > 0,
      items: validatedItems,
      subtotal,
      tax,
      shippingCost: SHIPPING_COST,
      total,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Vide complètement le panier
   */
  static async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { success: true, message: 'Panier vidé' };
  }
}
