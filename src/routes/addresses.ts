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

    const { street, city, postalCode, country, name, fullName } = req.body;

    if (!street || !city || !postalCode || !country) {
      res.status(400).json({ error: 'Champs obligatoires manquants (rue, ville, code postal, pays)' });
      return;
    }

    const address = await prisma.adress.create({
      data: {
        userId,
        street,
        city,
        postalCode,
        country,
        name: name || undefined,
        fullName: fullName || undefined,
      },
    });

    res.status(201).json({ address });
  } catch (error) {
    console.error('Erreur création adresse:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/addresses/:addressId
 * Met à jour une adresse existante
 */
router.put('/:addressId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const { addressId } = req.params;
    const { street, city, postalCode, country, name, fullName } = req.body;

    // Vérifier que l'adresse appartient à l'utilisateur
    const existingAddress = await prisma.adress.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.userId !== userId) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const address = await prisma.adress.update({
      where: { id: addressId },
      data: {
        ...(street && { street }),
        ...(city && { city }),
        ...(postalCode && { postalCode }),
        ...(country && { country }),
        ...(name !== undefined && { name }),
        ...(fullName !== undefined && { fullName }),
      },
    });

    res.json({ address });
  } catch (error) {
    console.error('Erreur mise à jour adresse:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/addresses/:addressId
 * Supprime une adresse
 */
router.delete('/:addressId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const { addressId } = req.params;

    // Vérifier que l'adresse appartient à l'utilisateur
    const existingAddress = await prisma.adress.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.userId !== userId) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    await prisma.adress.delete({
      where: { id: addressId },
    });

    res.json({ message: 'Adresse supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression adresse:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
