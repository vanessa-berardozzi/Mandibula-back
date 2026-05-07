import { z } from 'zod';

export const createCheckoutSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  paymentMethod: z.enum(['SUM_UP', 'PAYPAL', 'BANK_TRANSFER', 'CASH'], {
    message: 'Invalid payment method',
  }),
});

export const sumupWebhookSchema = z.object({
  id: z.string(),
  checkout_reference: z.string(),
  status: z.string(),
  transaction_id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  date: z.string().optional(),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type SumUpWebhookInput = z.infer<typeof sumupWebhookSchema>;
