import { z } from 'zod';

/**
 * Validations Zod pour les opérations du panier
 */

export const addToCartSchema = z.object({
  variantId: z.string().uuid('ID variante invalide'),
  quantity: z.number().int().min(1, 'Quantité minimum: 1').max(100, 'Quantité maximum: 100').optional().default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantité minimum: 1').max(100, 'Quantité maximum: 100'),
});

export const cartItemIdSchema = z.object({
  variantId: z.string().uuid('ID variante invalide'),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CartItemIdInput = z.infer<typeof cartItemIdSchema>;
