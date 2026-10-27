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
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
] as const;
export type AppLanguageCode = typeof APP_LANGUAGES[number]['code'];

export const IDENTITY_VERIFICATION_STATUS = [
  'none',
  'pending',
  'verified',
  'rejected',
] as const;
export type IdentityVerificationStatus = typeof IDENTITY_VERIFICATION_STATUS[number];

export const PHOTO_APPROVAL_STATUS = [
  'none',
  'pending',
  'approved',
  'rejected',
] as const;
export type PhotoApprovalStatus = typeof PHOTO_APPROVAL_STATUS[number];

export const CEREMONY_TYPES = [
  'wedding',
  'engagement',
  'griha_pravesh',
  'satyanarayan_puja',
  'rudrabhishek',
  'navagraha_shanti',
  'kundli_milan',
  'namkaran',
  'other_puja',
] as const;
export type CeremonyType = typeof CEREMONY_TYPES[number];

export const BOOKING_STATUS = [
  'requested',
  'accepted',
  'declined',
  'rescheduled',
  'completed',
  'cancelled',
] as const;
export type BookingStatus = typeof BOOKING_STATUS[number];

export const PANDIT_VERIFICATION_STATUS = [
  'pending',
  'verified',
  'rejected',
] as const;
export type PanditVerificationStatus = typeof PANDIT_VERIFICATION_STATUS[number];

export const CONSULTATION_STATUS = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'missed',
] as const;
export type ConsultationStatus = typeof CONSULTATION_STATUS[number];

export const COMMUNITY_CATEGORY = [
  'wedding_story',
  'culture',
  'festivals',
  'advice',
  'general',
] as const;
export type CommunityCategory = typeof COMMUNITY_CATEGORY[number];

export const COMMUNITY_MODERATION_STATUS = [
  'pending',
  'approved',
  'rejected',
] as const;
export type CommunityModerationStatus = typeof COMMUNITY_MODERATION_STATUS[number];

export const RASHI_LIST = [
  'Mesh (Aries)',
  'Vrishabh (Taurus)',
  'Mithun (Gemini)',
  'Kark (Cancer)',
  'Simha (Leo)',
  'Kanya (Virgo)',
  'Tula (Libra)',
  'Vrishchik (Scorpio)',
  'Dhanu (Sagittarius)',
  'Makar (Capricorn)',
  'Kumbh (Aquarius)',
  'Meen (Pisces)',
] as const;

export const NAKSHATRA_LIST = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
] as const;

