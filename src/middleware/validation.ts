import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';

/**
 * Middleware de validation du body avec Zod
 * 
 * @param schema - Schéma Zod pour valider le body
 * @returns Middleware Express qui valide et transforme req.body
 * 
 * En cas d'erreur de validation :
 * - Retourne 400 avec détails des erreurs
 * - Format : { error: string, details: [{ field, message }] }
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse et transforme req.body (lowercase, trim, etc.)
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation échouée',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      // Erreur inattendue, passer au error handler
      next(error);
    }
  };
}
