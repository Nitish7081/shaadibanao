import { z } from 'zod';
import { PROFILE_CREATED_FOR } from '../constants';

// Phone number regex for 10-digit Indian mobile numbers (+91 optional in UI, sanitized on server)
export const mobileNumberSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number');

export const requestOtpSchema = z.object({
  mobile: mobileNumberSchema,
});

export const verifyOtpSchema = z.object({
  mobile: mobileNumberSchema,
  otp: z
    .string()
    .trim()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain numbers only'),
});

export const registerSchema = z.object({
  mobile: mobileNumberSchema,
  verificationToken: z.string().min(1, 'Verification token from verified OTP is required'),
  profileFor: z.enum(PROFILE_CREATED_FOR).default('myself'),
  consentToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must explicitly agree to the Privacy Policy and Terms & Conditions to create an account',
  }),
  privacyPolicyVersion: z.string().trim().min(1).max(32).optional(),
  termsVersion: z.string().trim().min(1).max(32).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const firebaseLoginSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
  profileFor: z.enum(PROFILE_CREATED_FOR).optional(),
  consentToTerms: z.boolean().optional(),
  privacyPolicyVersion: z.string().trim().min(1).max(32).optional(),
  termsVersion: z.string().trim().min(1).max(32).optional(),
});

export const recordConsentSchema = z.object({
  consentToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must explicitly accept the Privacy Policy and Terms & Conditions',
  }),
  privacyPolicyVersion: z.string().trim().min(1).max(32).optional(),
  termsVersion: z.string().trim().min(1).max(32).optional(),
  source: z.enum(['mobile_registration', 'mobile_reconsent', 'web_consent']).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type FirebaseLoginSchemaInput = z.infer<typeof firebaseLoginSchema>;
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;

