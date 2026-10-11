import { z } from 'zod';

export const updateInterestStatusSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

export type UpdateInterestStatusInput = z.infer<typeof updateInterestStatusSchema>;
