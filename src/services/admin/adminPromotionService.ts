import { prisma } from '../../lib/prisma';

export interface PromotionDto {
  id: string;
  code: string;
  type: string;
  value: number;
  minimumOrder: number;
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  users: Array<{ id: string; name: string; email: string; orderCount: number }>;
}

export interface CreatePromotionInput {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minimumOrder?: number;
  usageLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
}

export interface UpdatePromotionInput {
  code?: string;
  type?: 'percent' | 'fixed';
  value?: number;
  minimumOrder?: number;
  usageLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export class AdminPromotionService {
  static async listAll(): Promise<PromotionDto[]> {
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orders: {
          select: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return promotions.map((p) => {
      const usersById = new Map<string, { id: string; name: string; email: string; orderCount: number }>();
      for (const order of p.orders) {
        const user = usersById.get(order.user.id);
        if (user) {
          user.orderCount += 1;
        } else {
          usersById.set(order.user.id, { ...order.user, orderCount: 1 });
        }
      }

      return {
      id: p.id,
      code: p.code,
      type: p.type,
      value: Number(p.value),
      minimumOrder: Number(p.minimumOrder),
      usageLimit: p.usageLimit,
      usageCount: p.usageCount,
      startsAt: p.startsAt?.toISOString() || null,
      endsAt: p.endsAt?.toISOString() || null,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      users: [...usersById.values()],
      };
    });
  }

  static async create(input: CreatePromotionInput): Promise<PromotionDto> {
    const promotion = await prisma.promotion.create({
      data: {
        code: input.code.toUpperCase(),
        type: input.type,
        value: input.value,
        minimumOrder: input.minimumOrder ?? 0,
        usageLimit: input.usageLimit ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        isActive: input.isActive,
      },
    });

    return {
      id: promotion.id,
      code: promotion.code,
      type: promotion.type,
      value: Number(promotion.value),
      minimumOrder: Number(promotion.minimumOrder),
      usageLimit: promotion.usageLimit,
      usageCount: promotion.usageCount,
      startsAt: promotion.startsAt?.toISOString() || null,
      endsAt: promotion.endsAt?.toISOString() || null,
      isActive: promotion.isActive,
      createdAt: promotion.createdAt.toISOString(),
      users: [],
    };
  }

  static async update(id: string, input: UpdatePromotionInput): Promise<PromotionDto> {
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        code: input.code,
        type: input.type,
        value: input.value,
        minimumOrder: input.minimumOrder,
        usageLimit: input.usageLimit,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        isActive: input.isActive,
      },
    });

    return {
      id: promotion.id,
      code: promotion.code,
      type: promotion.type,
      value: Number(promotion.value),
      minimumOrder: Number(promotion.minimumOrder),
      usageLimit: promotion.usageLimit,
      usageCount: promotion.usageCount,
      startsAt: promotion.startsAt?.toISOString() || null,
      endsAt: promotion.endsAt?.toISOString() || null,
      isActive: promotion.isActive,
      createdAt: promotion.createdAt.toISOString(),
      users: [],
    };
  }

  static async delete(id: string): Promise<void> {
    await prisma.promotion.delete({ where: { id } });
  }
}
