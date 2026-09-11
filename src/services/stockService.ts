import { Prisma, StockMode } from '@prisma/client';
import { prisma } from '../lib/prisma';
type TxClient = Prisma.TransactionClient;

/**
 * Service centralisé pour la gestion du stock.
 *
 * Deux modes de stock coexistent (voir Product.stockMode) :
 *  - SHARED_POOL  : le stock vit sur Product (totalStock/reservedStock,
 *                    en INDIVIDUS). Les variantes ne sont que des tailles
 *                    de lot (lotSize) qui piochent dans le même pool.
 *                    → invertébrés.
 *  - PER_VARIANT  : le stock vit directement sur ProductVariant
 *                    (totalStock/reservedStock, en UNITÉS de variante,
 *                    lotSize toujours = 1). Chaque variante est une SKU
 *                    indépendante. → accessoires.
 *
 * Principes :
 *  - Les compteurs totalStock/reservedStock (sur Product OU ProductVariant
 *    selon le mode) sont la SOURCE DE VÉRITÉ pour la disponibilité.
 *    Ils sont toujours lus/modifiés avec un verrou de ligne Postgres
 *    (`SELECT ... FOR UPDATE`) à l'intérieur d'une transaction, ce qui
 *    élimine les races entre deux réservations concurrentes.
 *  - StockMovement n'est JAMAIS agrégé pour calculer une disponibilité.
 *    C'est un registre d'audit immuable (qui a fait quoi, quand, pourquoi),
 *    utile pour la compta et le support, mais jamais relu comme source
 *    de vérité opérationnelle.
 *  - Tout le code appelant (routes, webhook SumUp, cron d'expiration,
 *    admin) passe par ce service — jamais de logique de stock dupliquée
 *    ailleurs, et surtout jamais côté front.
 */
 
interface StockOwner {
  kind: 'PRODUCT' | 'VARIANT';
  ownerId: string; // Product.id ou ProductVariant.id, selon kind
  productId: string; // toujours le Product, pour dénormalisation StockMovement.productId
  lotSize: number; // 1 en PER_VARIANT ; lotSize réel en SHARED_POOL
}
 
interface Counters {
  totalStock: number;
  reservedStock: number;
}
 
export class StockService {
  // ───────────────────────────── Résolution du mode ─────────────────────
 
  private static async resolveOwner(
    client: TxClient | typeof prisma,
    variantId: string
  ): Promise<StockOwner> {
    const variant = await client.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: {
        productId: true,
        lotSize: true,
        product: { select: { stockMode: true } },
      },
    });
 
    if (variant.product.stockMode === StockMode.PER_VARIANT) {
      return { kind: 'VARIANT', ownerId: variantId, productId: variant.productId, lotSize: 1 };
    }
 
    return {
      kind: 'PRODUCT',
      ownerId: variant.productId,
      productId: variant.productId,
      lotSize: variant.lotSize,
    };
  }
 
  // ───────────────────────── Accès bas niveau (verrouillé) ──────────────
 
  /**
   * Lit totalStock/reservedStock avec verrou de ligne.
   * DOIT être appelé à l'intérieur d'une transaction (tx), jamais avec
   * le client prisma global, sous peine de perdre la protection du verrou.
   */
  private static async lockCounters(tx: TxClient, owner: StockOwner): Promise<Counters> {
    if (owner.kind === 'PRODUCT') {
      const rows = await tx.$queryRaw<Counters[]>`
        SELECT "totalStock", "reservedStock"
        FROM "Product"
        WHERE id = ${owner.ownerId}
        FOR UPDATE
      `;
      if (!rows[0]) throw new Error(`Produit ${owner.ownerId} introuvable`);
      return rows[0];
    }
 
    const rows = await tx.$queryRaw<{ totalStock: number | null; reservedStock: number | null }[]>`
      SELECT "totalStock", "reservedStock"
      FROM "product_variant"
      WHERE id = ${owner.ownerId}
      FOR UPDATE
    `;
    if (!rows[0]) throw new Error(`Variante ${owner.ownerId} introuvable`);
    return {
      totalStock: rows[0].totalStock ?? 0,
      reservedStock: rows[0].reservedStock ?? 0,
    };
  }
 
  private static async applyDelta(
    tx: TxClient,
    owner: StockOwner,
    field: 'reservedStock' | 'totalStock',
    delta: number
  ): Promise<Counters> {
    if (owner.kind === 'PRODUCT') {
      const updated = await tx.product.update({
        where: { id: owner.ownerId },
        data: { [field]: { increment: delta } },
        select: { totalStock: true, reservedStock: true },
      });
      return updated;
    }
 
    const updated = await tx.productVariant.update({
      where: { id: owner.ownerId },
      data: { [field]: { increment: delta } },
      select: { totalStock: true, reservedStock: true },
    });
    return { totalStock: updated.totalStock ?? 0, reservedStock: updated.reservedStock ?? 0 };
  }
 
  private static async syncStockInfoStatus(tx: TxClient, owner: StockOwner, counters: Counters) {
    const available = counters.totalStock - counters.reservedStock;
    const where = owner.kind === 'PRODUCT' ? { productId: owner.ownerId } : { variantId: owner.ownerId };
 
    await tx.stockInfo.updateMany({
      where,
      data: {
        status: available <= 0 ? 'OUT_OF_STOCK' : available <= 5 ? 'LOW_STOCK' : 'IN_STOCK',
      },
    });
  }
 
  // ───────────────────────────── Lecture publique ────────────────────────
 
  /** Stock disponible en LOTS (SHARED_POOL) ou en UNITÉS de variante (PER_VARIANT) */
  static async getAvailableStock(variantId: string): Promise<number> {
    const owner = await this.resolveOwner(prisma, variantId);
 
    if (owner.kind === 'PRODUCT') {
      const p = await prisma.product.findUnique({
        where: { id: owner.ownerId },
        select: { totalStock: true, reservedStock: true },
      });
      if (!p) return 0;
      return Math.max(0, Math.floor((p.totalStock - p.reservedStock) / owner.lotSize));
    }
 
    const v = await prisma.productVariant.findUnique({
      where: { id: owner.ownerId },
      select: { totalStock: true, reservedStock: true },
    });
    if (!v) return 0;
    return Math.max(0, (v.totalStock ?? 0) - (v.reservedStock ?? 0));
  }
 
  /** Disponibilité pour plusieurs variantes en un minimum de requêtes (catalogue) */
  static async getAvailableStocks(variantIds: string[]): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();
 
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        productId: true,
        lotSize: true,
        totalStock: true,
        reservedStock: true,
        product: { select: { stockMode: true, totalStock: true, reservedStock: true } },
      },
    });
 
    const result = new Map<string, number>();
    for (const v of variants) {
      if (v.product.stockMode === StockMode.PER_VARIANT) {
        result.set(v.id, Math.max(0, (v.totalStock ?? 0) - (v.reservedStock ?? 0)));
      } else {
        const available = v.product.totalStock - v.product.reservedStock;
        result.set(v.id, Math.max(0, Math.floor(available / v.lotSize)));
      }
    }
    return result;
  }
 
  static async isAvailable(variantId: string, quantity: number): Promise<boolean> {
    return (await this.getAvailableStock(variantId)) >= quantity;
  }
 
  // ───────────────────────────── Réservation (panier) ────────────────────
 
  /**
   * Réserve `quantity` LOTS (SHARED_POOL) ou UNITÉS (PER_VARIANT).
   * Atomique : lecture + vérification + écriture dans le même verrou de ligne.
   */
  static async reserveStock(
    variantId: string,
    quantity: number,
    cartId: string
  ): Promise<{ id: string } | null> {
    return prisma.$transaction(async (tx) => {
      const owner = await this.resolveOwner(tx, variantId);
      const units = quantity * owner.lotSize; // toujours en individus/unités réelles
 
      const counters = await this.lockCounters(tx, owner);
      const available = counters.totalStock - counters.reservedStock;
 
      if (available < units) return null; // stock insuffisant, rollback implicite
 
      const updated = await this.applyDelta(tx, owner, 'reservedStock', units);
      await this.syncStockInfoStatus(tx, owner, updated);
 
      const movement = await tx.stockMovement.create({
        data: {
          variantId,
          productId: owner.productId,
          type: 'RESERVATION',
          quantity: units,
          cartId,
          reason: 'Réservation panier',
        },
        select: { id: true },
      });
 
      return movement;
    });
  }
 
  /**
   * Change la quantité réservée pour un article de panier.
   * Applique directement le delta (pas de delete+recreate) : plus simple
   * et évite de perdre la trace de la réservation d'origine.
   */
  static async updateReservation(
    variantId: string,
    oldQuantity: number,
    newQuantity: number,
    cartId: string
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const owner = await this.resolveOwner(tx, variantId);
      const deltaUnits = (newQuantity - oldQuantity) * owner.lotSize;
 
      if (deltaUnits === 0) return true;
 
      const counters = await this.lockCounters(tx, owner);
 
      if (deltaUnits > 0) {
        const available = counters.totalStock - counters.reservedStock;
        if (available < deltaUnits) return false; // pas assez pour l'augmentation
      }
 
      const updated = await this.applyDelta(tx, owner, 'reservedStock', deltaUnits);
      await this.syncStockInfoStatus(tx, owner, updated);
 
      await tx.stockMovement.create({
        data: {
          variantId,
          productId: owner.productId,
          type: deltaUnits > 0 ? 'RESERVATION' : 'RESERVATION_RELEASE',
          quantity: Math.abs(deltaUnits),
          cartId,
          reason: 'Mise à jour quantité panier',
        },
      });
 
      return true;
    });
  }
 
  /** Libère une réservation (retrait du panier / panier vidé / expiration) */
  static async releaseReservation(variantId: string, quantity: number, cartId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const owner = await this.resolveOwner(tx, variantId);
      const units = quantity * owner.lotSize;
 
      const updated = await this.applyDelta(tx, owner, 'reservedStock', -units);
      await this.syncStockInfoStatus(tx, owner, updated);
 
      await tx.stockMovement.create({
        data: {
          variantId,
          productId: owner.productId,
          type: 'RESERVATION_RELEASE',
          quantity: units,
          cartId,
          reason: 'Libération réservation',
        },
      });
 
      return true;
    });
  }
 
  // ───────────────────────────── Cycle de vie commande ────────────────────
 
  /**
   * Confirme une commande payée : transforme les réservations en ventes.
   * reservedStock ET totalStock sont décrémentés du même montant
   * (la réservation "sort" du pool disponible pour de bon).
   */
  static async confirmOrder(orderId: string): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: {
            orderItems: {
              include: { variant: { select: { productId: true, lotSize: true } } },
            },
          },
        });
 
        if (order.paymentStatus !== 'PENDING') {
          console.warn(`Order ${orderId} n'est pas PENDING (${order.paymentStatus}), skip`);
          return;
        }
 
        for (const item of order.orderItems) {
          const owner = await this.resolveOwner(tx, item.variantId);
          const units = item.quantity * owner.lotSize;
 
          // Verrou avant décrément (au cas où plusieurs items touchent le même owner)
          await this.lockCounters(tx, owner);
 
          const updatedReserved = await this.applyDelta(tx, owner, 'reservedStock', -units);
          const updatedTotal = await this.applyDelta(tx, owner, 'totalStock', -units);
          await this.syncStockInfoStatus(tx, owner, {
            totalStock: updatedTotal.totalStock,
            reservedStock: updatedReserved.reservedStock,
          });
 
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              productId: owner.productId,
              type: 'SALE',
              quantity: units,
              orderId: order.id,
              reason: `Paiement confirmé - Commande ${order.id}`,
            },
          });
        }
 
        const banner = await tx.siteBanner.findUnique({ where: { id: 'default' }, select: { status: true } });
        const nextStatus = banner?.status === 'PAUSED' ? 'HELD_WEATHER' : 'CONFIRMED';
 
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID', status: nextStatus },
        });
 
        if (nextStatus === 'HELD_WEATHER') {
          await tx.orderWeatherHold.upsert({
            where: { orderId: order.id },
            create: { orderId: order.id, previousStatus: 'CONFIRMED' },
            update: { previousStatus: 'CONFIRMED', releasedAt: null },
          });
        }
      });
 
      return true;
    } catch (error) {
      console.error('Error confirming order:', error);
      return false;
    }
  }
 
  /** Annule une commande PENDING : libère le stock réservé */
  static async cancelOrder(orderId: string, reason: string = 'Cancelled'): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: {
            orderItems: { include: { variant: { select: { productId: true, lotSize: true } } } },
          },
        });
 
        for (const item of order.orderItems) {
          const owner = await this.resolveOwner(tx, item.variantId);
          const units = item.quantity * owner.lotSize;
 
          await this.lockCounters(tx, owner);
          const updated = await this.applyDelta(tx, owner, 'reservedStock', -units);
          await this.syncStockInfoStatus(tx, owner, updated);
 
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              productId: owner.productId,
              type: 'RESERVATION_RELEASE',
              quantity: units,
              orderId: order.id,
              reason: `Annulation: ${reason}`,
            },
          });
        }
 
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
        });
      });
 
      return true;
    } catch (error) {
      console.error('Error cancelling order:', error);
      return false;
    }
  }
}
 