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
   * Récupère ou crée le panier (utilisateur connecté ou anonyme via guestToken)
   */
  static async getOrCreateCart(
    userId: string | undefined,
    guestToken: string | undefined
  ): Promise<CartWithItems> {
    if (!userId && !guestToken) {
      throw new Error('userId ou guestToken requis');
    }

    const include = {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    } as const;

    // Recherche par userId en priorité, sinon par guestToken
    let cart: CartWithItems | null = null;

    if (userId) {
      cart = await prisma.cart.findUnique({ where: { userId }, include }) as CartWithItems | null;
      if (!cart) {
        cart = await prisma.cart.create({ data: { userId }, include }) as CartWithItems;
      }
    } else if (guestToken) {
      cart = await prisma.cart.findUnique({ where: { guestToken }, include }) as CartWithItems | null;
      if (!cart) {
        cart = await prisma.cart.create({ data: { guestToken }, include }) as CartWithItems;
      }
    }

    return cart as CartWithItems;
  }

  /**
   * Fusionne le panier guest dans le panier de l'utilisateur connecté
   * Appelé juste après la connexion/inscription
   */
  static async mergeGuestCart(guestToken: string, userId: string): Promise<void> {
    const include = {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    } as const;

    const guestCart = await prisma.cart.findUnique({ where: { guestToken }, include });
    if (!guestCart || guestCart.items.length === 0) return;

    // Récupérer ou créer le panier user
    let userCart = await prisma.cart.findUnique({ where: { userId }, include }) as CartWithItems | null;
    if (!userCart) {
      userCart = await prisma.cart.create({ data: { userId }, include }) as CartWithItems;
    }

    // Fusionner les articles guest dans le panier user
    for (const guestItem of guestCart.items) {
      const existing = userCart.items.find((i) => i.variantId === guestItem.variantId);
      const variant = await prisma.productVariant.findUnique({
        where: { id: guestItem.variantId },
        include: { product: { select: { totalStock: true } } },
      });
      if (!variant || !variant.isActive) continue;

      const availableStock = variant.product.totalStock;

      if (existing) {
        const newQty = Math.min(existing.quantity + guestItem.quantity, availableStock, 100);
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: newQty, updatedAt: new Date() },
        });
      } else {
        const qty = Math.min(guestItem.quantity, availableStock, 100);
        if (qty > 0) {
          await prisma.cartItem.create({
            data: {
              cartId: userCart.id,
              variantId: guestItem.variantId,
              quantity: qty,
              price: guestItem.price,
            },
          });
        }
      }
    }

    // Supprimer le panier guest après la fusion
    await prisma.cart.delete({ where: { id: guestCart.id } });
  }

  /**
   * Ajoute un produit au panier ou augmente sa quantité
   */
  static async addToCart(
    userId: string | undefined,
    guestToken: string | undefined,
    data: AddToCartRequest
  ) {
    const { variantId, quantity = 1 } = data;

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { totalStock: true } } },
    });

    if (!variant) throw new Error('Variante non trouvée');
    if (!variant.isActive) throw new Error('Cette variante n\'est plus disponible');
    const availableStock = variant.product.totalStock;
    if (availableStock < quantity) throw new Error(`Stock insuffisant : seulement ${availableStock} disponible(s)`);

    const cart = await this.getOrCreateCart(userId, guestToken);

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
  static async updateCartItem(
    userId: string | undefined,
    guestToken: string | undefined,
    variantId: string,
    data: UpdateCartItemRequest
  ) {
    const { quantity } = data;

    if (quantity === 0) return this.removeFromCart(userId, guestToken, variantId);

    const cart = await this.getOrCreateCart(userId, guestToken);

    const cartItem = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    if (!cartItem) throw new Error('Article non trouvé dans le panier');

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { totalStock: true } } },
    });
    if (!variant) throw new Error('Variante non trouvée');
    const availableStock = variant.product.totalStock;
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
  static async removeFromCart(
    userId: string | undefined,
    guestToken: string | undefined,
    variantId: string
  ) {
    const cart = await this.getOrCreateCart(userId, guestToken);

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
  static async getCart(
    userId: string | undefined,
    guestToken: string | undefined
  ): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId, guestToken);

    const items = cart.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      variant: {
        id: item.variant.id,
        name: item.variant.name,
        price: Number(item.variant.price),
        lotSize: item.variant.lotSize,
        availableStock: item.variant.product.totalStock,
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
      guestToken: cart.guestToken,
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
    const cart = await this.getOrCreateCart(userId, undefined);
    const errors: string[] = [];
    const validatedItems: CartItemValidated[] = [];

    // Valider chaque article
    for (const item of cart.items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: { select: { totalStock: true } } },
      });

      if (!variant) {
        errors.push(`Variante ${item.variantId} n'existe plus`);
        continue;
      }

      const available = variant.product.totalStock;
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
   * Vide complètement le panier d'un utilisateur connecté
   */
  static async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId, undefined);
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { success: true, message: 'Panier vidé' };
  }

  /**
   * Vide complètement le panier d'un visiteur anonyme
   */
  static async clearGuestCart(guestToken: string) {
    const cart = await this.getOrCreateCart(undefined, guestToken);
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { success: true, message: 'Panier vidé' };
  }
}
