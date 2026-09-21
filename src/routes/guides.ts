import { Request, Response, Router } from 'express';
import { GuideService } from '../services/guideService';

const router = Router();

/**
 * GET /api/guides
 * Bibliothèque publique des guides (+ catégories disponibles).
 * Query: ?category=Bien%20débuter
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const result = await GuideService.list(
      typeof category === 'string' && category.trim() ? category.trim() : undefined
    );
    res.json(result);
  } catch (error) {
    console.error('Erreur récupération guides:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des guides' });
  }
});

/**
 * GET /api/guides/slugs
 * Liste des slugs publiés (prerendering / sitemap).
 */
router.get('/slugs', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ data: await GuideService.listSlugs() });
  } catch (error) {
    console.error('Erreur récupération slugs guides:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des guides' });
  }
});

/**
 * GET /api/guides/:slug
 * Détail complet d'un guide publié.
 */
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const guide = await GuideService.getBySlug(req.params.slug);

    if (!guide) {
      res.status(404).json({ error: 'Guide non trouvé' });
      return;
    }

    res.json(guide);
  } catch (error) {
    console.error('Erreur récupération guide:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du guide' });
  }
});

export default router;
