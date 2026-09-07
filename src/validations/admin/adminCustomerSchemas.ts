import { z } from 'zod';

export const CUSTOMER_SORT_KEYS = ['name', 'orders', 'spent'] as const;

export const adminCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(CUSTOMER_SORT_KEYS).optional().default('name'),
  direction: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type AdminCustomersQuery = z.infer<typeof adminCustomersQuerySchema>;
