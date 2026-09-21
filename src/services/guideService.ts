import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface GuideSummaryDto {
  slug: string;
  title: string;
  category: string;
  summary: string;
  readingTime: string;
  level: string;
}

export interface GuideDetailDto extends GuideSummaryDto {
  intro: string;
  updatedAt: string;
  recap: { summary: string; points: string[] } | null;
  facts: { label: string; value: string; note: string | null }[];
  sections: {
    title: string;
    paragraphs: string[];
    bullets: string[];
    warning: string | null;
  }[];
  sources: { label: string; href: string }[];
  visuals: { src: string; alt: string; caption: string | null }[];
}

const detailInclude = {
  sections: { orderBy: { position: 'asc' } },
  sources: { orderBy: { position: 'asc' } },
  facts: { orderBy: { position: 'asc' } },
  visuals: { orderBy: { position: 'asc' } },
} satisfies Prisma.GuideInclude;

type GuideWithRelations = Prisma.GuideGetPayload<{ include: typeof detailInclude }>;

function toDetailDto(guide: GuideWithRelations): GuideDetailDto {
  return {
    slug: guide.slug,
    title: guide.title,
    category: guide.category,
    summary: guide.summary,
    readingTime: guide.readingTime,
    level: guide.level,
    intro: guide.intro,
    updatedAt: guide.updatedAt.toISOString(),
    recap: guide.recapSummary
      ? { summary: guide.recapSummary, points: guide.recapPoints }
      : null,
    facts: guide.facts.map(({ label, value, note }) => ({ label, value, note })),
    sections: guide.sections.map(({ title, paragraphs, bullets, warning }) => ({
      title,
      paragraphs,
      bullets,
      warning,
    })),
    sources: guide.sources.map(({ label, href }) => ({ label, href })),
    visuals: guide.visuals.map(({ src, alt, caption }) => ({ src, alt, caption })),
  };
}

export class GuideService {
  /** Bibliothèque publique : guides publiés + catégories réellement utilisées. */
  static async list(category?: string): Promise<{
    data: GuideSummaryDto[];
    categories: string[];
    total: number;
  }> {
    const where: Prisma.GuideWhereInput = { isPublished: true };
    if (category) where.category = category;

    const [guides, published] = await Promise.all([
      prisma.guide.findMany({
        where,
        select: {
          slug: true,
          title: true,
          category: true,
          summary: true,
          readingTime: true,
          level: true,
        },
        orderBy: [{ position: 'asc' }, { title: 'asc' }],
      }),
      prisma.guide.findMany({
        where: { isPublished: true },
        select: { category: true },
        distinct: ['category'],
        orderBy: { position: 'asc' },
      }),
    ]);

    return {
      data: guides,
      categories: published.map((g) => g.category),
      total: guides.length,
    };
  }

  /** Slugs publiés, utilisés par le front pour le prerendering et le sitemap. */
  static async listSlugs(): Promise<string[]> {
    const guides = await prisma.guide.findMany({
      where: { isPublished: true },
      select: { slug: true },
      orderBy: { position: 'asc' },
    });
    return guides.map((g) => g.slug);
  }

  static async getBySlug(slug: string): Promise<GuideDetailDto | null> {
    const guide = await prisma.guide.findUnique({
      where: { slug },
      include: detailInclude,
    });

    if (!guide || !guide.isPublished) return null;
    return toDetailDto(guide);
  }
}
