/* eslint-disable @typescript-eslint/no-namespace */
import type { NextFunction, Request, Response } from 'express';
import { auth } from '../lib/auth';

// Étendre Express Request pour inclure user et session Better Auth
 
declare global {
  namespace Express {
    interface Request {
      user?: typeof auth.$Infer.Session.user;
      session?: typeof auth.$Infer.Session.session;
    }
  }
}

/**
 * Middleware d'authentification Better Auth (2026)
 * Vérifie la session via cookies httpOnly et bloque si non authentifié
 * @throws 401 si session invalide ou absente
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      res.status(401).json({ 
        error: 'Non authentifié',
        code: 'UNAUTHORIZED' 
      });
      return;
    }

    // Attacher user et session à la requête
    req.user = session.user;
    req.session = session.session;
    
    next();
  } catch (error) {
    console.error('[Auth Middleware] Erreur:', error);
    res.status(401).json({ 
      error: 'Session invalide',
      code: 'INVALID_SESSION' 
    });
  }
};

/**
 * Middleware de vérification du rôle ADMIN
 * Doit être utilisé APRÈS authMiddleware
 * @throws 403 si l'utilisateur n'est pas admin
 */
export const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ 
      error: 'Non authentifié',
      code: 'UNAUTHORIZED' 
    });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ 
      error: 'Accès refusé - Droits administrateur requis',
      code: 'FORBIDDEN' 
    });
    return;
  }
  
  next();
};

/**
 * Middleware optionnel qui ajoute user/session si disponible
 * Ne bloque jamais la requête (utile pour routes publiques avec auth optionnelle)
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    
    if (session) {
      req.user = session.user;
      req.session = session.session;
    }
  } catch {
    // Ignorer silencieusement les erreurs d'auth
  }
  
  next();
};
