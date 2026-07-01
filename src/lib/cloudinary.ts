import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

// TODO: Ajouter dans votre .env (backend) :
// CLOUDINARY_CLOUD_NAME=votre_cloud_name
// CLOUDINARY_API_KEY=votre_api_key
// CLOUDINARY_API_SECRET=votre_api_secret
// (disponibles sur https://console.cloudinary.com → Dashboard)

export { cloudinary };

/**
 * Upload un buffer image vers Cloudinary.
 * - overwrite: true  → même public_id = pas de doublon, remplace l'ancienne photo
 * - invalidate: true → purge le cache CDN Cloudinary après overwrite
 * Retourne une URL HTTPS courte — jamais de base64 dans le JWT/cookie.
 *
 * La config Cloudinary est initialisée ici (lazy) plutôt qu'au niveau module,
 * pour garantir que dotenv a chargé les variables avant utilisation.
 */
export function uploadToCloudinary(
  buffer: Buffer,
  options: { folder?: string; public_id?: string } = {}
): Promise<{ secure_url: string; public_id: string }> {
  // Initialisation lazy : garantit que process.env est peuplé par dotenv
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? 'mandibula/avatars',
        public_id: options.public_id,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'));
        } else {
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        }
      }
    );
    stream.end(buffer);
  });
}
