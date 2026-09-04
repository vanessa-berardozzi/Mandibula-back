import { prisma } from '../lib/prisma';

/**
 * Service centralisé pour la gestion du stock
 * - Calcule le stock disponible réel (total - réservations en attente)
 * - Crée/libère les réservations
 * - Confirme les réservations au paiement
 * 
 * Architecture:
 * - totalStock = individus physiquement présents
 * - reservedStock = bloqué par des commandes PENDING (tracé via StockMovement RESERVATION)
 * - availableStock = totalStock - SUM(RESERVATION qty)
 */
export class StockService {
  /**
   * Calcule le stock disponible en TEMPS RÉEL
   * = Product.totalStock - SUM(qty où StockMovement.type = 'RESERVATION')
   */
  static async getAvailableStock(productId: string): Promise<number> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { totalStock: true },
    });

    if (!product) return 0;

    const reservations = await prisma.stockMovement.aggregate({
      where: {
        productId,
        type: 'RESERVATION',
      },
      _sum: { quantity: true },
    });

    const reservedQty = reservations._sum.quantity ?? 0;
    return Math.max(0, product.totalStock - reservedQty);
  }

  /**
   * Récupère le stock dispo pour PLUSIEURS produits en UNE requête
   * Optimisé pour affichage catalogue
   */
  static async getAvailableStocks(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    // Récupérer tous les stocks en une requête
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, totalStock: true },
    });

    // Récupérer toutes les réservations des ces produits
    const reservations = await prisma.stockMovement.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        type: 'RESERVATION',
      },
      _sum: { quantity: true },
    });

    const reservedByProduct = new Map(
      reservations.map((r) => [r.productId, r._sum.quantity ?? 0])
    );

    const result = new Map<string, number>();
    for (const product of products) {
      const reserved = reservedByProduct.get(product.id) ?? 0;
      result.set(product.id, Math.max(0, product.totalStock - reserved));
    }

    return result;
  }

  /**
   * Vérifie si une quantité est disponible immédiatement
   */
  static async isAvailable(variantId: string, quantity: number): Promise<boolean> {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { productId: true, lotSize: true },
    });

    if (!variant) return false;

    const available = await this.getAvailableStock(variant.productId);
    return available >= quantity * variant.lotSize;
  }

  /**
   * CRÉATION D'UNE RÉSERVATION
   * Appelé quand l'utilisateur ajoute au panier
   * → Bloque le stock pour cette session de panier
   * 
   * @param variantId - ID de la variante
   * @param quantity - Nombre de LOTS à réserver (converti en individus via lotSize)
   * @param cartId - ID du panier (pour traçabilité en reason)
   * @returns l'objet StockMovement créé ou undefined si stock insuffisant
   */
  static async reserveStock(
    variantId: string,
    quantity: number,
    cartId: string
  ): Promise<{ id: string; quantity: number } | null> {
    try {
      // Récupérer la variante et le produit
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          productId: true,
          lotSize: true,
          product: { select: { totalStock: true } },
        },
      });

      if (!variant) throw new Error('Variante non trouvée');

      const units = quantity * variant.lotSize;

      // Vérifier la disponibilité
      const reserved = await prisma.stockMovement.aggregate({
        where: {
          productId: variant.productId,
          type: 'RESERVATION',
        },
        _sum: { quantity: true },
      });

      const reservedQty = reserved._sum.quantity ?? 0;
      const available = variant.product.totalStock - reservedQty;

      if (available < units) {
        return null; // Stock insuffisant
      }

      // Créer la réservation
      const movement = await prisma.stockMovement.create({
        data: {
          variantId,
          productId: variant.productId,
          type: 'RESERVATION',
          quantity: units,
          reason: `Cart ${cartId} - Réservation panier`,
        },
        select: { id: true, quantity: true },
      });

      return movement;
    } catch (error) {
      console.error('Error reserving stock:', error);
      return null;
    }
  }

  /**
   * MET À JOUR UNE RÉSERVATION EXISTANTE
   * Appelé quand on change la quantité d'un article en panier
   * 
   * Stratégie: supprimer l'ancienne RESERVATION et en créer une nouvelle
   * (évite les bugs de diff négatif)
   */
  static async updateReservation(
    variantId: string,
    oldQuantity: number,
    newQuantity: number,
    cartId: string
  ): Promise<boolean> {
    try {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          productId: true,
          lotSize: true,
          product: { select: { totalStock: true } },
        },
      });

      if (!variant) throw new Error('Variante non trouvée');

      const oldUnits = oldQuantity * variant.lotSize;
      const newUnits = newQuantity * variant.lotSize;

      // Chercher la réservation existante
      const existing = await prisma.stockMovement.findFirst({
        where: {
          variantId,
          type: 'RESERVATION',
          reason: { contains: `Cart ${cartId}` },
        },
        select: { id: true },
      });

      if (!existing) throw new Error('Réservation non trouvée');

      // Supprimer l'ancienne réservation
      await prisma.stockMovement.delete({ where: { id: existing.id } });

      // Si newQuantity = 0, on s'arrête (c'est un removeFromCart)
      if (newQuantity === 0) return true;

      // Créer la nouvelle réservation avec la nouvelle quantité
      const reserved = await prisma.stockMovement.aggregate({
        where: {
          productId: variant.productId,
          type: 'RESERVATION',
        },
        _sum: { quantity: true },
      });

      const reservedQty = reserved._sum.quantity ?? 0;
      const available = variant.product.totalStock - reservedQty;

      if (available < newUnits) {
        // Restore ancienne réservation
        await prisma.stockMovement.create({
          data: {
            variantId,
            productId: variant.productId,
            type: 'RESERVATION',
            quantity: oldUnits,
            reason: `Cart ${cartId} - Réservation panier (restored)`,
          },
        });
        return false; // Stock insuffisant pour la nouvelle quantité
      }

      // Créer la nouvelle réservation
      await prisma.stockMovement.create({
        data: {
          variantId,
          productId: variant.productId,
          type: 'RESERVATION',
          quantity: newUnits,
          reason: `Cart ${cartId} - Réservation panier (updated)`,
        },
      });

      return true;
    } catch (error) {
      console.error('Error updating reservation:', error);
      return false;
    }
  }

  /**
   * LIBÈRE UNE RÉSERVATION
   * Appelé quand on retire un article du panier ou on vide le panier
   * 
   * Crée un mouvement RESERVATION_RELEASE pour traçabilité
   */
  static async releaseReservation(
    variantId: string,
    quantity: number,
    cartId: string
  ): Promise<boolean> {
    try {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { productId: true, lotSize: true },
      });

      if (!variant) throw new Error('Variante non trouvée');

      // Chercher la réservation
      const existing = await prisma.stockMovement.findFirst({
        where: {
          variantId,
          type: 'RESERVATION',
          reason: { contains: `Cart ${cartId}` },
        },
        select: { id: true },
      });

      if (!existing) return false; // Pas de réservation trouvée

      // Supprimer la réservation
      await prisma.stockMovement.delete({ where: { id: existing.id } });

      // Créer un enregistrement de libération pour l'audit
      await prisma.stockMovement.create({
        data: {
          variantId,
          productId: variant.productId,
          type: 'RESERVATION_RELEASE',
          quantity: quantity * variant.lotSize,
          reason: `Cart ${cartId} - Libération réservation`,
        },
      });

      return true;
    } catch (error) {
      console.error('Error releasing reservation:', error);
      return false;
    }
  }

  /**
   * CONFIRME UNE COMMANDE PAYÉE
   * Convertit les réservations en SALE + décrémente Product.totalStock
   * 
   * ATOMIQUE: tout ou rien (transaction)
   */
  static async confirmOrder(orderId: string): Promise<boolean> {
    try {
      let confirmed = false;

      await prisma.$transaction(async (tx) => {
        // Récupérer la commande avec ses articles
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: {
              include: {
                variant: { select: { productId: true, lotSize: true } },
              },
            },
          },
        });

        if (!order) throw new Error('Commande non trouvée');

        // Vérifier que la commande est bien PENDING
        if (order.paymentStatus !== 'PENDING') {
          console.warn(`Order ${orderId} is not PENDING (status: ${order.paymentStatus}), skipping confirmation`);
          return;
        }

        // Créer un StockMovement SALE pour chaque article (quantité TOUJOURS en individus)
        for (const item of order.orderItems) {
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              productId: item.variant.productId,
              type: 'SALE',
              quantity: item.quantity * item.variant.lotSize,
              orderId: order.id,
              reason: `Paiement confirmé - Commande ${order.id}`,
            },
          });
        }

        // Décrémente le totalStock du produit (une fois par produit, pas par variante)
        const quantitiesByProduct = new Map<string, number>();
        for (const item of order.orderItems) {
          const current = quantitiesByProduct.get(item.variant.productId) ?? 0;
          quantitiesByProduct.set(
            item.variant.productId,
            current + item.quantity * item.variant.lotSize
          );
        }

        for (const [productId, qty] of quantitiesByProduct) {
          const updatedProduct = await tx.product.update({
            where: { id: productId },
            data: { totalStock: { decrement: qty } },
            select: { totalStock: true },
          });

          // Mettre à jour le statut du stock si nécessaire
          await tx.stockInfo.updateMany({
            where: { productId },
            data: {
              status:
                updatedProduct.totalStock <= 0
                  ? 'OUT_OF_STOCK'
                  : updatedProduct.totalStock <= 5
                    ? 'LOW_STOCK'
                    : 'IN_STOCK',
            },
          });
        }

        // Marquer la commande comme confirmée
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
          },
        });

        confirmed = true;
      });

      return confirmed;
    } catch (error) {
      console.error('Error confirming order:', error);
      return false;
    }
  }

  /**
   * ANNULE UNE COMMANDE
   * Libère les réservations associées
   */
  static async cancelOrder(orderId: string, reason: string = 'Cancelled'): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            orderItems: {
              include: {
                variant: { select: { productId: true, lotSize: true } },
              },
            },
          },
        });

        if (!order) throw new Error('Commande non trouvée');

        // Libérer les réservations et créer les mouvements de libération
        for (const item of order.orderItems) {
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              productId: item.variant.productId,
              type: 'RESERVATION_RELEASE',
              quantity: item.quantity * item.variant.lotSize,
              orderId: order.id,
              reason: `Annulation: ${reason}`,
            },
          });
        }

        // Mettre à jour le statut de la commande
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'FAILED',
            status: 'CANCELLED',
          },
        });
      });

      return true;
    } catch (error) {
      console.error('Error cancelling order:', error);
      return false;
    }
  }
}
