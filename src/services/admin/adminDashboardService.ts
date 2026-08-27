import { prisma } from '../../lib/prisma';
import type { DashboardPeriod } from '../../validations/admin/adminCommonSchemas';

export interface AdminDashboardStats {
  period: DashboardPeriod;
  from: string | null;
  revenue: number;
  paidOrders: number;
  averageBasket: number;
  orders: number;
  cancelledOrders: number;
  customers: number;
  products: number;
  lowStock: number;
  pendingOrders: number;
  readyToShip: number;
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

export class AdminDashboardService {
  static async getStats(period: DashboardPeriod): Promise<AdminDashboardStats> {
    const from = resolveFrom(period);
    const createdAt = from ? { gte: from } : undefined;

    const [paid, orders, cancelledOrders, customers, products, lowStock, pendingOrders, readyToShip] =
      await Promise.all([
        prisma.order.aggregate({
          where: { paymentStatus: 'PAID', createdAt },
          _sum: { total: true },
          _count: { _all: true },
        }),
        prisma.order.count({ where: { createdAt } }),
        prisma.order.count({ where: { status: 'CANCELLED', createdAt } }),
        prisma.user.count({ where: { role: 'USER' } }),
        prisma.product.count(),
        prisma.stockInfo.count({ where: { status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] } } }),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.order.count({ where: { status: 'CONFIRMED' } }),
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
      cancelledOrders,
      customers,
      products,
      lowStock,
      pendingOrders,
      readyToShip,
    };
  }
}
