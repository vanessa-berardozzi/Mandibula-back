import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { addressSchema, isValidPhoneForCountry, isValidPostalCodeForCountry, updateAddressSchema } from '../validations/addressSchemas';

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

    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Champs invalides', issues: parsed.error.issues });
      return;
    }

    const { street, city, postalCode, country,firstName, lastName, phone, type } = parsed.data;

    const address = await prisma.adress.create({
      data: {
        userId,
        street,
        city,
        postalCode,
        country,
        firstName,
        lastName,
        phone,
        type,
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
    const parsed = updateAddressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Champs invalides', issues: parsed.error.issues });
      return;
    }

    // Vérifier que l'adresse appartient à l'utilisateur
    const existingAddress = await prisma.adress.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress || existingAddress.userId !== userId) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    // Revalide le téléphone/code postal avec le pays final (nouveau ou existant)
    const { street, city, postalCode, country, firstName, lastName, phone, type } = parsed.data;
    const finalCountry = country ?? existingAddress.country;
    const finalPostalCode = postalCode ?? existingAddress.postalCode;
    const finalPhone = phone ?? existingAddress.phone ?? undefined;

    if (!isValidPostalCodeForCountry(finalPostalCode, finalCountry)) {
      res.status(400).json({ error: `Format de code postal invalide pour le pays ${finalCountry}` });
      return;
    }
    if (finalPhone && !isValidPhoneForCountry(finalPhone, finalCountry)) {
      res.status(400).json({ error: `Numéro de téléphone invalide pour le pays ${finalCountry}` });
      return;
    }

    const address = await prisma.adress.update({
      where: { id: addressId },
      data: {
        ...(street && { street }),
        ...(city && { city }),
        ...(postalCode && { postalCode }),
        ...(country && { country }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(type !== undefined && { type }),
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
