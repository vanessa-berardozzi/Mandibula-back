import { OrderStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const BANNER_ID = 'default';

const DEFAULT_BANNER = {
  message: 'Expéditions du vivant adaptées à la météo.',
  status: 'ACTIVE',
};

const WEATHER_BLOCKABLE_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'TO_PREPARE',
  'PREPARING',
  'READY',
] as const;

export interface BannerDto {
  message: string;
  status: string;
  updatedAt: string;
}

export interface UpdateBannerInput {
  message: string;
  status: 'ACTIVE' | 'PAUSED';
}

export class AdminBannerService {
  /** Le bandeau est un singleton : il est créé avec ses valeurs par défaut au premier accès. */
  static async get(): Promise<BannerDto> {
    const banner = await prisma.siteBanner.upsert({
      where: { id: BANNER_ID },
      update: {},
      create: { id: BANNER_ID, ...DEFAULT_BANNER },
    });

    return {
      message: banner.message,
      status: banner.status,
      updatedAt: banner.updatedAt.toISOString(),
    };
  }

  static async update(input: UpdateBannerInput): Promise<BannerDto> {
    const banner = await prisma.$transaction(async (transaction) => {
      const currentBanner = await transaction.siteBanner.upsert({
        where: { id: BANNER_ID },
        update: {},
        create: { id: BANNER_ID, ...DEFAULT_BANNER },
      });

      if (currentBanner.status !== 'PAUSED' && input.status === 'PAUSED') {
        const orders = await transaction.order.findMany({
          where: { status: { in: WEATHER_BLOCKABLE_STATUSES } },
          select: { id: true, status: true },
        });

        if (orders.length) {
          await transaction.orderWeatherHold.createMany({
            data: orders.map((order) => ({ orderId: order.id, previousStatus: order.status })),
            skipDuplicates: true,
          });
          await transaction.order.updateMany({
            where: { id: { in: orders.map((order) => order.id) } },
            data: { status: 'HELD_WEATHER' },
          });
        }
      }

      if (currentBanner.status === 'PAUSED' && input.status === 'ACTIVE') {
        const holds = await transaction.orderWeatherHold.findMany({
          where: { releasedAt: null },
          select: { id: true, orderId: true, previousStatus: true },
        });

        for (const hold of holds) {
          await transaction.order.updateMany({
            where: { id: hold.orderId, status: 'HELD_WEATHER' },
            data: { status: hold.previousStatus },
          });
          await transaction.orderWeatherHold.update({
            where: { id: hold.id },
            data: { releasedAt: new Date() },
          });
        }
      }

      return transaction.siteBanner.update({
        where: { id: BANNER_ID },
        data: { message: input.message, status: input.status },
      });
    });

    return {
      message: banner.message,
      status: banner.status,
      updatedAt: banner.updatedAt.toISOString(),
    };
  }
}
