import { z } from 'zod';

export const checkoutPlanSchema = z.object({
  planId: z.enum(['plus', 'premium'], {
    required_error: 'Valid paid plan tier (plus, premium) is required for checkout',
  }),
});

export type CheckoutPlanInput = z.infer<typeof checkoutPlanSchema>;
