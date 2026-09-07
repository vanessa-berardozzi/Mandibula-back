import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { AdminCustomersQuery } from '../../validations/admin/adminCustomerSchemas';
import { AdminOrderListItem, orderInclude, toListItem } from './adminOrderService';

export interface AdminCustomerListItem {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  orderCount: number;
  cancelledCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  orders: AdminOrderListItem[];
}

export interface AdminCustomersPage {
  customers: AdminCustomerListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function buildWhere(search?: string): Prisma.UserWhereInput {
  // Pas de filtre sur le rôle : un compte admin peut aussi passer commande.
  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export class AdminCustomerService {
  /**
   * Les tris "commandes" et "dépensé" portent sur des agrégats : on calcule
   * les totaux pour tous les clients filtrés, puis on trie et pagine en mémoire.
   * Le détail des commandes n'est chargé que pour la page affichée.
   */
  static async list(query: AdminCustomersQuery): Promise<AdminCustomersPage> {
    const { page, limit, search, sort, direction } = query;
    const where = buildWhere(search);

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const [validAggregates, cancelledAggregates] = await Promise.all([
      prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: users.map((user) => user.id) }, status: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
      }),
      prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: users.map((user) => user.id) }, status: 'CANCELLED' },
        _count: { _all: true },
      }),
    ]);

    const validByUser = new Map(validAggregates.map((row) => [row.userId, row]));
    const cancelledByUser = new Map(cancelledAggregates.map((row) => [row.userId, row]));

    const rows = users.map((user) => {
      const valid = validByUser.get(user.id);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        orderCount: valid?._count._all ?? 0,
        cancelledCount: cancelledByUser.get(user.id)?._count._all ?? 0,
        totalSpent: Number(valid?._sum.total ?? 0),
        lastOrderAt: valid?._max.createdAt?.toISOString() ?? null,
      };
    });

    const way = direction === 'asc' ? 1 : -1;
    rows.sort((left, right) => {
      if (sort === 'orders') return (left.orderCount - right.orderCount) * way;
      if (sort === 'spent') return (left.totalSpent - right.totalSpent) * way;
      return left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }) * way;
    });

    const pageRows = rows.slice((page - 1) * limit, page * limit);

    const orders = pageRows.length
      ? await prisma.order.findMany({
          where: { userId: { in: pageRows.map((row) => row.id) } },
          include: orderInclude,
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const ordersByUser = new Map<string, AdminOrderListItem[]>();
    for (const order of orders) {
      const list = ordersByUser.get(order.userId) ?? [];
      list.push(toListItem(order));
      ordersByUser.set(order.userId, list);
    }

    return {
      customers: pageRows.map((row) => ({ ...row, orders: ordersByUser.get(row.id) ?? [] })),
      total: rows.length,
      page,
      limit,
      pages: Math.max(1, Math.ceil(rows.length / limit)),
    };
  }
}
