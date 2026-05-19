import { prisma } from '../lib/prisma';
import type {
    AddToCartRequest,
    CartItemValidated,
    CartResponse,
    CartValidationResponse,
    CartWithItems,
    PromoCode,
    PromoValidationResponse,
    UpdateCartItemRequest,
} from '../types/cart';

/**
 * Service métier pour la gestion du panier
 * Logique centralisée pour add, remove, update, validate
 */

const TAX_RATE = 0.2; // 20% TVA
const SHIPPING_COST = 5.99; // Frais de port fixes

/** Catalogue des codes promo actifs */
const PROMO_CODES: PromoCode[] = [
  { code: 'MANDIBULA10', description: '10% sur votre commande', type: 'percent', value: 10 },
  { code: 'BIENVENUE', description: '5€ de réduction', type: 'fixed', value: 5, minSubtotal: 20 },
  { code: 'ISOPODE20', description: '20% sur votre commande', type: 'percent', value: 20, minSubtotal: 50 },
  { code: 'LIVRAISON', description: 'Frais de port offerts', type: 'fixed', value: 5.99 },
];

export class CartService {
  /**
   * Récupère ou crée le panier de l'utilisateur
   */
  static async getOrCreateCart(userId: string): Promise<CartWithItems> {
    const include = {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    } as const;

    let cart = await prisma.cart.findUnique({ where: { userId }, include });

    if (!cart) {
      cart = await prisma.cart.create({ data: { userId }, include });
    }

    return cart as CartWithItems;
  }

  /**
   * Ajoute un produit au panier ou augmente sa quantité
   */
  static async addToCart(userId: string, data: AddToCartRequest) {
    const { variantId, quantity = 1 } = data;

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) throw new Error('Variante non trouvée');
    if (!variant.isActive) throw new Error('Cette variante n\'est plus disponible');
    const availableStock = variant.stock - variant.reservedStock;
    if (availableStock < quantity) throw new Error(`Stock insuffisant : seulement ${availableStock} disponible(s)`);

    const cart = await this.getOrCreateCart(userId);

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > availableStock) throw new Error(`Stock insuffisant : seulement ${availableStock} disponible(s)`);
      if (newQty > 100) throw new Error('Quantité maximum: 100');

      return prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty, updatedAt: new Date() },
        include: { variant: { include: { product: true } } },
      });
    }

    return prisma.cartItem.create({
      data: { cartId: cart.id, variantId, quantity, price: variant.price },
      include: { variant: { include: { product: true } } },
    });
  }

  /**
   * Met à jour la quantité d'un article
   */
  static async updateCartItem(userId: string, variantId: string, data: UpdateCartItemRequest) {
    const { quantity } = data;

    if (quantity === 0) return this.removeFromCart(userId, variantId);

    const cart = await this.getOrCreateCart(userId);

    const cartItem = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    if (!cartItem) throw new Error('Article non trouvé dans le panier');

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new Error('Variante non trouvée');
    const availableStock = variant.stock - variant.reservedStock;
    if (availableStock < quantity) throw new Error(`Stock insuffisant : seulement ${availableStock} disponible(s)`);

    return prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity, updatedAt: new Date() },
      include: { variant: { include: { product: true } } },
    });
  }

  /**
   * Supprime un article du panier
   */
  static async removeFromCart(userId: string, variantId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    if (!cartItem) throw new Error('Article non trouvé dans le panier');

    await prisma.cartItem.delete({ where: { id: cartItem.id } });
    return { success: true, message: 'Article supprimé du panier' };
  }

  /**
   * Récupère le panier formaté avec totaux
   */
  static async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId);

    const items = cart.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      variant: {
        id: item.variant.id,
        name: item.variant.name,
        price: Number(item.variant.price),
        lotSize: item.variant.lotSize,
        stock: item.variant.stock,
        reservedStock: item.variant.reservedStock,
        availableStock: item.variant.stock - item.variant.reservedStock,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          image: item.variant.product.images?.[0],
        },
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
      itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
    };
  }

  /**
   * CRITIQUE: Valide le panier avant checkout
   * Recalcule todos les prix, taxes, stocks, promo codes
   * Defense ultime contre tampering du client
   */
  static async validateCart(userId: string, promoCode?: string): Promise<CartValidationResponse> {
    const cart = await this.getOrCreateCart(userId);
    const errors: string[] = [];
    const validatedItems: CartItemValidated[] = [];

    // Valider chaque article
    for (const item of cart.items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
      });

      if (!variant) {
        errors.push(`Variante ${item.variantId} n'existe plus`);
        continue;
      }

      const available = variant.stock - variant.reservedStock;
      if (available < item.quantity) {
        errors.push(`Stock insuffisant pour "${item.variant.product.name} - ${variant.name}": ${available} disponible(s)`);
        validatedItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
          price: Number(variant.price),
          total: item.quantity * Number(variant.price),
          available: false,
        });
        continue;
      }

      const currentPrice = Number(variant.price);
      const savedPrice = Number(item.price);
      if (currentPrice !== savedPrice) {
        console.warn(`Prix différent pour ${item.variant.product.name} - ${variant.name}: ${savedPrice} -> ${currentPrice}`);
      }

      validatedItems.push({
        variantId: item.variantId,
        quantity: item.quantity,
        price: currentPrice,
        total: item.quantity * currentPrice,
        available: true,
      });
    }

    // Calculer les totaux
    const subtotal = validatedItems
      .filter((item) => item.available)
      .reduce((acc, item) => acc + item.total, 0);

    // Appliquer le code promo si fourni
    let discount = 0;
    let appliedPromoCode: string | undefined;
    if (promoCode) {
      const promoResult = this.validatePromoCode(promoCode, subtotal);
      if (promoResult.valid && promoResult.discountAmount !== undefined) {
        discount = promoResult.discountAmount;
        appliedPromoCode = promoResult.code;
      } else if (!promoResult.valid) {
        errors.push(promoResult.error ?? 'Code promo invalide');
      }
    }

    const discountedSubtotal = subtotal - discount;
    const tax = Math.round(discountedSubtotal * TAX_RATE * 100) / 100;
    const total = discountedSubtotal + tax + SHIPPING_COST;

    return {
      valid: errors.length === 0 && validatedItems.length > 0,
      items: validatedItems,
      subtotal,
      tax,
      shippingCost: SHIPPING_COST,
      discount,
      total,
      promoCode: appliedPromoCode,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Valide un code promo par rapport au sous-total
   */
  static validatePromoCode(code: string, subtotal: number): PromoValidationResponse {
    const promo = PROMO_CODES.find((p) => p.code === code.toUpperCase().trim());

    if (!promo) {
      return { valid: false, error: 'Code promo invalide ou expiré' };
    }

    if (promo.minSubtotal && subtotal < promo.minSubtotal) {
      return {
        valid: false,
        error: `Ce code nécessite un minimum d'achat de ${promo.minSubtotal.toFixed(2)}€`,
      };
    }

    const discountAmount =
      promo.type === 'percent'
        ? Math.round(subtotal * (promo.value / 100) * 100) / 100
        : Math.min(promo.value, subtotal);

    return {
      valid: true,
      code: promo.code,
      description: promo.description,
      discountType: promo.type,
      discountValue: promo.value,
      discountAmount,
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
