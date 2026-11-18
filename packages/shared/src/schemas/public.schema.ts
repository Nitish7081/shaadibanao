import { z } from 'zod';
import { ACCOUNT_DELETION_REASONS, CONTACT_CATEGORIES } from '../constants';

const sanitizedIdentifierSchema = z
  .string()
  .trim()
  .min(3, 'Please enter your registered mobile number or email address')
  .max(160, 'Identifier is too long');

/**
 * Step 1: Request an OTP verification challenge before web account deletion
 * (Used when verifying via server-issued OTP challenge)
 */
export const accountDeletionChallengeSchema = z.object({
  identifier: sanitizedIdentifierSchema,
  // Honeypot field: bots fill hidden fields; legitimate users leave empty
  website: z.string().max(200).optional(),
});

/**
 * Step 2 / Direct Verified Submission: Submit an account deletion request.
 * Identity MUST be cryptographically verified via at least one of:
 *  - Authorization: Bearer <accessToken> (in-app authenticated session)
 *  - firebaseIdToken (Firebase Phone OTP or Google Sign-In ID token)
 *  - otp (6-digit server challenge code verified against bcrypt hash)
 */
export const accountDeletionSubmitSchema = z.object({
  identifier: sanitizedIdentifierSchema.optional(),
  firebaseIdToken: z.string().trim().min(10).max(8192).optional(),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Verification OTP must be a 6-digit numeric code')
    .optional(),
  reason: z.enum(ACCOUNT_DELETION_REASONS).default('other'),
  additionalFeedback: z.string().trim().max(1000, 'Feedback must be 1000 characters or fewer').optional(),
  confirmPermanentDeletion: z.boolean().refine((val) => val === true, {
    message: 'You must explicitly confirm permanent account deletion',
  }),
  // Honeypot spam protection
  website: z.string().max(200).optional(),
});

export const accountDeletionStatusParamsSchema = z.object({
  requestId: z
    .string()
    .trim()
    .regex(/^DEL-\d{8}-[A-Z0-9]{6,10}$/, 'Invalid deletion request reference ID format'),
});

export const publicContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your full name (at least 2 characters)')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(160, 'Email cannot exceed 160 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number')
    .optional()
    .or(z.literal('')),
  category: z.enum(CONTACT_CATEGORIES).default('general_support'),
  subject: z
    .string()
    .trim()
    .min(4, 'Subject must be at least 4 characters')
    .max(150, 'Subject cannot exceed 150 characters'),
  message: z
    .string()
    .trim()
    .min(15, 'Message must be at least 15 characters so our team can assist you properly')
    .max(3000, 'Message cannot exceed 3000 characters'),
  // Honeypot spam protection field (must remain empty)
  website: z.string().max(200).optional(),
});

export type AccountDeletionChallengeInput = z.infer<typeof accountDeletionChallengeSchema>;
export type AccountDeletionSubmitInput = z.infer<typeof accountDeletionSubmitSchema>;
export type PublicContactInput = z.infer<typeof publicContactSchema>;
