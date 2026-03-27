import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { sendEmail } from './email';
import { prisma } from './prisma';
/**
 * Configuration Better Auth
 * 
 * Authentification avec :
 * - Email/password (validation côté Zod dans routes/auth.ts)
 * - Sessions sécurisées (cookies HttpOnly)
 * - Support OAuth Discord et Google
 */
export const auth = betterAuth({
  // baseURL doit être l'URL publique (frontend avec proxy), pas le backend direct
  // Sinon le state OAuth ne correspond pas (state_mismatch)
  baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Configuration email/password
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // À activer en Sprint 6
    minPasswordLength: 8, // Minimum Better Auth (Zod fait validation stricte)
    maxPasswordLength: 72,
    sendResetPassword: async ({ user, url, token }, request) => {
      void sendEmail({
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe',
        text: `Cliquez sur le lien pour réinitialiser votre mot de passe : ${url}`,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      void sendEmail({
        to: user.email,
        subject: 'Votre mot de passe a été réinitialisé',
        text: `Bonjour,\n\nVotre mot de passe a été réinitialisé avec succès. Si vous n'êtes pas à l'origine de cette action, veuillez contacter le support immédiatement.`,
      });
    }
  },


 emailVerification: {
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url, token }, request) => {
            void sendEmail({
                to: user.email,
                subject: 'mail Verification',
                text: `Click the link to verify your email: ${url}`
            })
        },
        sendOnSignIn: true,
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
      // En dev local, Express utilise req.ip directement
      ipAddressHeaders: ['x-forwarded-for', 'cf-connecting-ip', 'x-real-ip'],
    },
  },

  // Rate limiting Better Auth (natif, stocké en BDD)
  rateLimit: {
    enabled: false,
    window: 900, // 15 minutes (en secondes)
    max: 5, // 5 requêtes max
    storage: 'database',
    modelName: 'rateLimit', // Nom exact du modèle Prisma
    customRules: {
      '/sign-up/email': { window: 900, max: 5 },
      '/sign-in/email': { window: 900, max: 5 },
    },
  },

  // OAuth providers
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      enabled: !!process.env.DISCORD_CLIENT_ID,
      // redirectURI auto-construit par Better Auth: baseURL/api/auth/callback/discord
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      // redirectURI auto-construit par Better Auth: baseURL/api/auth/callback/google
    },
  },

  // Configuration de session
  session: {
    expiredIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // 24 hours
    absoluteTimeout: 30 * 24 * 60 * 60, // 30 days
    cookieCache: {
      enabled: true,
    },
  },

  // Sécurité - trusted origins pour cookies et CORS
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3002',
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.BETTER_AUTH_URL || 'http://localhost:3002',
    ...(process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ],

  // Clé secrète Better Auth
  secret: process.env.BETTER_AUTH_SECRET!,
});

/**
 * Types TypeScript générés automatiquement par Better Auth
 * Utilisés dans les middlewares et routes protégées
 */
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
