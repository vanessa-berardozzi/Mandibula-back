import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Vérifier que DATABASE_URL est définie
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquante dans .env');
}

const connectionString = process.env.DATABASE_URL;

// pg (node-postgres) ne lit pas sslmode=require depuis la connection string —
// il faut passer ssl explicitement pour Neon/hébergeurs distants
const isRemote = process.env.NODE_ENV !== 'development';
const adapter = new PrismaPg({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
});

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
