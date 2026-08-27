import { z } from 'zod';

/**
 * Validations Zod des routes d'administration des commandes
 */

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'HELD_WEATHER',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type AdminOrderStatus = (typeof ORDER_STATUSES)[number];

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(ORDER_STATUSES).optional(),
  // "open" = commandes encore en cours (ni terminées, ni annulées)
  scope: z.enum(['all', 'open']).optional().default('all'),
  search: z.string().trim().max(120).optional(),
});

export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});
