import { z } from 'zod';

// Accepte les formats datetime-local (YYYY-MM-DDTHH:mm) et ISO 8601 complets
const datetimeLocalOrISO = z.string().refine(
  (val) => {
    try {
      new Date(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Format de date invalide' }
);

export const adminCreatePromotionSchema = z.object({
  code: z
    .string()
    .min(1, 'Le code est requis')
    .max(50, 'Le code ne doit pas dépasser 50 caractères')
    .toUpperCase(),
  type: z.enum(['percent', 'fixed'], { message: 'Type invalide' }),
  value: z
    .number({ message: 'La valeur doit être un nombre' })
    .min(0, 'La valeur ne peut pas être négative'),
  minimumOrder: z
    .number({ message: 'Le minimum doit être un nombre' })
    .min(0, 'Le minimum ne peut pas être négatif')
    .default(0),
  usageLimit: z
    .number({ message: 'La limite doit être un nombre' })
    .int()
    .min(1, 'La limite doit être au moins 1')
    .nullable()
    .optional()
    .transform((val) => (val ? val : null)),
  startsAt: datetimeLocalOrISO
    .nullable()
    .optional()
    .transform((val) => val || null),
  endsAt: datetimeLocalOrISO
    .nullable()
    .optional()
    .transform((val) => (val ? val : null)),
  isActive: z.boolean().default(true),
});

export const adminUpdatePromotionSchema = z.object({
  code: z
    .string()
    .min(1, 'Le code est requis')
    .max(50, 'Le code ne doit pas dépasser 50 caractères')
    .toUpperCase()
    .optional(),
  type: z.enum(['percent', 'fixed'], { message: 'Type invalide' }).optional(),
  value: z
    .number({ message: 'La valeur doit être un nombre' })
    .min(0, 'La valeur ne peut pas être négative')
    .optional(),
  minimumOrder: z
    .number({ message: 'Le minimum doit être un nombre' })
    .min(0, 'Le minimum ne peut pas être négatif')
    .optional(),
  usageLimit: z
    .number({ message: 'La limite doit être un nombre' })
    .int()
    .min(1, 'La limite doit être au moins 1')
    .nullable()
    .optional(),
  startsAt: datetimeLocalOrISO.nullable().optional(),
  endsAt: datetimeLocalOrISO
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export type AdminCreatePromotionInput = z.infer<typeof adminCreatePromotionSchema>;
export type AdminUpdatePromotionInput = z.infer<typeof adminUpdatePromotionSchema>;
