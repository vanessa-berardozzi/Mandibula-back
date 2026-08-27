import { prisma } from '../../lib/prisma';
import type { DashboardPeriod } from '../../validations/admin/adminCommonSchemas';

export interface AdminTopProduct {
  productId: string;
  name: string;
  quantity: number;
}

export interface AdminDashboardStats {
  period: DashboardPeriod;
  from: string | null;
  revenue: number;
  paidOrders: number;
  averageBasket: number;
  orders: number;
  ordersToday: number;
  cancelledOrders: number;
  customers: number;
  products: number;
  lowStock: number;
  pendingOrders: number;
  readyToShip: number;
  topProducts: AdminTopProduct[];
}

const PERIOD_DAYS: Record<Exclude<DashboardPeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

function resolveFrom(period: DashboardPeriod): Date | null {
  if (period === 'all') return null;
  const from = new Date();
  from.setDate(from.getDate() - PERIOD_DAYS[period]);
  return from;
}

function resolveStartOfToday(): Date {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return startOfToday;
}

export class AdminDashboardService {
  /**
   * Top 3 produits les plus vendus (en quantité) sur la période, tous paiements confirmés.
   * OrderItem ne référence que la variante ; on résout produit + agrège par productId
   * car un même produit peut avoir plusieurs variantes vendues.
   */
  private static async getTopProducts(createdAt?: { gte: Date }): Promise<AdminTopProduct[]> {
    const grouped = await prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { order: { paymentStatus: 'PAID', createdAt } },
      _sum: { quantity: true },
    });

    if (grouped.length === 0) return [];

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: grouped.map((row) => row.variantId) } },
      select: { id: true, productId: true },
    });
    const productIdByVariant = new Map(variants.map((variant) => [variant.id, variant.productId]));

    const quantityByProduct = new Map<string, number>();
    for (const row of grouped) {
      const productId = productIdByVariant.get(row.variantId);
      if (!productId) continue;
      const quantity = row._sum.quantity ?? 0;
      quantityByProduct.set(productId, (quantityByProduct.get(productId) ?? 0) + quantity);
    }

    const top3 = [...quantityByProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const products = await prisma.product.findMany({
      where: { id: { in: top3.map(([productId]) => productId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(products.map((product) => [product.id, product.name]));

    return top3.map(([productId, quantity]) => ({
      productId,
      name: nameById.get(productId) ?? 'Produit supprimé',
      quantity,
    }));
  }

  static async getStats(period: DashboardPeriod): Promise<AdminDashboardStats> {
    const from = resolveFrom(period);
    const createdAt = from ? { gte: from } : undefined;

    const [
      paid,
      orders,
      ordersToday,
      cancelledOrders,
      customers,
      products,
      lowStock,
      pendingOrders,
      readyToShip,
      topProducts,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: 'PAID', createdAt },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.count({ where: { createdAt } }),
      prisma.order.count({ where: { createdAt: { gte: resolveStartOfToday() } } }),
      prisma.order.count({ where: { status: 'CANCELLED', createdAt } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.product.count(),
      prisma.stockInfo.count({ where: { status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] } } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'CONFIRMED' } }),
      AdminDashboardService.getTopProducts(createdAt),
    ]);

    const revenue = paid._sum.total ? Number(paid._sum.total) : 0;
    const paidOrders = paid._count._all;

    return {
      period,
      from: from ? from.toISOString() : null,
      revenue,
      paidOrders,
      averageBasket: paidOrders > 0 ? revenue / paidOrders : 0,
      orders,
      ordersToday,
      cancelledOrders,
      customers,
      products,
      lowStock,
      pendingOrders,
      readyToShip,
      topProducts,
    };
  }
}
