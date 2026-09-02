import { z } from 'zod';

export const adminEditProductSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom ne doit pas dépasser 255 caractères').optional(),
  description: z.string().max(2000, 'La description ne doit pas dépasser 2000 caractères').nullable().optional(),
  price: z.number().min(0, 'Le prix ne peut pas être négatif').optional(),
  minThreshold: z.number().int().min(0, 'Le seuil ne peut pas être négatif').optional(),
});

export type AdminEditProductInput = z.infer<typeof adminEditProductSchema>;
