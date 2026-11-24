import mongoose from 'mongoose';
import { PanditModel, IPandit } from '../models/pandit.model';
import { UserModel } from '../models/user.model';
import { BookingModel } from '../models/booking.model';
import { AuditLogModel } from '../models/audit-log.model';
import { NotificationModel } from '../models/notification.model';
import { WithdrawalModel } from '../models/withdrawal.model';
import { PaymentModel } from '../models/payment.model';
import { CallSessionModel } from '../models/call-session.model';
import { SocketService } from '../socket/socket.service';
import { AppError } from '../middleware/errorHandler';

export class PanditService {
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

    const pandit = await PanditModel.create({
      panditId,
      userId: user._id,
      name: data.name?.trim() || user.displayName || 'Vedic Pandit Ji',
      profilePhoto: data.profilePhoto || user.avatarUrl,
      phone: data.phone?.trim() || user.mobile,
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

    const [items, totalCount] = await Promise.all([
      PanditModel.find(query).sort({ rating: -1, experienceYears: -1 }).skip(skip).limit(limit).lean(),
      PanditModel.countDocuments(query),
    ]);

    return {
      items: items.map((p: any) => ({
        id: p._id.toString(),
        panditId: p.panditId || `PND-${p._id.toString().slice(-4).toUpperCase()}`,
        userId: p.userId ? p.userId.toString() : '',
        name: p.name,
        profilePhoto: p.profilePhoto,
        bio: p.bio,
        experienceYears: p.experienceYears,
        languages: p.languages,
        specialization: p.specialization,
        serviceLocations: p.serviceLocations,
        religiousTradition: p.religiousTradition,
        services: p.services,
        availability: p.availability,
        offersAstrology: p.offersAstrology ?? true,
        consultationCharges: p.consultationCharges ?? 501,
        isOnline: p.isOnline ?? true,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
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

    const mapped = items.map((p: any) => ({
      id: p._id.toString(),
      panditId: p.panditId || `PND-${p._id.toString().slice(-4).toUpperCase()}`,
      userId: p.userId ? p.userId.toString() : '',
      name: p.name,
      profilePhoto: p.profilePhoto,
      bio: p.bio,
      experienceYears: p.experienceYears,
      languages: p.languages,
      offersAstrology: p.offersAstrology ?? true,
      astrologyExpertise: p.astrologyExpertise || ['Kundli Milan', 'Horoscope Analysis'],
      consultationCharges: p.consultationCharges ?? 501,
      isOnline: p.isOnline ?? true,
      rating: p.rating,
      reviewsCount: p.reviewsCount,
    }));

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
   * Get Pandit Public Details by ID
   */
  static async getPanditById(id: string) {
    let pandit: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      pandit = await PanditModel.findById(id).lean();
    } else {
      pandit = await PanditModel.findOne({ panditId: id }).lean();
    }
    if (!pandit) throw new Error('Pandit profile not found.');
    return pandit;
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
    if (data.bankDetails) pandit.bankDetails = { ...pandit.bankDetails, ...data.bankDetails };
    if (data.documents && Array.isArray(data.documents)) pandit.documents = data.documents;

    await pandit.save();
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
    return pandit;
  }
}
