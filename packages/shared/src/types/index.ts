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
    name?: string;
    isProduction?: boolean;
  };
  environment: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface UserSummary {
  id: string;
  mobile?: string;
  email?: string;
  role: 'member' | 'pandit' | 'moderator' | 'admin';
  hasProfile: boolean;
  profileFor: string;
  status: 'active' | 'pending' | 'suspended';
  approvalStatus: ApprovalStatus;
  phoneVerified?: boolean;
  identityVerificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  photoApprovalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  moderationRemarks?: string;
  authProvider?: 'phone' | 'google' | 'both';
  firebaseUid?: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface PendingApprovalItem {
  id: string;
  mobile?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  status: string;
  approvalStatus: ApprovalStatus;
  phoneVerified?: boolean;
  identityVerificationStatus?: string;
  identityDocumentType?: string;
  identityDocumentReferenceMasked?: string;
  photoApprovalStatus?: string;
  rejectionReason?: string;
  moderationRemarks?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  hasProfile: boolean;
  profile?: any | null;
  preferences?: any | null;
  kundli?: any | null;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail?: string;
  adminName?: string;
  action: string;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserMobile?: string;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}

export interface FirebaseLoginInput {
  idToken: string;
  profileFor?: string;
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
  publicId?: string;
  isMain: boolean;
  privacy: 'everyone' | 'after_interest_accepted' | 'blurred';
  approved: boolean;
  /** Added (optional): signed per-size URLs for authenticated photos. Server -> client only. */
  variants?: { avatar?: string; card?: string; hero?: string };
  /** Added (optional): ISO time when the signed URLs stop working (only with token auth). */
  urlExpiresAt?: string;
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
  annualIncomeBand?: string;
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
    /** Original URL, a server-blurred URL (isLocked), or '' when a locked photo cannot be blurred. */
    url: string;
    isMain: boolean;
    isBlurred: boolean;
    /** Privacy mode that applies to this photo (added, optional for old clients). */
    privacy?: 'everyone' | 'after_interest_accepted' | 'blurred';
    /** True when the viewer may not see the original photo (added, optional for old clients). */
    isLocked?: boolean;
    /** Signed per-size URLs for authenticated photos the viewer may see (added, optional). */
    variants?: { avatar?: string; card?: string; hero?: string };
    urlExpiresAt?: string;
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

/**
 * Identity Verification Types (Aadhaar consent-based workflow)
 */
export interface IdentityVerificationConsent {
  hasConsent: boolean;
  termsVersion: string;
  timestamp: string;
}

export interface IdentityVerificationItem {
  id: string;
  userId: string;
  userDisplayName?: string;
  userMobile?: string;
  userEmail?: string;
  documentType: 'aadhaar_card' | 'passport' | 'voter_id';
  documentReferenceMasked: string; // e.g. "XXXX-XXXX-1234"
  status: 'pending' | 'verified' | 'rejected';
  consentGranted: boolean;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

/**
 * Astrology & Kundli Types
 */
export interface BirthLocation {
  name: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface KundliProfile {
  id?: string;
  userId: string;
  dateOfBirth: string;
  timeOfBirth: string;
  isApproximateTime: boolean;
  birthPlace: BirthLocation;
  rashi: string;
  nakshatra: string;
  charan?: number;
  lagna?: string;
  manglikStatus: 'non_manglik' | 'manglik' | 'anshik_manglik' | 'dont_know';
  visibility: 'private' | 'matches_only' | 'shared_with_pandit';
  chartUrl?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AshtaKootaScore {
  kootaName: string;
  sanskritName: string;
  maxPoints: number;
  obtainedPoints: number;
  description: string;
}

export interface KundliMatchingResult {
  boyRashi: string;
  boyNakshatra: string;
  girlRashi: string;
  girlNakshatra: string;
  totalScore: number; // Out of 36
  maxScore: 36;
  compatibilityVerdict: 'Excellent' | 'Good' | 'Average' | 'Not Recommended';
  manglikAnalysis: {
    boyManglik: boolean;
    girlManglik: boolean;
    manglikMatch: boolean;
    summary: string;
  };
  breakdown: AshtaKootaScore[];
}

/**
 * Pandit & Ceremony Booking Types
 */
export interface PanditServiceItem {
  serviceId: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceInr: number;
  ceremonyType: string;
}

export interface PanditAvailabilitySlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "13:00"
  isAvailable: boolean;
}

export interface PanditProfile {
  id: string;
  userId: string;
  name: string;
  profilePhoto?: string;
  phone?: string;
  email?: string;
  bio: string;
  experienceYears: number;
  languages: string[];
  serviceLocations: string[];
  religiousTradition: string;
  services: PanditServiceItem[];
  availability: PanditAvailabilitySlot[];
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  rating: number;
  reviewsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PujaBooking {
  id: string;
  bookingReference: string; // e.g. "SB-2026-8492"
  userId: string;
  userName?: string;
  userMobile?: string;
  panditId: string;
  panditName?: string;
  serviceId: string;
  serviceName: string;
  ceremonyType: string;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: string;    // e.g. "10:00 AM - 01:00 PM"
  mode: 'in_person' | 'online';
  venueAddress?: string;
  priceInr: number;
  status: 'requested' | 'accepted' | 'declined' | 'rescheduled' | 'completed' | 'cancelled';
  cancellationReason?: string;
  kundliSharedConsent: boolean;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Video/Voice Consultation Types
 */
export interface ConsultationSessionToken {
  roomId: string;
  bookingId: string;
  token: string;
  userId: string;
  role: 'host' | 'client';
  expiresInSeconds: number;
}

/**
 * Community Posts Types
 */
export interface CommunityPostItem {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  mediaUrl: string;
  caption: string;
  category: 'wedding_story' | 'culture' | 'festivals' | 'advice' | 'general';
  moderationStatus: 'pending' | 'approved' | 'rejected';
  likesCount: number;
  isLikedByMe?: boolean;
  reportsCount: number;
  createdAt: string;
}

/**
 * Comprehensive Admin Dashboard Stats (12 Metrics)
 */
export interface DashboardStatsExtended {
  totalUsers: number;
  pendingApprovals: number;
  approvedUsers: number;
  rejectedUsers: number;
  suspendedUsers: number;
  activeMemberships: number;
  pendingVerifications: number;
  openReports: number;
  // New domain metrics
  totalPandits: number;
  pendingPandits: number;
  totalBookings: number;
  pendingCommunityPosts: number;
}

