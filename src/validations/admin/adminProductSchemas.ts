import { z } from 'zod';

const adminProductVariantSchema = z.object({
  // Les variantes créées côté client portent un id temporaire non persisté.
  id: z.string().optional(),
  name: z.string().min(1, 'Le nom de la variante est requis').max(255),
  price: z.number().min(0, 'Le prix ne peut pas être négatif'),
  lotSize: z.number().int().min(1, 'La taille du lot doit être au moins 1').default(1),
  isActive: z.boolean().default(true),
});

export const adminEditProductSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom ne doit pas dépasser 255 caractères').optional(),
  description: z.string().max(2000, 'La description ne doit pas dépasser 2000 caractères').nullable().optional(),
  price: z.number().min(0, 'Le prix ne peut pas être négatif').optional(),
  categoryId: z.string().uuid('Catégorie invalide').optional(),
  minThreshold: z.number().int().min(0, 'Le seuil ne peut pas être négatif').optional(),
  promotionType: z.enum(['NONE', 'PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  promotionValue: z.number().min(0, 'La valeur de promotion ne peut pas être négative').nullable().optional(),
  featured: z.boolean().optional(),
  shippingWeight: z.number().min(0, 'Le poids ne peut pas être négatif').nullable().optional(),
  isPublished: z.boolean().optional(),
  variants: z.array(adminProductVariantSchema).optional(),
});

export type AdminEditProductInput = z.infer<typeof adminEditProductSchema>;
