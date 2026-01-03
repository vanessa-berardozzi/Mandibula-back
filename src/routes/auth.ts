import { toNodeHandler } from 'better-auth/node';
import { Router } from 'express';
import { auth } from '../lib/auth';
import { validateBody } from '../middleware/validation';
import { loginSchema, registerSchema } from '../validations/schemas';

const router = Router();

/**
 * POST /api/auth/sign-up/email
 * Inscription avec validation Zod (password fort)
 * Puis délégation à Better Auth
 */
router.post('/sign-up/email', validateBody(registerSchema), toNodeHandler(auth));

/**
 * POST /api/auth/sign-in/email
 * Connexion avec validation Zod (email valide)
 * Puis délégation à Better Auth
 */
router.post('/sign-in/email', validateBody(loginSchema), toNodeHandler(auth));

/**
 * Toutes les autres routes Better Auth (catch-all)
 * - POST /api/auth/sign-out (déconnexion)
 * - GET /api/auth/session (récupérer session)
 * - etc.
 */
router.use(toNodeHandler(auth));

export default router;
