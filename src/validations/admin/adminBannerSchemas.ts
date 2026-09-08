import { z } from 'zod';

export const adminUpdateBannerSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Le message est requis')
    .max(300, 'Le message ne doit pas dépasser 300 caractères'),
  status: z.enum(['ACTIVE', 'PAUSED'], { message: 'Statut invalide' }).default('ACTIVE'),
});

export type AdminUpdateBannerInput = z.infer<typeof adminUpdateBannerSchema>;
