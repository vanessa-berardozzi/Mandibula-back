import { z } from 'zod';

/**
 * Validations Zod partagées par les routes d'administration
 */

export const dashboardPeriodSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '12m', 'all']).optional().default('30d'),
});

export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>['period'];
