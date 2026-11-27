import mongoose from 'mongoose';
import crypto from 'crypto';
import { PanditModel, IPandit } from '../models/pandit.model';
import { UserModel } from '../models/user.model';
import { BookingModel } from '../models/booking.model';
import { AuditLogModel } from '../models/audit-log.model';
import { NotificationModel } from '../models/notification.model';
import { WithdrawalModel } from '../models/withdrawal.model';
import { PaymentModel } from '../models/payment.model';
import { CallSessionModel } from '../models/call-session.model';
import { SystemSettingsModel } from '../models/system-settings.model';
import { PanditChatEntitlementModel } from '../models/pandit-chat-entitlement.model';
import { MembershipService } from './membership.service';
import { SocketService } from '../socket/socket.service';
import { AppError } from '../middleware/errorHandler';
import { readCache } from '../utils/cache';

export class PanditService {
  /**
   * Normalize an explicitly supplied WhatsApp number without inventing or substituting any number.
   */
  static normalizeWhatsappNumber(raw?: string): string | undefined {
    if (raw === undefined || raw === null) return undefined;
    const cleaned = String(raw).replace(/[\s\-().]/g, '').trim();
    if (!cleaned) return undefined;
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      throw new AppError(
        'Please provide a valid 10 to 15 digit WhatsApp number (with optional + country code).',
        400,
        'INVALID_WHATSAPP_NUMBER'
      );
    }
    return cleaned;
  }

  /**
   * Format a WhatsApp number for wa.me URL (digits only). Never called unless already present & authorized.
   */
  private static formatWhatsappDigits(raw: string): string {
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return `91${digits}`;
    }
    return digits;
  }

  /**
   * Public sanitized Pandit DTO (never leaks phone, email, whatsappNumber, bankDetails, documents).
   */
  static toPublicPanditDTO(p: any) {
    return {
      id: p._id ? p._id.toString() : p.id,
      _id: p._id ? p._id.toString() : p.id,
      panditId: p.panditId || (p._id ? `PND-${p._id.toString().slice(-4).toUpperCase()}` : ''),
      userId: p.userId ? p.userId.toString() : '',
      name: p.name,
      profilePhoto: p.profilePhoto,
      city: p.city || p.address?.city || '',
      state: p.state || p.address?.state || '',
      bio: p.bio,
      experienceYears: p.experienceYears,
      languages: p.languages,
      specialization: p.specialization,
      serviceLocations: p.serviceLocations,
      religiousTradition: p.religiousTradition,
      services: p.services,
      availability: p.availability,
      offersAstrology: p.offersAstrology ?? true,
      astrologyExpertise: p.astrologyExpertise || ['Kundli Milan', 'Horoscope Analysis'],
      consultationCharges: p.consultationCharges ?? 501,
      isOnline: p.isOnline ?? true,
      isChatAvailable: p.isChatAvailable ?? true,
      isAudioCallAvailable: p.isAudioCallAvailable ?? true,
      isVideoCallAvailable: p.isVideoCallAvailable ?? true,
      verificationStatus: p.verificationStatus,
      isActive: p.isActive ?? true,
      rating: p.rating,
      reviewsCount: p.reviewsCount,
      whatsappAvailable: Boolean(p.whatsappNumber && String(p.whatsappNumber).trim() && p.whatsappEnabled !== false),
    };
  }

  /**
   * Look up an approved & active Pandit by _id, panditId, or userId.
   */
  static async findApprovedPanditOrThrow(idOrPanditId: string): Promise<IPandit> {
    let pandit: any = null;
    if (mongoose.Types.ObjectId.isValid(idOrPanditId)) {
      pandit = await PanditModel.findOne({
        $or: [{ _id: idOrPanditId }, { userId: idOrPanditId }],
      });
    } else {
      pandit = await PanditModel.findOne({ panditId: idOrPanditId });
    }
    if (!pandit) {
      throw new AppError('Pandit profile not found.', 404, 'PANDIT_NOT_FOUND');
    }
    if (!['approved', 'verified'].includes(pandit.verificationStatus) || pandit.isActive === false) {
      throw new AppError('Pandit is not currently approved or active.', 403, 'PANDIT_UNAVAILABLE');
    }
    return pandit;
  }

  /**
   * Generate a unique Pandit ID (e.g. PND-2026-1042)
   */
  private static async generateUniquePanditId(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempts = 0; attempts < 10; attempts++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidateId = `PND-${year}-${rand}`;
      const existing = await PanditModel.findOne({ panditId: candidateId }).select('_id');
      if (!existing) {
        return candidateId;
      }
    }
    return `PND-${year}-${Date.now().toString().slice(-4)}`;
  }

  /**
   * Register as a Pandit
   */
  static async registerPandit(userId: string, data: any) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found.');

    // Check if already registered
    let existingPandit = await PanditModel.findOne({
      $or: [
        { userId },
        ...(user.mobile ? [{ phone: user.mobile }] : []),
        ...(data.phone ? [{ phone: data.phone }] : []),
      ],
    });
    if (existingPandit) {
      throw new AppError('A Pandit profile already exists for this mobile number or account.', 409, 'PANDIT_ALREADY_EXISTS');
    }

    const defaultServices = data.services && data.services.length > 0 ? data.services : [
      {
        serviceId: 'srv_kundli_milan',
        name: 'Kundli Milan & Horoscope Consultation',
        description: 'Vedic chart analysis and 36 Guna matchmaking consultation',
        durationMinutes: 45,
        priceInr: 1100,
        ceremonyType: 'kundli_milan',
      },
      {
        serviceId: 'srv_satyanarayan',
        name: 'Shree Satyanarayan Maha Puja',
        description: 'Complete sacred katha, havan and aarti',
        durationMinutes: 120,
        priceInr: 3100,
        ceremonyType: 'satyanarayan_puja',
      },
      {
        serviceId: 'srv_griha_pravesh',
        name: 'Griha Pravesh & Vastu Shanti',
        description: 'Housewarming ceremony with Navagraha puja and Havan',
        durationMinutes: 180,
        priceInr: 5100,
        ceremonyType: 'griha_pravesh',
      },
      {
        serviceId: 'srv_vivah_sanskar',
        name: 'Vedic Vivah Sanskar (Wedding Ceremony)',
        description: 'Traditional Vedic wedding rites, Jayamala, Saptapadi, Sindoor daan',
        durationMinutes: 240,
        priceInr: 15100,
        ceremonyType: 'wedding',
      },
    ];

    const defaultAvailability = data.availability && data.availability.length > 0 ? data.availability : [
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 6, startTime: '08:00', endTime: '20:00', isAvailable: true },
      { dayOfWeek: 0, startTime: '08:00', endTime: '20:00', isAvailable: true },
    ];

    const panditId = await this.generateUniquePanditId();
    const normalizedWhatsapp = data.whatsappNumber
      ? this.normalizeWhatsappNumber(data.whatsappNumber)
      : undefined;

    const pandit = await PanditModel.create({
      panditId,
      userId: user._id,
      name: data.name?.trim() || user.displayName || 'Vedic Pandit Ji',
      profilePhoto: data.profilePhoto || user.avatarUrl,
      phone: data.phone?.trim() || user.mobile,
      whatsappNumber: normalizedWhatsapp,
      whatsappEnabled: data.whatsappEnabled !== undefined ? Boolean(data.whatsappEnabled) : true,
      email: data.email?.trim() || user.email,
      gender: data.gender || 'male',
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      address: {
        street: data.address?.street || data.street || '',
        city: data.address?.city || data.city || 'Delhi NCR',
        state: data.address?.state || data.state || 'Delhi',
        pincode: data.address?.pincode || data.pincode || '',
      },
      city: data.city || data.address?.city || 'Delhi NCR',
      state: data.state || data.address?.state || 'Delhi',
      bio: data.bio?.trim() || 'Experienced Vedic Pandit performing authentic Sanatan rituals and Vedic astrology guidance.',
      experienceYears: Number(data.experienceYears) || 7,
      languages: data.languages && data.languages.length ? data.languages : ['Hindi', 'Sanskrit'],
      specialization: data.specialization && data.specialization.length
        ? data.specialization
        : ['Vedic Sanatan Puja', 'Vivah Sanskar', 'Kundli Milan', 'Astrology'],
      serviceLocations: data.serviceLocations && data.serviceLocations.length ? data.serviceLocations : ['Delhi NCR', 'Online'],
      religiousTradition: data.religiousTradition || 'Vedic Sanatan',
      services: defaultServices,
      availability: defaultAvailability,
      offersAstrology: data.offersAstrology !== undefined ? Boolean(data.offersAstrology) : true,
      astrologyExpertise: data.astrologyExpertise && data.astrologyExpertise.length
        ? data.astrologyExpertise
        : ['Kundli Milan', 'Horoscope Analysis', 'Career & Marriage Guidance', 'Guna Milan'],
      consultationCharges: Number(data.consultationCharges) || 501,
      bankDetails: {
        accountHolderName: data.bankDetails?.accountHolderName || data.name || '',
        accountNumber: data.bankDetails?.accountNumber || '',
        ifscCode: data.bankDetails?.ifscCode || '',
        bankName: data.bankDetails?.bankName || '',
        upiId: data.bankDetails?.upiId || '',
      },
      documents: Array.isArray(data.documents) ? data.documents : [],
      verificationStatus: 'pending',
      isActive: true,
      isOnline: true,
      isAssigned: false,
      totalEarnings: 0,
      pendingPayout: 0,
      rating: 5.0,
      reviewsCount: 0,
    });

    // Update user role to pandit
    user.role = 'pandit';
    await user.save();

    // Create in-app notification for Administrators
    try {
      await NotificationModel.create({
        userId: user._id, // stored with ref for context
        title: 'नया पंडित पंजीकरण (New Pandit Registration)',
        body: `${pandit.name} (${pandit.panditId}) ने पंजीकरण के लिए आवेदन किया है। कृपया व्यवस्थापक पैनल में समीक्षा करें।`,
        type: 'admin_broadcast',
        targetAudience: 'admins',
        data: {
          panditId: pandit._id.toString(),
          customId: pandit.panditId,
          name: pandit.name,
          phone: pandit.phone,
          city: pandit.city,
        },
      });

      // Real-time admin broadcast
      SocketService.emitToConversation('admin_room', 'new_pandit_registration', {
        id: pandit._id.toString(),
        panditId: pandit.panditId,
        name: pandit.name,
        phone: pandit.phone,
        city: pandit.city,
        createdAt: pandit.createdAt,
      });
    } catch {
      // Non-blocking notification creation
    }

    return pandit;
  }

  /**
   * Search / List Verified Pandits (Public/Member View)
   * Only approved / verified pandits can appear to customers!
   */
  static async listVerifiedPandits(filters: { ceremonyType?: string; location?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 12;
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      return {
        items: [
          {
            id: 'pandit_mock_1',
            panditId: 'PND-2026-1001',
            userId: 'user_pandit_1',
            name: 'Acharya Vidyadhar Sharma',
            profilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
            bio: 'Vedic Scholar with 15+ years experience in Vivah Sanskar & Griha Pravesh.',
            experienceYears: 15,
            languages: ['Hindi', 'Sanskrit'],
            specialization: ['Vivah Sanskar', 'Griha Pravesh', 'Kundli Milan'],
            serviceLocations: ['Delhi NCR', 'Online'],
            religiousTradition: 'Vedic Sanatan',
            services: [
              {
                serviceId: 'srv_1',
                name: 'Vivah Sanskar',
                priceInr: 15100,
                durationMinutes: 240,
                ceremonyType: 'wedding',
                description: 'Traditional Vedic Vivah ceremony',
              },
            ],
            availability: [],
            offersAstrology: true,
            consultationCharges: 501,
            isActive: true,
            isOnline: true,
            rating: 5.0,
            reviewsCount: 18,
          },
        ],
        pagination: { page, limit, totalCount: 1, totalPages: 1 },
      };
    }

    const query: any = {
      verificationStatus: { $in: ['verified', 'approved'] },
      isActive: { $ne: false },
    };
    if (filters.ceremonyType && filters.ceremonyType !== 'all') {
      query['services.ceremonyType'] = filters.ceremonyType;
    }
    if (filters.location) {
      query.serviceLocations = { $regex: filters.location, $options: 'i' };
    }

    const cacheKey = `pandits:verified:${filters.ceremonyType || 'all'}:${filters.location || 'all'}:${page}:${limit}`;
    const cached = readCache.get(cacheKey);
    if (cached) return cached;

    const [items, totalCount] = await Promise.all([
      PanditModel.find(query).sort({ rating: -1, experienceYears: -1 }).skip(skip).limit(limit).lean(),
      PanditModel.countDocuments(query),
    ]);

    const result = {
      items: items.map((p: any) => this.toPublicPanditDTO(p)),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
    readCache.set(cacheKey, result, 15_000);
    return result;
  }

  /**
   * Search / List Approved Astrologers (Customer Astrology Module)
   * Only approved / verified astrologers who offer astrology are displayed
   */
  static async listApprovedAstrologers(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter: any = {
      verificationStatus: { $in: ['verified', 'approved'] },
      isActive: { $ne: false },
      offersAstrology: { $ne: false },
    };

    if (query.search) {
      const s = query.search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { astrologyExpertise: { $regex: s, $options: 'i' } },
        { languages: { $regex: s, $options: 'i' } },
      ];
    }

    if (mongoose.connection.readyState !== 1) {
      return {
        astrologers: [
          {
            id: 'pandit_mock_1',
            panditId: 'PND-2026-1001',
            userId: 'user_pandit_1',
            name: 'Acharya Vidyadhar Sharma',
            profilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
            bio: 'Vedic Astrologer with 15+ years experience in Kundli matching, horoscope reading and remedial rituals.',
            experienceYears: 15,
            languages: ['Hindi', 'Sanskrit', 'English'],
            astrologyExpertise: ['Kundli Milan', 'Guna Matchmaking', 'Dosh Nivaran', 'Career Astrology'],
            consultationCharges: 501,
            isOnline: true,
            rating: 4.9,
            reviewsCount: 38,
          },
        ],
        total: 1,
        page,
        limit,
        totalPages: 1,
      };
    }

    const [items, total] = await Promise.all([
      PanditModel.find(filter).sort({ rating: -1, experienceYears: -1 }).skip(skip).limit(limit).lean(),
      PanditModel.countDocuments(filter),
    ]);

    const mapped = items.map((p: any) => this.toPublicPanditDTO(p));

    return {
      astrologers: mapped,
      items: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get Pandit Public Details by ID (sanitized for public/member access; full for Owner/Admin)
   */
  static async getPanditById(id: string, viewer?: { userId?: string; role?: string }) {
    let pandit: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      pandit = await PanditModel.findById(id).lean();
    } else {
      pandit = await PanditModel.findOne({ panditId: id }).lean();
    }
    if (!pandit) {
      throw new AppError('Pandit profile not found.', 404, 'PANDIT_NOT_FOUND');
    }

    const isAdmin = viewer?.role === 'admin';
    const isOwner = Boolean(viewer?.userId && pandit.userId && pandit.userId.toString() === viewer.userId);
    const isApprovedAndActive =
      ['approved', 'verified'].includes(pandit.verificationStatus) && pandit.isActive !== false;

    if (!isAdmin && !isOwner && !isApprovedAndActive) {
      throw new AppError('Pandit profile is currently unavailable.', 404, 'PANDIT_UNAVAILABLE');
    }

    if (isAdmin || isOwner) {
      return {
        ...pandit,
        id: pandit._id.toString(),
        whatsappAvailable: Boolean(pandit.whatsappNumber && pandit.whatsappEnabled !== false),
      };
    }

    const publicDto: any = this.toPublicPanditDTO(pandit);
    if (viewer?.userId && mongoose.connection.readyState === 1) {
      try {
        publicDto.entitlement = await this.getPanditChatEligibility(viewer.userId, pandit._id.toString());
      } catch {
        // Non-blocking enrichment
      }
    }
    return publicDto;
  }

  /**
   * Evaluate Pandit Free Intro Chat, Paid Personal Chat & WhatsApp Authorization for a User
   */
  static async getPanditChatEligibility(userId: string, panditIdOrId: string) {
    const pandit = await this.findApprovedPanditOrThrow(panditIdOrId);
    const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
    const user = (await UserModel.findById(userId).lean()) as any;
    if (!user) {
      throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');
    }

    const freeChatEnabled = settings?.panditFreeChatEnabled !== false;
    const freeMessageLimit = Math.max(0, Number(settings?.panditFreeMessageLimit ?? 1));
    const paidChatRequired = settings?.panditPaidChatRequired !== false;
    const femaleFreePanditChat = settings?.femaleFreePanditChat === true;
    const whatsappEnabledGlobal = settings?.panditWhatsappEnabled !== false;
    const whatsappRule = settings?.panditWhatsappRule || 'paid_booking_or_subscription';

    const entitlement = await PanditChatEntitlementModel.findOne({
      userId,
      panditId: pandit._id,
    }).lean();

    const freeMessagesUsed = Number(entitlement?.freeMessagesUsed || 0);
    const freeRemaining = freeChatEnabled ? Math.max(0, freeMessageLimit - freeMessagesUsed) : 0;

    let hasActiveSubscription = Boolean(
      ['plus', 'premium'].includes(user.subscriptionTier) &&
        (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date())
    );
    if (!hasActiveSubscription) {
      try {
        const membership = await MembershipService.getUserMembership(userId);
        const notExpired =
          !membership.expiresAt || new Date(membership.expiresAt).getTime() > Date.now();
        hasActiveSubscription = Boolean(
          (membership.planId === 'plus' || membership.planId === 'premium') &&
            membership.status === 'active' &&
            notExpired
        );
      } catch {
        // Ignore non-blocking membership lookup failure
      }
    }

    const hasPaidBooking = Boolean(
      await BookingModel.exists({
        userId,
        panditId: pandit._id,
        paymentStatus: 'paid',
        status: { $nin: ['cancelled', 'declined'] },
      })
    );

    const hasPaidConsultationPass = Boolean(
      entitlement?.paidAccessActive &&
        (!entitlement.paidExpiresAt || new Date(entitlement.paidExpiresAt) > new Date())
    );

    const isFemaleExempt = femaleFreePanditChat && String((user as any).gender || '').toLowerCase() === 'female';
    const isOwnerPandit = pandit.userId && pandit.userId.toString() === userId;
    const isAdminUser = user.role === 'admin';

    const paidAccessActive = Boolean(
      isOwnerPandit ||
        isAdminUser ||
        !paidChatRequired ||
        isFemaleExempt ||
        hasActiveSubscription ||
        hasPaidBooking ||
        hasPaidConsultationPass
    );

    const whatsappConfigured = Boolean(
      pandit.whatsappNumber && String(pandit.whatsappNumber).trim() && pandit.whatsappEnabled !== false
    );

    let whatsappAuthorized = false;
    if (whatsappConfigured && whatsappEnabledGlobal && whatsappRule !== 'always_off') {
      if (isOwnerPandit || isAdminUser) {
        whatsappAuthorized = true;
      } else if (whatsappRule === 'paid_booking_only') {
        whatsappAuthorized = hasPaidBooking;
      } else if (whatsappRule === 'paid_subscription_only') {
        whatsappAuthorized = hasActiveSubscription || hasPaidConsultationPass;
      } else {
        // paid_booking_or_subscription
        whatsappAuthorized = hasPaidBooking || hasActiveSubscription || hasPaidConsultationPass;
      }
    }

    const consultationPriceInr = Math.max(
      1,
      Number(pandit.consultationCharges || settings?.chatConsultationPriceInr || 501)
    );

    const canSendPersonalMessage = paidAccessActive || freeRemaining > 0;
    const requiresPayment = !canSendPersonalMessage;

    let reason = 'FREE_INTRO_AVAILABLE';
    if (isOwnerPandit) reason = 'PANDIT_OWNER';
    else if (hasPaidBooking) reason = 'PAID_BOOKING_ACTIVE';
    else if (hasPaidConsultationPass) reason = 'PANDIT_CONSULTATION_PAID';
    else if (hasActiveSubscription) reason = 'ACTIVE_SUBSCRIPTION';
    else if (isFemaleExempt) reason = 'FEMALE_PANDIT_FREE_RULE';
    else if (!paidChatRequired) reason = 'FREE_PANDIT_CHAT_SETTING';
    else if (freeRemaining > 0) reason = 'FREE_INTRO_AVAILABLE';
    else reason = 'PANDIT_CHAT_PAYMENT_REQUIRED';

    return {
      panditId: pandit._id.toString(),
      freeChatEnabled,
      freeMessagesUsed,
      freeMessageLimit,
      freeRemaining,
      paidAccessActive,
      hasActiveSubscription,
      hasPaidBooking,
      requiresPayment,
      consultationPriceInr,
      whatsappAvailable: whatsappConfigured && whatsappEnabledGlobal && whatsappRule !== 'always_off',
      whatsappAuthorized,
      whatsappRule,
      reason,
    };
  }

  /**
   * Authorized WhatsApp Contact Reveal (Never leaks number on public routes, logs or unverified access)
   */
  static async getAuthorizedWhatsapp(userId: string, panditIdOrId: string) {
    const pandit = await this.findApprovedPanditOrThrow(panditIdOrId);

    if (!pandit.whatsappNumber || !String(pandit.whatsappNumber).trim()) {
      throw new AppError(
        'This Pandit has not configured a verified WhatsApp contact number.',
        404,
        'WHATSAPP_NOT_CONFIGURED'
      );
    }

    if (pandit.whatsappEnabled === false) {
      await AuditLogModel.create({
        adminId: userId,
        action: 'PANDIT_WHATSAPP_DENIED',
        targetUserId: pandit.userId ? pandit.userId.toString() : '',
        details: { panditId: pandit._id.toString(), reason: 'PANDIT_WHATSAPP_DISABLED' },
      }).catch(() => {});
      throw new AppError('WhatsApp contact is currently disabled for this Pandit.', 403, 'WHATSAPP_DISABLED');
    }

    const eligibility = await this.getPanditChatEligibility(userId, pandit._id.toString());
    if (!eligibility.whatsappAvailable) {
      await AuditLogModel.create({
        adminId: userId,
        action: 'PANDIT_WHATSAPP_DENIED',
        targetUserId: pandit.userId ? pandit.userId.toString() : '',
        details: { panditId: pandit._id.toString(), reason: 'WHATSAPP_GLOBALLY_DISABLED' },
      }).catch(() => {});
      throw new AppError('WhatsApp consultation contact is currently disabled by Admin.', 403, 'WHATSAPP_DISABLED');
    }

    if (!eligibility.whatsappAuthorized) {
      await AuditLogModel.create({
        adminId: userId,
        action: 'PANDIT_WHATSAPP_DENIED',
        targetUserId: pandit.userId ? pandit.userId.toString() : '',
        details: { panditId: pandit._id.toString(), rule: eligibility.whatsappRule },
      }).catch(() => {});
      throw new AppError(
        'WhatsApp contact requires an active paid subscription, paid consultation pass, or confirmed paid booking.',
        403,
        'WHATSAPP_NOT_AUTHORIZED'
      );
    }

    const waDigits = this.formatWhatsappDigits(pandit.whatsappNumber);
    await AuditLogModel.create({
      adminId: userId,
      action: 'PANDIT_WHATSAPP_AUTHORIZED',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      details: { panditId: pandit._id.toString(), rule: eligibility.whatsappRule },
    }).catch(() => {});

    return {
      authorized: true,
      panditId: pandit._id.toString(),
      panditName: pandit.name,
      whatsappNumber: pandit.whatsappNumber,
      whatsappUrl: `https://wa.me/${waDigits}`,
    };
  }

  /**
   * Create Consultation Chat Payment Order (Backend-verified Unlock)
   */
  static async createPanditChatOrder(userId: string, panditIdOrId: string) {
    const pandit = await this.findApprovedPanditOrThrow(panditIdOrId);
    const user = (await UserModel.findById(userId).lean()) as any;
    if (!user) throw new AppError('User account not found.', 404, 'USER_NOT_FOUND');

    const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
    const amountInr = Math.max(1, Number(pandit.consultationCharges || settings?.chatConsultationPriceInr || 501));

    let orderId = `order_pchat_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    let mode: 'live' | 'test_mode' = 'test_mode';

    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            amount: amountInr * 100,
            currency: 'INR',
            receipt: `pchat_${pandit._id.toString().slice(-8)}_${Date.now()}`,
            notes: {
              type: 'pandit_chat',
              panditId: pandit._id.toString(),
              userId,
            },
          }),
        });
        if (rzpRes.ok) {
          const order = (await rzpRes.json()) as any;
          if (order?.id) {
            orderId = order.id;
            mode = 'live';
          }
        }
      } catch {
        // Fallback to test order ID when Razorpay credentials aren't live
      }
    }

    await PaymentModel.create({
      orderId,
      userId,
      userName: user.displayName || 'User',
      userMobile: user.mobile,
      userEmail: user.email,
      type: 'pandit_chat',
      referenceId: pandit._id.toString(),
      referenceDescription: `Pandit Consultation Chat - ${pandit.name}`,
      amount: amountInr,
      currency: 'INR',
      status: 'created',
      gateway: mode === 'live' ? 'razorpay' : 'test_gateway',
      metadata: { panditId: pandit._id.toString(), panditName: pandit.name },
    });

    return {
      orderId,
      amount: amountInr * 100,
      amountInr,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || '',
      panditId: pandit._id.toString(),
      panditName: pandit.name,
      mode,
    };
  }

  /**
   * Verify Consultation Chat Payment on Backend & Grant Paid Access
   */
  static async verifyPanditChatPayment(
    userId: string,
    panditIdOrId: string,
    payload: { orderId: string; paymentId: string; signature?: string; paymentMethod?: string }
  ) {
    const pandit = await this.findApprovedPanditOrThrow(panditIdOrId);
    const { orderId, paymentId, signature, paymentMethod } = payload || {};

    if (!orderId || !paymentId) {
      throw new AppError('orderId and paymentId are required for payment verification.', 400, 'INVALID_PAYMENT_PAYLOAD');
    }

    const payment = await PaymentModel.findOne({
      orderId,
      userId,
      type: 'pandit_chat',
      referenceId: pandit._id.toString(),
    });
    if (!payment) {
      throw new AppError('Consultation payment order not found for this account.', 404, 'PAYMENT_ORDER_NOT_FOUND');
    }

    if (process.env.RAZORPAY_KEY_SECRET) {
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      if (!signature || expected !== signature) {
        throw new AppError('Invalid payment verification signature.', 400, 'PAYMENT_VERIFICATION_FAILED');
      }
    }

    const wasAlreadyCaptured = payment.status === 'captured';
    if (!wasAlreadyCaptured) {
      payment.paymentId = paymentId;
      payment.signature = signature;
      payment.paymentMethod = paymentMethod || 'upi';
      payment.status = 'captured';
      payment.capturedAt = new Date();
      await payment.save();

      const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
      const commissionRate = Number(settings?.commissionRate ?? 15);
      const commissionAmount = Math.round((payment.amount * commissionRate) / 100);
      const panditEarnings = Math.max(0, payment.amount - commissionAmount);

      await PanditModel.findByIdAndUpdate(pandit._id, {
        $inc: {
          totalEarnings: panditEarnings,
          pendingPayout: panditEarnings,
        },
      });
    }

    const paidExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await PanditChatEntitlementModel.findOneAndUpdate(
      { userId, panditId: pandit._id },
      {
        $set: {
          paidAccessActive: true,
          paidSource: 'pandit_chat',
          paidActivatedAt: new Date(),
          paidExpiresAt,
          lastOrderId: orderId,
          lastPaymentId: paymentId,
        },
      },
      { upsert: true, new: true }
    );

    await AuditLogModel.create({
      adminId: userId,
      action: 'PANDIT_CHAT_PAYMENT_VERIFIED',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      details: { panditId: pandit._id.toString(), orderId, paymentId, amount: payment.amount },
    }).catch(() => {});

    SocketService.emitToUser(userId, 'pandit_chat_unlocked', {
      panditId: pandit._id.toString(),
      paidAccessActive: true,
      paidExpiresAt,
    });

    const entitlement = await this.getPanditChatEligibility(userId, pandit._id.toString());
    return {
      verified: true,
      paymentStatus: 'captured',
      entitlement,
    };
  }

  /**
   * Get Pandit Profile by User ID (Owner View)
   */
  static async getPanditByUserId(userId: string) {
    return PanditModel.findOne({ userId });
  }

  /**
   * Update Pandit Profile & Services (Owner)
   */
  static async updatePanditProfile(userId: string, data: any) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit profile not found.');

    if (data.name) pandit.name = data.name.trim();
    if (data.bio) pandit.bio = data.bio.trim();
    if (data.experienceYears !== undefined) pandit.experienceYears = Number(data.experienceYears);
    if (data.languages) pandit.languages = data.languages;
    if (data.specialization) pandit.specialization = data.specialization;
    if (data.serviceLocations) pandit.serviceLocations = data.serviceLocations;
    if (data.religiousTradition) pandit.religiousTradition = data.religiousTradition;
    if (data.services) pandit.services = data.services;
    if (data.availability) pandit.availability = data.availability;
    if (data.profilePhoto) pandit.profilePhoto = data.profilePhoto;
    if (data.isOnline !== undefined) pandit.isOnline = Boolean(data.isOnline);
    if (data.offersAstrology !== undefined) pandit.offersAstrology = Boolean(data.offersAstrology);
    if (data.astrologyExpertise) pandit.astrologyExpertise = data.astrologyExpertise;
    if (data.consultationCharges !== undefined) pandit.consultationCharges = Number(data.consultationCharges);
    if (data.whatsappNumber !== undefined) {
      pandit.whatsappNumber = data.whatsappNumber ? this.normalizeWhatsappNumber(data.whatsappNumber) : undefined;
    }
    if (data.whatsappEnabled !== undefined) pandit.whatsappEnabled = Boolean(data.whatsappEnabled);
    if (data.bankDetails) pandit.bankDetails = { ...pandit.bankDetails, ...data.bankDetails };
    if (data.documents && Array.isArray(data.documents)) pandit.documents = data.documents;

    await pandit.save();
    readCache.invalidatePrefix('pandits:');
    return pandit;
  }

  /**
   * Toggle Pandit Online / Offline & Communication Availability (Owner)
   */
  static async toggleAvailability(
    userId: string,
    options?: boolean | {
      isOnline?: boolean;
      isChatAvailable?: boolean;
      isAudioCallAvailable?: boolean;
      isVideoCallAvailable?: boolean;
      audioCallChargePerMin?: number;
      videoCallChargePerMin?: number;
    }
  ) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit profile not found.');

    if (typeof options === 'boolean') {
      pandit.isOnline = options;
    } else if (typeof options === 'object' && options !== null) {
      if (options.isOnline !== undefined) pandit.isOnline = Boolean(options.isOnline);
      if ((options as any).isAvailable !== undefined) pandit.isOnline = Boolean((options as any).isAvailable);
      if (options.isChatAvailable !== undefined) pandit.isChatAvailable = Boolean(options.isChatAvailable);
      if (options.isAudioCallAvailable !== undefined) pandit.isAudioCallAvailable = Boolean(options.isAudioCallAvailable);
      if (options.isVideoCallAvailable !== undefined) pandit.isVideoCallAvailable = Boolean(options.isVideoCallAvailable);
      if (options.audioCallChargePerMin !== undefined) pandit.audioCallChargePerMin = Number(options.audioCallChargePerMin);
      if (options.videoCallChargePerMin !== undefined) pandit.videoCallChargePerMin = Number(options.videoCallChargePerMin);
    } else {
      pandit.isOnline = !pandit.isOnline;
    }

    await pandit.save();
    readCache.invalidatePrefix('pandits:');

    // Broadcast status change
    SocketService.emitToConversation('pandits_status', 'pandit_online_change', {
      panditId: pandit._id.toString(),
      isOnline: pandit.isOnline,
      isChatAvailable: pandit.isChatAvailable,
      isAudioCallAvailable: pandit.isAudioCallAvailable,
      isVideoCallAvailable: pandit.isVideoCallAvailable,
    });

    return {
      success: true,
      isOnline: pandit.isOnline,
      isChatAvailable: pandit.isChatAvailable,
      isAudioCallAvailable: pandit.isAudioCallAvailable,
      isVideoCallAvailable: pandit.isVideoCallAvailable,
      message: `Pandit communication availability updated successfully.`,
    };
  }

  /**
   * Update Astrology Profile (charges, expertise, availability)
   */
  static async updateAstrologyProfile(userId: string, data: any) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit profile not found.');

    if (data.offersAstrology !== undefined) pandit.offersAstrology = Boolean(data.offersAstrology);
    if (data.astrologyExpertise) pandit.astrologyExpertise = data.astrologyExpertise;
    if (data.consultationCharges !== undefined) pandit.consultationCharges = Number(data.consultationCharges);
    if (data.isOnline !== undefined) pandit.isOnline = Boolean(data.isOnline);

    await pandit.save();
    return pandit;
  }

  /**
   * Pandit Dashboard Metrics
   */
  static async getPanditDashboard(userId: string) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit account not found.');

    const [upcomingBookings, completedBookings, pendingRequests, recentCalls] = await Promise.all([
      BookingModel.find({
        panditId: pandit._id,
        status: { $in: ['accepted', 'confirmed'] },
      }).sort({ bookingDate: 1 }).limit(20).lean(),
      BookingModel.countDocuments({
        panditId: pandit._id,
        status: 'completed',
      }),
      BookingModel.find({
        panditId: pandit._id,
        status: { $in: ['requested', 'pending', 'assigned', 'pandit_assigned'] },
      }).sort({ createdAt: -1 }).limit(20).lean(),
      CallSessionModel.find({
        panditId: pandit._id,
      }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    // Use Pandit's tracked totalEarnings or completed bookings sum
    const completedList = await BookingModel.find({
      panditId: pandit._id,
      status: 'completed',
    }).select('priceInr panditEarnings');
    const computedEarnings = completedList.reduce((sum, b) => sum + (b.panditEarnings || b.priceInr || 0), 0);
    const totalEarnings = Math.max(pandit.totalEarnings || 0, computedEarnings);

    return {
      pandit: {
        id: pandit._id.toString(),
        panditId: pandit.panditId,
        name: pandit.name,
        verificationStatus: pandit.verificationStatus,
        isActive: pandit.isActive,
        isOnline: pandit.isOnline,
        isChatAvailable: pandit.isChatAvailable !== false,
        isAudioCallAvailable: pandit.isAudioCallAvailable !== false,
        isVideoCallAvailable: pandit.isVideoCallAvailable !== false,
        audioCallChargePerMin: pandit.audioCallChargePerMin || 21,
        videoCallChargePerMin: pandit.videoCallChargePerMin || 51,
        rating: pandit.rating,
        reviewsCount: pandit.reviewsCount,
        offersAstrology: pandit.offersAstrology,
        consultationCharges: pandit.consultationCharges,
        bankDetails: pandit.bankDetails || {},
      },
      stats: {
        totalEarnings,
        pendingPayout: pandit.pendingPayout || 0,
        completedBookings,
        upcomingCount: upcomingBookings.length,
        pendingRequestsCount: pendingRequests.length,
        recentCallsCount: recentCalls.length,
      },
      upcomingBookings,
      pendingRequests,
      recentCalls,
    };
  }

  /**
   * Pandit: Get Wallet & Payout status
   */
  static async getPanditWallet(userId: string) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit account not found.');

    const [withdrawals, completedBookingsCount] = await Promise.all([
      WithdrawalModel.find({ panditId: pandit._id }).sort({ createdAt: -1 }).limit(20).lean(),
      BookingModel.countDocuments({ panditId: pandit._id, status: 'completed' }),
    ]);

    return {
      panditId: pandit.panditId,
      name: pandit.name,
      totalEarnings: pandit.totalEarnings || 0,
      pendingPayout: pandit.pendingPayout || 0,
      completedBookingsCount,
      bankDetails: pandit.bankDetails || {},
      withdrawals: withdrawals.map((w: any) => ({
        id: w._id.toString(),
        withdrawalId: w.withdrawalId,
        amount: w.amount,
        status: w.status,
        referenceNumber: w.referenceNumber,
        rejectionReason: w.rejectionReason,
        createdAt: w.createdAt?.toISOString ? w.createdAt.toISOString() : w.createdAt,
      })),
    };
  }

  /**
   * Pandit: Request Withdrawal from Wallet
   */
  static async requestWithdrawal(userId: string, amount: number, bankDetails?: any) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit account not found.');

    if (pandit.verificationStatus !== 'verified' && pandit.verificationStatus !== 'approved') {
      throw new AppError('Only approved and verified Pandits can withdraw funds.', 400, 'PANDIT_NOT_VERIFIED');
    }

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount < 100) {
      throw new AppError('Minimum withdrawal amount is ₹100.', 400, 'INVALID_AMOUNT');
    }

    if (withdrawAmount > (pandit.pendingPayout || 0)) {
      throw new AppError(
        `Insufficient wallet balance. Available pending payout: ₹${pandit.pendingPayout || 0}, requested: ₹${withdrawAmount}.`,
        400,
        'INSUFFICIENT_FUNDS'
      );
    }

    const effectiveBankDetails = bankDetails || pandit.bankDetails;
    if (!effectiveBankDetails || (!effectiveBankDetails.accountNumber && !effectiveBankDetails.upiId)) {
      throw new AppError('Please provide bank account details or a UPI ID for payment transfer.', 400, 'MISSING_PAYOUT_DETAILS');
    }

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const withdrawalId = `WTH-${new Date().getFullYear()}-${randomCode}`;

    const withdrawal = await WithdrawalModel.create({
      withdrawalId,
      panditId: pandit._id,
      userId: pandit.userId,
      panditName: pandit.name,
      panditPhone: pandit.phone,
      amount: withdrawAmount,
      status: 'pending',
      bankDetails: effectiveBankDetails,
    });

    // Notify Admin of withdrawal request
    try {
      await NotificationModel.create({
        userId: pandit.userId,
        title: 'पंडित भुगतान अनुरोध (Pandit Withdrawal Request)',
        body: `पंडित ${pandit.name} ने ₹${withdrawAmount} की निकासी का अनुरोध किया है (#${withdrawalId})।`,
        type: 'admin_broadcast',
        targetAudience: 'admins',
        data: {
          withdrawalId,
          amount: withdrawAmount,
          panditId: pandit._id.toString(),
        },
      });
    } catch {}

    return withdrawal;
  }

  /**
   * Admin: List Pandits with 10 sections/filters and search
   */
  static async listAdminPandits(queryInput: any = {}) {
    let page = 1;
    let limit = 20;
    let status = 'all';
    let search = '';
    let subSection = 'all';

    if (typeof queryInput === 'number') {
      page = queryInput;
    } else if (typeof queryInput === 'object') {
      page = Number(queryInput.page) || 1;
      limit = Number(queryInput.limit) || 20;
      status = queryInput.status || 'all';
      search = queryInput.search || '';
      subSection = queryInput.subSection || queryInput.section || 'all';
    }

    const skip = (page - 1) * limit;
    const filter: any = {};

    // Apply subSection or status filter (Supporting the 10 Sections)
    // 1. All Pandits
    // 2. New Registrations
    // 3. Pending Approval
    // 4. Approved Pandits
    // 5. Rejected Pandits
    // 6. Active Pandits
    // 7. Offline Pandits
    // 8. Assigned Pandits
    // 9. Pandit Documents
    // 10. Pandit Earnings and Payments

    if (subSection === 'new_registrations') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filter.$or = [{ createdAt: { $gte: sevenDaysAgo } }, { verificationStatus: 'pending' }];
    } else if (subSection === 'pending' || status === 'pending') {
      filter.verificationStatus = { $in: ['pending', 'under_review'] };
    } else if (subSection === 'approved' || status === 'verified' || status === 'approved') {
      filter.verificationStatus = { $in: ['approved', 'verified'] };
    } else if (subSection === 'rejected' || status === 'rejected') {
      filter.verificationStatus = 'rejected';
    } else if (subSection === 'suspended' || status === 'suspended') {
      filter.verificationStatus = 'suspended';
    } else if (subSection === 'active') {
      filter.isActive = true;
      filter.verificationStatus = { $in: ['approved', 'verified'] };
    } else if (subSection === 'offline') {
      filter.isOnline = false;
    } else if (subSection === 'assigned') {
      filter.isAssigned = true;
    } else if (subSection === 'documents') {
      filter['documents.0'] = { $exists: true };
    } else if (status !== 'all') {
      filter.verificationStatus = status;
    }

    if (search) {
      const s = search.trim();
      const searchConditions = [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { city: { $regex: s, $options: 'i' } },
        { panditId: { $regex: s, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const [items, totalCount] = await Promise.all([
      PanditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PanditModel.countDocuments(filter),
    ]);

    return {
      items: items.map((p: any) => ({
        id: p._id.toString(),
        panditId: p.panditId || `PND-${p._id.toString().slice(-4).toUpperCase()}`,
        userId: p.userId ? p.userId.toString() : '',
        name: p.name,
        profilePhoto: p.profilePhoto,
        phone: p.phone,
        email: p.email,
        gender: p.gender || 'male',
        dateOfBirth: p.dateOfBirth,
        address: p.address,
        city: p.city || p.address?.city || 'Delhi NCR',
        state: p.state || p.address?.state || 'Delhi',
        experienceYears: p.experienceYears,
        languages: p.languages,
        specialization: p.specialization || [],
        religiousTradition: p.religiousTradition,
        serviceLocations: p.serviceLocations,
        servicesCount: p.services?.length || 0,
        services: p.services || [],
        availability: p.availability || [],
        offersAstrology: p.offersAstrology ?? true,
        astrologyExpertise: p.astrologyExpertise || [],
        consultationCharges: p.consultationCharges ?? 501,
        bankDetails: p.bankDetails || {},
        documents: p.documents || [],
        documentsCount: p.documents?.length || 0,
        verificationStatus: p.verificationStatus,
        rejectionReason: p.rejectionReason,
        requestedDocuments: p.requestedDocuments || [],
        isActive: p.isActive ?? true,
        isOnline: p.isOnline ?? true,
        isAssigned: p.isAssigned ?? false,
        totalEarnings: p.totalEarnings || 0,
        pendingPayout: p.pendingPayout || 0,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        verifiedAt: p.verifiedAt,
        createdAt: p.createdAt?.toISOString ? p.createdAt.toISOString() : p.createdAt,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Admin: Approve / Verify Pandit
   */
  static async verifyPandit(panditId: string, adminId: string, ipAddress?: string) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    pandit.verificationStatus = 'approved';
    pandit.isActive = true;
    pandit.verified = true;
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      pandit.verifiedBy = new mongoose.Types.ObjectId(adminId);
    } else {
      pandit.verifiedBy = adminId;
    }
    pandit.verifiedAt = new Date();
    await pandit.save();
    readCache.invalidatePrefix('pandits:');
    readCache.invalidate('admin:dashboard:stats');

    await AuditLogModel.create({
      adminId,
      action: 'APPROVE_PANDIT',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      targetUserEmail: pandit.email,
      targetUserMobile: pandit.phone,
      details: { panditId, panditCustomId: pandit.panditId, name: pandit.name },
      ipAddress,
    });

    // Notify Pandit of Approval
    try {
      await NotificationModel.create({
        userId: pandit.userId,
        title: 'पंडित पंजीकरण स्वीकृत (Pandit Profile Approved)',
        body: 'बधाई हो! आपकी पंडित प्रोफ़ाइल व्यवस्थापक द्वारा स्वीकृत कर दी गई है। अब आप पूजा बुकिंग और ज्योतिष परामर्श स्वीकार कर सकते हैं। (Congratulations! Your Pandit profile has been approved. You are now active to receive bookings & consultations.)',
        type: 'pandit_approval',
        data: { panditId: pandit._id.toString(), status: 'approved' },
      });

      SocketService.emitToUser(pandit.userId.toString(), 'pandit_approved', {
        panditId: pandit._id.toString(),
        status: 'approved',
        message: 'Your Pandit profile has been approved by admin.',
      });
    } catch {
      // Non-blocking notification
    }

    return { success: true, message: 'Pandit verified and approved successfully.', pandit };
  }

  /**
   * Admin: Reject Pandit
   */
  static async rejectPandit(panditId: string, adminId: string, reason: string, ipAddress?: string) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    pandit.verificationStatus = 'rejected';
    pandit.rejectionReason = reason;
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      pandit.verifiedBy = new mongoose.Types.ObjectId(adminId);
    } else {
      pandit.verifiedBy = adminId;
    }
    pandit.verifiedAt = new Date();
    await pandit.save();

    await AuditLogModel.create({
      adminId,
      action: 'REJECT_PANDIT',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      targetUserEmail: pandit.email,
      targetUserMobile: pandit.phone,
      details: { panditId, panditCustomId: pandit.panditId, name: pandit.name, reason },
      ipAddress,
    });

    // Notify Pandit of Rejection
    try {
      await NotificationModel.create({
        userId: pandit.userId,
        title: 'पंडित पंजीकरण अस्वीकृत (Pandit Application Rejected)',
        body: `आपका पंडित पंजीकरण आवेदन अस्वीकृत कर दिया गया है। कारण: ${reason}`,
        type: 'pandit_rejection',
        data: { panditId: pandit._id.toString(), status: 'rejected', reason },
      });

      SocketService.emitToUser(pandit.userId.toString(), 'pandit_rejected', {
        panditId: pandit._id.toString(),
        status: 'rejected',
        reason,
      });
    } catch {
      // Non-blocking
    }

    return { success: true, message: 'Pandit application rejected.' };
  }

  /**
   * Admin: Request Additional Documents from Pandit
   */
  static async requestDocuments(panditId: string, adminId: string, requestedDocuments: string[], ipAddress?: string) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    pandit.verificationStatus = 'under_review';
    pandit.requestedDocuments = requestedDocuments;
    await pandit.save();

    await AuditLogModel.create({
      adminId,
      action: 'REQUEST_PANDIT_DOCS',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      details: { panditId, requestedDocuments },
      ipAddress,
    });

    try {
      const docList = requestedDocuments.join(', ');
      await NotificationModel.create({
        userId: pandit.userId,
        title: 'अतिरिक्त दस्तावेज़ अनुरोध (Documents Requested)',
        body: `कृपया निम्नलिखित दस्तावेज़ अपलोड करें: ${docList}`,
        type: 'document_request',
        data: { panditId: pandit._id.toString(), requestedDocuments },
      });
    } catch {
      // Non-blocking
    }

    return { success: true, message: 'Additional documents requested from Pandit.', requestedDocuments };
  }

  /**
   * Admin: Toggle Pandit Active / Deactivate
   */
  static async toggleActive(panditId: string, adminId: string, ipAddress?: string) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    pandit.isActive = !pandit.isActive;
    await pandit.save();
    readCache.invalidatePrefix('pandits:');
    readCache.invalidate('admin:dashboard:stats');

    await AuditLogModel.create({
      adminId,
      action: pandit.isActive ? 'ACTIVATE_PANDIT' : 'DEACTIVATE_PANDIT',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      details: { panditId, isActive: pandit.isActive },
      ipAddress,
    });

    return { success: true, isActive: pandit.isActive, message: `Pandit account is now ${pandit.isActive ? 'Active' : 'Deactivated'}.` };
  }

  /**
   * Admin: Suspend Pandit
   */
  static async suspendPandit(panditId: string, adminId: string, reason: string, ipAddress?: string) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    pandit.verificationStatus = 'suspended';
    pandit.isActive = false;
    pandit.rejectionReason = reason;
    await pandit.save();

    await AuditLogModel.create({
      adminId,
      action: 'SUSPEND_PANDIT',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      details: { panditId, reason },
      ipAddress,
    });

    try {
      await NotificationModel.create({
        userId: pandit.userId,
        title: 'पंडित खाता निलंबित (Account Suspended)',
        body: `आपका पंडित खाता निलंबित कर दिया गया है। कारण: ${reason}`,
        type: 'account_suspended',
        data: { panditId: pandit._id.toString(), reason },
      });
    } catch {
      // Non-blocking
    }

    return { success: true, message: 'Pandit account suspended.' };
  }

  /**
   * Admin: Update Pandit Details
   */
  static async adminUpdatePandit(panditId: string, adminId: string, updateData: any) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    if (updateData.name) pandit.name = updateData.name.trim();
    if (updateData.phone) pandit.phone = updateData.phone.trim();
    if (updateData.whatsappNumber !== undefined) {
      pandit.whatsappNumber = updateData.whatsappNumber
        ? this.normalizeWhatsappNumber(updateData.whatsappNumber)
        : undefined;
    }
    if (updateData.whatsappEnabled !== undefined) {
      pandit.whatsappEnabled = Boolean(updateData.whatsappEnabled);
    }
    if (updateData.isOnline !== undefined) pandit.isOnline = Boolean(updateData.isOnline);
    if (updateData.isChatAvailable !== undefined) pandit.isChatAvailable = Boolean(updateData.isChatAvailable);
    if (updateData.isAudioCallAvailable !== undefined) pandit.isAudioCallAvailable = Boolean(updateData.isAudioCallAvailable);
    if (updateData.isVideoCallAvailable !== undefined) pandit.isVideoCallAvailable = Boolean(updateData.isVideoCallAvailable);
    if (updateData.email) pandit.email = updateData.email.trim();
    if (updateData.bio) pandit.bio = updateData.bio.trim();
    if (updateData.city) pandit.city = updateData.city.trim();
    if (updateData.state) pandit.state = updateData.state.trim();
    if (updateData.experienceYears !== undefined) pandit.experienceYears = Number(updateData.experienceYears);
    if (updateData.consultationCharges !== undefined) pandit.consultationCharges = Number(updateData.consultationCharges);
    if (updateData.offersAstrology !== undefined) pandit.offersAstrology = Boolean(updateData.offersAstrology);
    if (updateData.languages) pandit.languages = updateData.languages;
    if (updateData.specialization) pandit.specialization = updateData.specialization;
    if (updateData.services) pandit.services = updateData.services;

    await pandit.save();
    readCache.invalidatePrefix('pandits:');
    await AuditLogModel.create({
      adminId,
      action: 'ADMIN_UPDATE_PANDIT',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      details: {
        panditId,
        updatedFields: Object.keys(updateData).filter((k) => k !== 'whatsappNumber'),
      },
    }).catch(() => {});
    return pandit;
  }
}
