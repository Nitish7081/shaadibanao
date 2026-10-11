/**
 * BandhanSetu Shared Type Definitions & API Contracts
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected' | 'connecting' | 'unconfigured';
    host?: string;
    isProduction?: boolean;
  };
  environment: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
}

export interface UserSummary {
  id: string;
  mobile: string;
  role: 'member' | 'pandit' | 'moderator' | 'admin';
  hasProfile: boolean;
  profileFor: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
}

export interface AuthResponse {
  user: UserSummary;
  tokens: AuthTokens;
  isNewUser: boolean;
}

export interface RequestOtpResponse {
  mobile: string;
  expiresInSeconds: number;
  deliveryMode: 'development_mock' | 'production_sms';
  devTestOtpHint?: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
  mobile: string;
  verificationToken?: string;
  auth?: AuthResponse;
}

export interface PhotoData {
  id?: string;
  url: string;
  isMain: boolean;
  privacy: 'everyone' | 'after_interest_accepted' | 'blurred';
  approved: boolean;
}

/**
 * Full User Profile (Owner View)
 */
export interface UserProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  age: number;
  maritalStatus: string;
  heightCm: number;
  motherTongue: string;
  religion: string;
  caste?: string;
  gotra?: string;
  manglik: string;
  country: string;
  state: string;
  city: string;
  familyValues: string;
  familyType: string;
  fatherOccupation?: string;
  motherOccupation?: string;
  education: string;
  employedIn: string;
  occupation: string;
  annualIncomeBand: string;
  showIncomeBand: boolean;
  photos: PhotoData[];
  photoPrivacy: 'everyone' | 'after_interest_accepted' | 'blurred';
  aboutMe: string;
  completenessPercent: number;
  isVerified: boolean;
  photoChecked: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Redacted Public Profile (Member View)
 * Enforces blueprint display rules:
 * - First Name + Last Initial (Priya S.)
 * - No contact details (phone, email)
 * - Photos filtered according to privacy
 * - Income displayed only if showIncomeBand is true
 */
export interface PublicProfile {
  id: string;
  displayName: string; // e.g. "Priya S."
  gender: 'male' | 'female';
  age: number;
  heightCm: number;
  maritalStatus: string;
  motherTongue: string;
  religion: string;
  caste?: string;
  city: string;
  state: string;
  education: string;
  occupation: string;
  annualIncomeBand?: string;
  photos: Array<{
    url: string;
    isMain: boolean;
    isBlurred: boolean;
  }>;
  aboutMe: string;
  isVerified: boolean;
  photoChecked: boolean;
  isContactLocked: boolean; // Always true by default until mutual consent
}

export interface PartnerPreferences {
  id?: string;
  userId: string;
  minAge: number;
  maxAge: number;
  minHeightCm: number;
  maxHeightCm: number;
  maritalStatuses: string[];
  religions: string[];
  motherTongues: string[];
  educations: string[];
  occupations: string[];
  cities: string[];
  manglikPreference: string;
}

/**
 * Match explanation: factual criteria evaluated against user partner preferences
 */
export interface MatchAlignment {
  scoreText: string; // e.g. "6 of 7 preferences match"
  matchedCount: number;
  totalEvaluated: number;
  matchedCriteria: string[]; // e.g. ["Age in range (24-29)", "Lives in Delhi NCR", ...]
}

export interface SearchResultProfile extends PublicProfile {
  matchAlignment: MatchAlignment;
  isShortlisted?: boolean;
  interestStatus?: 'none' | 'pending' | 'accepted' | 'declined' | 'withdrawn';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface ShortlistItem {
  id: string;
  userId: string;
  profileId: string;
  profile: PublicProfile;
  createdAt: string;
}

export interface InterestItem {
  id: string;
  senderId: string;
  receiverId: string;
  profile: PublicProfile; // Opposite party's public profile
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  status: MessageStatus;
  createdAt: string;
}

export type ContactExchangeStatus = 'none' | 'requested' | 'accepted' | 'declined';

export interface ContactExchangeDetails {
  status: ContactExchangeStatus;
  requestedBy?: string;
  phone?: string; // Revealed ONLY after mutual consent
  email?: string; // Revealed ONLY after mutual consent
}

export interface ConversationItem {
  id: string;
  matchId: string;
  participant: PublicProfile;
  lastMessage?: ChatMessage;
  unreadCount: number;
  contactExchange: ContactExchangeDetails;
  createdAt: string;
  updatedAt: string;
}

export type PlanTier = 'free' | 'plus' | 'premium';

export interface PlanEntitlements {
  canInitiateChat: boolean;
  contactDisclosuresLimit: number;
  isSpotlightProfile: boolean;
  prioritySearchRanking: boolean;
  relationshipAdvisorConsult: boolean;
}

export interface MembershipPlan {
  id: PlanTier;
  name: string;
  tier: PlanTier;
  priceInr: number;
  billingCycle: string; // e.g. 'Free Forever', '3 Months', '6 Months'
  tagline: string;
  features: string[];
  entitlements: PlanEntitlements;
  badgeText?: string;
  isPopular?: boolean;
}

export interface UserMembershipEntitlements extends PlanEntitlements {
  contactDisclosuresUsed: number;
  contactDisclosuresRemaining: number;
}

export interface UserMembership {
  userId: string;
  planId: PlanTier;
  planName: string;
  status: 'active' | 'expired' | 'cancelled';
  entitlements: UserMembershipEntitlements;
  startDate: string;
  expiresAt?: string;
}

export interface CheckoutResponse {
  checkoutAvailable: boolean;
  notice: string;
  planId: string;
  planName: string;
  amountInr: number;
  currency: 'INR';
  paymentGatewayStatus: 'unconfigured' | 'test_mode' | 'live';
}
