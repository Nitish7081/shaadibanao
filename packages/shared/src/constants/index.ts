/**
 * BandhanSetu Business & Domain Constants
 */

export const PROFILE_CREATED_FOR = [
  'myself',
  'son',
  'daughter',
  'brother',
  'sister',
  'relative',
] as const;
export type ProfileCreatedFor = typeof PROFILE_CREATED_FOR[number];

export const GENDER = ['male', 'female'] as const;
export type Gender = typeof GENDER[number];

export const MARITAL_STATUS = [
  'never_married',
  'divorced',
  'widowed',
  'awaiting_divorce',
] as const;
export type MaritalStatus = typeof MARITAL_STATUS[number];

export const PHOTO_PRIVACY = [
  'everyone',
  'after_interest_accepted',
  'blurred',
] as const;
export type PhotoPrivacy = typeof PHOTO_PRIVACY[number];

export const INTEREST_STATUS = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
] as const;
export type InterestStatus = typeof INTEREST_STATUS[number];

export const MEMBERSHIP_TIER = ['free', 'plus', 'premium'] as const;
export type MembershipTier = typeof MEMBERSHIP_TIER[number];

export const REPORT_REASONS = [
  'fake_photos',
  'asking_money',
  'harassment',
  'already_married',
  'misleading_details',
  'other',
] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export const APP_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
] as const;
export type AppLanguageCode = typeof APP_LANGUAGES[number]['code'];
