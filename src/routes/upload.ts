import { Request, Response, Router } from 'express';
import multer from 'multer';
import { uploadToCloudinary } from '../lib/cloudinary';
import { authMiddleware } from '../middleware/auth';
import { UserService } from '../services/userService';

const router = Router();

// Stockage mémoire : le fichier ne touche jamais le disque du serveur
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo max
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Seules les images sont acceptées'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/upload/avatar
 *
 * Flux :
 * 1. Reçoit le fichier via multer (mémoire)
 * 2. Upload vers Cloudinary avec overwrite + invalidation CDN
 *    → même public_id par user : pas de doublon, ancienne photo écrasée
 * 3. Persiste l'URL dans `pictureProfile` (jamais dans `image` — réservé aux providers OAuth)
 * 4. Retourne { url } — le frontend appelle ensuite authClient.updateUser() pour rafraîchir la session
 */
router.post(
  '/avatar',
  authMiddleware,
  upload.single('avatar'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Aucun fichier fourni' });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Non authentifié' });
        return;
      }

      // Upload Cloudinary — même public_id = overwrite silencieux, invalidation CDN incluse
      const { secure_url } = await uploadToCloudinary(req.file.buffer, {
        public_id: `user_${userId}`,
        folder: 'mandibula/avatars',
      });

      // Persiste dans pictureProfile uniquement
      // `image` reste intact pour ne pas écraser la photo du provider OAuth
      await UserService.updateUser(userId, { pictureProfile: secure_url });

      res.json({ url: secure_url });
    } catch (error) {
      console.error('[Upload Avatar]', error);
      res.status(500).json({ error: "Erreur lors de l'upload de l'image" });
    }
  }
);

export default router;
