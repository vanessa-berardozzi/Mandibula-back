import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma';

/**
 * Configuration Better Auth
 * 
 * Authentification avec :
 * - Email/password (validation côté Zod dans routes/auth.ts)
 * - Sessions sécurisées (cookies HttpOnly)
 * - Support OAuth Discord (optionnel)
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Configuration email/password
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // À activer en Sprint 6
    minPasswordLength: 8, // Minimum Better Auth (Zod fait validation stricte)
    maxPasswordLength: 72, // Limite bcrypt
  },

  // Champs custom User (role pour admin)
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'USER',
      },
    },
  },

  // Configuration avancée
  advanced: {
    ipAddress: {
      // Headers pour récupérer l'IP réelle (derrière proxy/Cloudflare)
      ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
    },
  },

  // Rate limiting Better Auth (en plus de express-rate-limit)
  rateLimit: {
    window: 10, // 10 secondes
    max: 100, // 100 requêtes max
  },

  // OAuth providers (Discord pour l'instant)
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      enabled: !!process.env.DISCORD_CLIENT_ID,
    },
  },

  // Sécurité
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3002',
    'http://localhost:3000', // Frontend React/Next.js
    'http://localhost:3002', // Backend
  ],
});

/**
 * Types TypeScript générés automatiquement par Better Auth
 * Utilisés dans les middlewares et routes protégées
 */
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;

export default auth;
