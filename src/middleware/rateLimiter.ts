import rateLimit from 'express-rate-limit';

/**
 * Rate limiter pour les routes d'authentification
 * 5 tentatives par 15 minutes (prévention brute force)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requêtes max par fenêtre
  message: 'Trop de tentatives, réessayez dans 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  // Désactiver en dev pour faciliter les tests
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * Rate limiter global (moins strict)
 * 100 requêtes par 15 minutes
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessayez plus tard',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
});

/**
 * Rate limiter pour API publique (strict)
 * 20 requêtes par minute
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Trop de requêtes API, réessayez dans 1 minute',
  standardHeaders: true,
  legacyHeaders: false,
});
