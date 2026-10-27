import { z } from 'zod';
import { GENDER, MARITAL_STATUS, PHOTO_PRIVACY } from '../constants';

export const MIN_MEMBER_AGE = 18;

export type DateOfBirthError = 'format' | 'invalid' | 'future' | 'underage';

export const DATE_OF_BIRTH_MESSAGES: Record<DateOfBirthError, string> = {
  format: 'Date of birth must be YYYY-MM-DD',
  invalid: 'Date of birth is not a valid calendar date',
  future: 'Date of birth cannot be in the future',
  underage: `You must be at least ${MIN_MEMBER_AGE} years old`,
};

/**
 * Validates a YYYY-MM-DD date of birth: real calendar date, not in the future,
 * and at least MIN_MEMBER_AGE years old. Returns null when valid, else the error kind.
 */
export function checkDateOfBirth(value: string, now: Date = new Date()): DateOfBirthError | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (!m) return 'format';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    y < 1 ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return 'invalid';
  }
  const ty = now.getFullYear();
  const tm = now.getMonth() + 1;
  const td = now.getDate();
  if (y > ty || (y === ty && (mo > tm || (mo === tm && d > td)))) return 'future';
  let age = ty - y;
  if (tm < mo || (tm === mo && td < d)) age -= 1;
  if (age < MIN_MEMBER_AGE) return 'underage';
  return null;
}

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
  dateOfBirth: z.string().superRefine((val, ctx) => {
    const err = checkDateOfBirth(val);
    if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: DATE_OF_BIRTH_MESSAGES[err] });
  }),
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
  annualIncomeBand: z.string().trim().optional(),
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
