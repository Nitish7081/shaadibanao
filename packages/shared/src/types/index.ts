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
  consent?: {
    agreedAt: string;
    termsVersion: string;
    privacyPolicyVersion: string;
  };
  requiresReconsent?: boolean;
  currentPrivacyPolicyVersion?: string;
  currentTermsVersion?: string;
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
  latestVerification?: {
    id: string;
    documentType: string;
    documentReferenceMasked: string;
    status: string;
    createdAt?: string;
  } | null;
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
  consentToTerms?: boolean;
  privacyPolicyVersion?: string;
  termsVersion?: string;
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
  hideProfile?: boolean;
  showLastSeen?: boolean;
  showOnlineStatus?: boolean;
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
  manglik?: string;
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
  isFreeChat?: boolean;
  planTier?: string;
  createdAt: string;
}

export type ContactExchangeStatus = 'none' | 'requested' | 'accepted' | 'declined';

export interface ContactExchangeDetails {
  status: ContactExchangeStatus;
  requestedBy?: string;
  phone?: string; // Revealed ONLY after mutual consent
  email?: string; // Revealed ONLY after mutual consent
}

export type ConversationCategory = 'matrimonial' | 'pandit_consultation' | 'booking_consultation';

export interface PanditChatEntitlementSummary {
  panditId: string;
  freeChatEnabled: boolean;
  freeMessagesUsed: number;
  freeMessageLimit: number;
  freeRemaining: number;
  paidAccessActive: boolean;
  hasActiveSubscription: boolean;
  hasPaidBooking: boolean;
  requiresPayment: boolean;
  consultationPriceInr: number;
  whatsappAvailable: boolean;
  whatsappAuthorized: boolean;
  whatsappRule: string;
  reason: string;
}

export interface ConversationItem {
  id: string;
  matchId: string;
  category?: ConversationCategory;
  panditId?: string;
  bookingId?: string;
  participant: PublicProfile;
  lastMessage?: ChatMessage;
  unreadCount: number;
  contactExchange: ContactExchangeDetails;
  isFreeChat?: boolean;
  entitlement?: PanditChatEntitlementSummary;
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
  panditId?: string;
  userId: string;
  name: string;
  profilePhoto?: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  city?: string;
  state?: string;
  bio: string;
  experienceYears: number;
  languages: string[];
  specialization?: string[];
  serviceLocations: string[];
  religiousTradition: string;
  services: PanditServiceItem[];
  availability: PanditAvailabilitySlot[];
  offersAstrology?: boolean;
  astrologyExpertise?: string[];
  consultationCharges?: number;
  bankDetails?: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    upiId?: string;
  };
  documents?: Array<{
    docType: string;
    docUrl: string;
    docName: string;
    verifiedAt?: string;
    status: string;
  }>;
  verificationStatus: 'pending' | 'under_review' | 'approved' | 'verified' | 'rejected' | 'suspended';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  requestedDocuments?: string[];
  isActive?: boolean;
  isOnline?: boolean;
  isAssigned?: boolean;
  totalEarnings?: number;
  pendingPayout?: number;
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
  panditId?: string;
  panditName?: string;
  serviceId: string;
  serviceName: string;
  ceremonyType: string;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: string;    // e.g. "10:00 AM - 01:00 PM"
  mode: 'in_person' | 'online';
  venueAddress?: string;
  city?: string;
  state?: string;
  guestCount?: number;
  languagePref?: string;
  budgetRangeInr?: string;
  priceInr: number;
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  paymentId?: string;
  orderId?: string;
  paidAmount?: number;
  commissionAmount?: number;
  panditEarnings?: number;
  isCommunityBooking?: boolean;
  communityId?: string;
  status: 'pending' | 'confirmed' | 'assigned' | 'requested' | 'accepted' | 'declined' | 'rescheduled' | 'completed' | 'cancelled';
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

/**
 * Public Legal Documents, Account Deletion & Support Contracts
 */
export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface PublicLegalDocument {
  documentType: 'privacy_policy' | 'terms_and_conditions';
  title: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  appName: string;
  tagline: string;
  contactPlaceholdersConfigured: boolean;
  developerContact: {
    legalEntityName: string;
    supportEmail: string;
    grievanceOfficerName: string;
    grievanceEmail: string;
    supportPhone: string;
    postalAddress: string;
  };
  sections: LegalSection[];
}

export interface AccountDeletionResponse {
  requestId: string;
  status: 'completed' | 'scheduled' | 'rejected';
  identifierType: 'mobile' | 'email' | 'account';
  maskedIdentifier: string;
  verificationMethod: 'jwt_session' | 'firebase_id_token' | 'otp_challenge';
  submittedAt: string;
  completedAt?: string;
  deletedDataSummary: string[];
  retainedDataNotice: string[];
  message: string;
}

export interface ContactInquiryResponse {
  ticketId: string;
  status: 'received';
  category: string;
  submittedAt: string;
  message: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookingReference?: string;
  serviceName?: string;
}

export interface PaymentVerificationInput {
  orderId: string;
  paymentId: string;
  signature?: string;
}

export interface PanditWalletResponse {
  panditId: string;
  name: string;
  totalEarnings: number;
  pendingPayout: number;
  completedBookingsCount: number;
  bankDetails?: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    upiId?: string;
  };
  withdrawals: Array<{
    id: string;
    withdrawalId: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    referenceNumber?: string;
    rejectionReason?: string;
    createdAt: string;
  }>;
}

export interface ErrorLogItem {
  id: string;
  errorId: string;
  module: string;
  errorMessage: string;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolutionStatus: 'open' | 'investigating' | 'resolved' | 'ignored';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
}

export interface DatabaseMonitoringStats {
  status: 'connected' | 'disconnected' | 'connecting' | 'unconfigured';
  host?: string;
  databaseName?: string;
  isProduction: boolean;
  pingLatencyMs: number;
  collectionsCount: number;
  collections: Array<{
    name: string;
    count: number;
  }>;
  serverTimestamp: string;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'initiating' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'busy' | 'ended' | 'failed';

export interface CallSessionItem {
  id: string;
  sessionId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName: string;
  receiverPhoto?: string;
  panditId?: string;
  panditName?: string;
  callType: CallType;
  status: CallStatus;
  isPaid?: boolean;
  amountPaid?: number;
  panditEarnings?: number;
  commissionAmount?: number;
  durationSeconds: number;
  rejectionReason?: string;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
}

export interface WebRtcSignalPayload {
  sessionId: string;
  targetUserId: string;
  type?: 'offer' | 'answer' | 'candidate' | 'mute' | 'hangup';
  sdp?: any;
  candidate?: any;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

export interface StorySlide {
  id: string;
  mediaUrl: string;
  caption?: string;
  blurred?: boolean;
  isLocked?: boolean;
  createdAt?: string;
}

export interface ProfileStoryItem {
  userId: string;
  profileId: string;
  displayName: string;
  age?: number;
  city?: string;
  isVerified?: boolean;
  avatarUrl?: string;
  avatarBlurred?: boolean;
  hasStory: boolean;
  slides: StorySlide[];
  helloSent?: boolean;
  friendRequestStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
}

export interface FreeHelloItem {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  profile?: PublicProfile;
  createdAt: string;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface FriendRequestItem {
  id: string;
  senderId: string;
  recipientId: string;
  status: FriendRequestStatus;
  note?: string;
  conversationId?: string;
  profile?: PublicProfile;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
}





