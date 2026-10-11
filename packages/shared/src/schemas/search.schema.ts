import { z } from 'zod';
import { GENDER, MARITAL_STATUS } from '../constants';

export const searchFilterSchema = z.object({
  minAge: z.coerce.number().int().min(18).max(70).optional(),
  maxAge: z.coerce.number().int().min(18).max(70).optional(),
  minHeightCm: z.coerce.number().int().min(120).max(220).optional(),
  maxHeightCm: z.coerce.number().int().min(120).max(220).optional(),
  gender: z.enum(GENDER).optional(),
  maritalStatus: z.enum(MARITAL_STATUS).optional(),
  religion: z.string().trim().optional(),
  motherTongue: z.string().trim().optional(),
  city: z.string().trim().optional(),
  education: z.string().trim().optional(),
  occupation: z.string().trim().optional(),
  manglik: z.enum(['yes', 'no', 'dont_know', 'anshik']).optional(),
  verifiedOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['best_match', 'newest', 'age_asc', 'age_desc']).default('best_match'),
});

export type SearchFilterInput = z.infer<typeof searchFilterSchema>;
