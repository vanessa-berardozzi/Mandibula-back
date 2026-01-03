import { NextFunction, Request, Response } from 'express';
import type { Session, User } from '../lib/auth';
import { auth } from '../lib/auth';

// Étendre Express Request pour inclure user et session
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

/**
 * Middleware: Vérifier la session Better Auth
 * Ajoute req.user et req.session si authentifié
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Better Auth récupère la session depuis les cookies automatiquement
    const session = await auth.api.getSession({
      headers: req.headers as any,
      query: req.query as any,
      body: req.body as any,
    });

    if (!session) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    // Ajouter user et session à la requête
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Non authentifié' });
  }
}

/**
 * Middleware: Vérifier que l'utilisateur est ADMIN
 */
export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden - Admin access required' });
    return;
  }
  next();
}

/**
 * Middleware optionnel: Ajoute user/session si présent, mais ne bloque pas
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (session) {
      req.user = session.user;
      req.session = session.session;
    }

    next();
  } catch (error) {
    // Ignorer les erreurs, continuer sans auth
    next();
  }
}
