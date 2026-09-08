import { prisma } from '../../lib/prisma';

const BANNER_ID = 'default';

const DEFAULT_BANNER = {
  message: 'Expéditions du vivant adaptées à la météo.',
  status: 'ACTIVE',
};

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
    const banner = await prisma.siteBanner.upsert({
      where: { id: BANNER_ID },
      update: { message: input.message, status: input.status },
      create: { id: BANNER_ID, message: input.message, status: input.status },
    });

    return {
      message: banner.message,
      status: banner.status,
      updatedAt: banner.updatedAt.toISOString(),
    };
  }
}
