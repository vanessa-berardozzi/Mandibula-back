import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

// Vérifier que DATABASE_URL est définie
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquante dans .env');
}

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });

/**
 * Instance Prisma Client avec adapter PostgreSQL
 * Singleton pour éviter de créer plusieurs clients en dev
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
