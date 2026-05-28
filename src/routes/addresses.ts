import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/addresses
 * Retourne les adresses de l'utilisateur connecté
 */
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const addresses = await prisma.adress.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ addresses });
  } catch (error) {
    console.error('Erreur récupération adresses:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/addresses
 * Crée une nouvelle adresse pour l'utilisateur connecté
 */
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const { street, city, state, postalCode, country } = req.body;

    if (!street || !city || !postalCode || !country) {
      res.status(400).json({ error: 'Champs obligatoires manquants (rue, ville, code postal, pays)' });
      return;
    }

    const address = await prisma.adress.create({
      data: {
        userId,
        street,
        city,
        state: state ?? '',
        postalCode,
        country,
      },
    });

    res.status(201).json({ address });
  } catch (error) {
    console.error('Erreur création adresse:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
