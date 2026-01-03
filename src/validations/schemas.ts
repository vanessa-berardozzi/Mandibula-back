import { z } from 'zod';

/**
 * Schema de validation pour l'inscription
 * Validation STRICTE du password conforme aux bonnes pratiques
 */
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins 1 majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins 1 minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins 1 chiffre'),
  name: z
    .string()
    .trim()
    .min(1, 'Le nom ne peut pas être vide')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .optional(),
});

/**
 * Schema de validation pour la connexion
 * Validation MINIMALE (juste email valide)
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Password requis'),
});

/**
 * Types TypeScript inférés automatiquement depuis les schémas Zod
 */
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
