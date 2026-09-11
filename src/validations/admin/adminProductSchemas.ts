import { z } from 'zod';

const adminProductVariantSchema = z.object({
  // Les variantes créées côté client portent un id temporaire non persisté.
  id: z.string().optional(),
  name: z.string().min(1, 'Le nom de la variante est requis').max(255),
  price: z.number().min(0, 'Le prix ne peut pas être négatif'),
  lotSize: z.number().int().min(1, 'La taille du lot doit être au moins 1').default(1),
  isActive: z.boolean().default(true),
  initialStock: z.number().int().min(0, 'Le stock ne peut pas être négatif').optional(),
  totalStock: z.number().int().min(0, 'Le stock ne peut pas être négatif').optional(),
  minThreshold: z.number().int().min(0, 'Le seuil ne peut pas être négatif').optional(),
});

export const adminEditProductSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom ne doit pas dépasser 255 caractères').optional(),
  description: z.string().max(2000, 'La description ne doit pas dépasser 2000 caractères').nullable().optional(),
  price: z.number().min(0, 'Le prix ne peut pas être négatif').optional(),
  categoryId: z.string().uuid('Catégorie invalide').optional(),
  vatCategory: z.enum(['STANDARD_GOODS', 'LIVE_ANIMALS']).optional(),
  stockMode: z.enum(['SHARED_POOL', 'PER_VARIANT']).optional(),
  minThreshold: z.number().int().min(0, 'Le seuil ne peut pas être négatif').optional(),
  promotionType: z.enum(['NONE', 'PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  promotionValue: z.number().min(0, 'La valeur de promotion ne peut pas être négative').nullable().optional(),
  featured: z.boolean().optional(),
  shippingWeight: z.number().min(0, 'Le poids ne peut pas être négatif').nullable().optional(),
  isPublished: z.boolean().optional(),
  variants: z.array(adminProductVariantSchema).optional(),
});

export type AdminEditProductInput = z.infer<typeof adminEditProductSchema>;

export const adminCreateProductSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom ne doit pas dépasser 255 caractères'),
  description: z.string().max(2000, 'La description ne doit pas dépasser 2000 caractères').nullable().optional(),
  price: z.number().min(0, 'Le prix ne peut pas être négatif'),
  categoryId: z.string().uuid('Catégorie invalide'),
  images: z.array(z.string().url("L'image doit être une URL valide")).max(5).default([]),
  vatCategory: z.enum(['STANDARD_GOODS', 'LIVE_ANIMALS']).default('STANDARD_GOODS'),
  stockMode: z.enum(['SHARED_POOL', 'PER_VARIANT']).optional(),
  initialStock: z.number().int().min(0, 'Le stock ne peut pas être négatif').default(0),
  minThreshold: z.number().int().min(0, 'Le seuil ne peut pas être négatif').default(5),
  promotionType: z.enum(['NONE', 'PERCENTAGE', 'FIXED_AMOUNT']).default('NONE'),
  promotionValue: z.number().min(0, 'La valeur de promotion ne peut pas être négative').nullable().optional(),
  featured: z.boolean().default(false),
  shippingWeight: z.number().min(0, 'Le poids ne peut pas être négatif').nullable().optional(),
  isPublished: z.boolean().default(true),
  variants: z.array(adminProductVariantSchema).default([]),
});

export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;

