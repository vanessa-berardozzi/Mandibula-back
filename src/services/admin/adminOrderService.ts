import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { AdminOrderStatus, AdminOrdersQuery } from '../../validations/admin/adminOrderSchemas';

/** Slug de la catégorie racine regroupant tout le vivant (cf. prisma/seed/seed.ts) */
const LIVE_ROOT_CATEGORY_SLUG = 'animaux-vivants';

/** Statuts d'une commande encore en cours de traitement */
const OPEN_STATUSES: AdminOrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'HELD_WEATHER',
  'SHIPPED',
];

export interface AdminOrderItem {
  id: string;
  productName: string;
  variantName: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminOrderListItem {
  id: string;
  reference: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: AdminOrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  itemCount: number;
  containsLive: boolean;
  items: AdminOrderItem[];
}

export interface AdminOrderDetail extends AdminOrderListItem {
  subtotal: number;
  shippingCost: number;
  tax: number | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  notes: string | null;
}

export interface AdminOrdersPage {
  orders: AdminOrderListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const orderInclude = {
  user: { select: { name: true, email: true } },
  orderItems: {
    include: {
      variant: {
        select: {
          product: {
            select: {
              name: true,
              images: true,
              category: { select: { slug: true, parent: { select: { slug: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toListItem(order: OrderWithRelations): AdminOrderListItem {
  const items = order.orderItems.map((item) => ({
    id: item.id,
    productName: item.variant.product.name,
    variantName: item.variantName,
    image: item.variant.product.images[0] ?? null,
    quantity: item.quantity,
    unitPrice: Number(item.price),
    lineTotal: Number(item.price) * item.quantity,
  }));

  const containsLive = order.orderItems.some((item) => {
    const category = item.variant.product.category;
    return (
      category.parent?.slug === LIVE_ROOT_CATEGORY_SLUG || category.slug === LIVE_ROOT_CATEGORY_SLUG
    );
  });

  return {
    id: order.id,
    // Order n'a pas de numéro dédié : on dérive une référence lisible de l'uuid
    reference: order.id.slice(0, 8).toUpperCase(),
    createdAt: order.createdAt.toISOString(),
    customerName: order.user.name,
    customerEmail: order.user.email,
    total: Number(order.total),
    status: order.status as AdminOrderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    containsLive,
    items,
  };
}

function toDetail(order: OrderWithRelations): AdminOrderDetail {
  return {
    ...toListItem(order),
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    tax: order.tax === null ? null : Number(order.tax),
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    notes: order.notes,
  };
}

function buildWhere({ status, scope, search }: AdminOrdersQuery): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (scope === 'open') {
    where.status = status ?? { in: OPEN_STATUSES };
  } else if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { id: { startsWith: search.toLowerCase() } },
    ];
  }

  return where;
}

export class AdminOrderService {
  static async list(query: AdminOrdersQuery): Promise<AdminOrdersPage> {
    const { page, limit } = query;
    const where = buildWhere(query);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(toListItem),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  static async getById(orderId: string): Promise<AdminOrderDetail | null> {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    return order ? toDetail(order) : null;
  }

  static async updateStatus(
    orderId: string,
    status: AdminOrderStatus
  ): Promise<AdminOrderDetail | null> {
    const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!exists) return null;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: orderInclude,
    });
    return toDetail(order);
  }
}
