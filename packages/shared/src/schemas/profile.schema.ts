import { z } from 'zod';
import { GENDER, MARITAL_STATUS, PHOTO_PRIVACY, PROFILE_CREATED_FOR } from '../constants';

export const createProfileStep1BasicsSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  gender: z.enum(GENDER),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD')),
  maritalStatus: z.enum(MARITAL_STATUS),
  heightCm: z.number().int().min(120, 'Height must be between 120cm and 220cm').max(220),
  motherTongue: z.string().min(2, 'Mother tongue is required'),
});

export const photoUploadMetaSchema = z.object({
  photoPrivacy: z.enum(PHOTO_PRIVACY).default('everyone'),
});

export type CreateProfileStep1BasicsInput = z.infer<typeof createProfileStep1BasicsSchema>;
