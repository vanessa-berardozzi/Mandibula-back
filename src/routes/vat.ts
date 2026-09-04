import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  InvalidCartError,
  UnsupportedCountryError,
  VatNumberValidationError,
  VatRateNotFoundError,
} from '../services/vat/vat.errors';
import { calculateVat } from '../services/vat/vatCalculationService';
import { validateVatNumber } from '../services/vat/viesService';
import type { VatCalculationRequest } from '../types/vat.ts';

export const vatRouter = Router();

/**
 * POST /api/vat/calculate
 * Body: VatCalculationRequest
 *
 * Retourne le détail TVA ligne par ligne + totaux, pour affichage au
 * checkout. À appeler à chaque changement de panier/pays/statut B2B.
 */
vatRouter.post('/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as VatCalculationRequest;
    const result = await calculateVat(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vat/validate-number
 * Body: { vatNumber: string }
 *
 * Vérification standalone d'un numéro de TVA (ex: dès la saisie du champ
 * dans le formulaire, avant même de calculer la commande), pour donner un
 * retour immédiat à l'utilisateur pro.
 */
vatRouter.post('/validate-number', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vatNumber } = req.body as { vatNumber?: string };
    if (!vatNumber) {
      throw new InvalidCartError('Le champ vatNumber est requis.');
    }
    const result = await validateVatNumber(vatNumber);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Middleware d'erreurs dédié à ce router — à monter juste après
 * `app.use('/api/vat', vatRouter)` dans votre app Express, ou à fusionner
 * avec votre error handler global s'il gère déjà ce pattern.
 */
export function vatErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (
    err instanceof InvalidCartError ||
    err instanceof UnsupportedCountryError ||
    err instanceof VatNumberValidationError
  ) {
    res.status(400).json({ error: err.name, message: err.message });
    return;
  }
  if (err instanceof VatRateNotFoundError) {
    // Erreur de configuration côté serveur, pas une erreur client.
    res.status(500).json({ error: err.name, message: err.message });
    return;
  }
  next(err);
}
