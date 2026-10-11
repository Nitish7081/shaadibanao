import { z } from 'zod';
import { GENDER, MARITAL_STATUS, PHOTO_PRIVACY } from '../constants';

export const photoItemSchema = z.object({
  id: z.string().optional(),
  url: z.string().url('Must be a valid URL').or(z.string().min(1)),
  isMain: z.boolean().default(false),
  privacy: z.enum(PHOTO_PRIVACY).default('everyone'),
  approved: z.boolean().default(true),
});

export const upsertProfileSchema = z.object({
  // 1. Basics
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  gender: z.enum(GENDER),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  maritalStatus: z.enum(MARITAL_STATUS).default('never_married'),
  heightCm: z.number().int().min(120, 'Height must be between 120cm and 220cm').max(220),
  motherTongue: z.string().trim().min(2, 'Mother tongue is required'),

  // 2. Religion & Community
  religion: z.string().trim().default('Hindu'),
  caste: z.string().trim().optional(),
  gotra: z.string().trim().optional(),
  manglik: z.enum(['yes', 'no', 'dont_know', 'anshik']).default('dont_know'),

  // 3. Location
  country: z.string().trim().default('India'),
  state: z.string().trim().default('Delhi'),
  city: z.string().trim().min(2, 'City is required'),

  // 4. Family
  familyValues: z.enum(['traditional', 'moderate', 'liberal']).default('moderate'),
  familyType: z.enum(['joint', 'nuclear']).default('nuclear'),
  fatherOccupation: z.string().trim().optional(),
  motherOccupation: z.string().trim().optional(),

  // 5. Education & Career
  education: z.string().trim().min(2, 'Education level or degree is required'),
  employedIn: z.enum(['private', 'government', 'business', 'self_employed', 'not_working']).default('private'),
  occupation: z.string().trim().min(2, 'Occupation or job title is required'),
  annualIncomeBand: z.string().trim().default('₹10L - ₹15L'),
  showIncomeBand: z.boolean().default(true),

  // 6. Photos
  photos: z.array(photoItemSchema).default([]),
  photoPrivacy: z.enum(PHOTO_PRIVACY).default('everyone'),

  // 7. About
  aboutMe: z.string().trim().max(1500, 'Bio cannot exceed 1500 characters').default(''),
});

export const partnerPreferencesSchema = z.object({
  minAge: z.number().int().min(18).max(70).default(21),
  maxAge: z.number().int().min(18).max(70).default(32),
  minHeightCm: z.number().int().min(120).max(220).default(150),
  maxHeightCm: z.number().int().min(120).max(220).default(185),
  maritalStatuses: z.array(z.enum(MARITAL_STATUS)).default(['never_married']),
  religions: z.array(z.string()).default(['Hindu']),
  motherTongues: z.array(z.string()).default([]),
  educations: z.array(z.string()).default([]),
  occupations: z.array(z.string()).default([]),
  cities: z.array(z.string()).default([]),
  manglikPreference: z.enum(['any', 'yes', 'no']).default('any'),
});

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
export type PartnerPreferencesInput = z.infer<typeof partnerPreferencesSchema>;
export type PhotoItem = z.infer<typeof photoItemSchema>;
