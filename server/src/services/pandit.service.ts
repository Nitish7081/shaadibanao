import mongoose from 'mongoose';
import { PanditModel, IPandit } from '../models/pandit.model';
import { UserModel } from '../models/user.model';
import { BookingModel } from '../models/booking.model';
import { AuditLogModel } from '../models/audit-log.model';

export class PanditService {
  /**
   * Register as a Pandit
   */
  static async registerPandit(userId: string, data: any) {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found.');

    // Check if already registered
    let pandit = await PanditModel.findOne({ userId });
    if (pandit) {
      throw new Error('Pandit profile already exists for this account.');
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

    const defaultAvailability = data.availability || [
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isAvailable: true },
      { dayOfWeek: 6, startTime: '08:00', endTime: '20:00', isAvailable: true },
      { dayOfWeek: 0, startTime: '08:00', endTime: '20:00', isAvailable: true },
    ];

    pandit = await PanditModel.create({
      userId: user._id,
      name: data.name || user.displayName || 'Vedic Pandit Ji',
      profilePhoto: data.profilePhoto || user.avatarUrl,
      phone: user.mobile,
      email: user.email,
      bio: data.bio || 'Experienced Vedic Pandit performing authentic Sanatan rituals and astrologer.',
      experienceYears: data.experienceYears || 7,
      languages: data.languages || ['Hindi', 'Sanskrit'],
      serviceLocations: data.serviceLocations || ['Delhi NCR', 'Online'],
      religiousTradition: data.religiousTradition || 'Vedic Sanatan',
      services: defaultServices,
      availability: defaultAvailability,
      verificationStatus: 'pending',
      rating: 5.0,
      reviewsCount: 0,
    });

    // Update user role to pandit
    user.role = 'pandit';
    await user.save();

    return pandit;
  }

  /**
   * Search / List Verified Pandits (Public/Member View)
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
            userId: 'user_pandit_1',
            name: 'Acharya Vidyadhar Sharma',
            profilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
            bio: 'Vedic Scholar with 15+ years experience in Vivah Sanskar & Griha Pravesh.',
            experienceYears: 15,
            languages: ['Hindi', 'Sanskrit'],
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
            rating: 5.0,
            reviewsCount: 18,
          },
        ],
        pagination: { page, limit, totalCount: 1, totalPages: 1 },
      };
    }

    const query: any = { verificationStatus: 'verified' };
    if (filters.ceremonyType) {
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
        userId: p.userId ? p.userId.toString() : '',
        name: p.name,
        profilePhoto: p.profilePhoto,
        bio: p.bio,
        experienceYears: p.experienceYears,
        languages: p.languages,
        serviceLocations: p.serviceLocations,
        religiousTradition: p.religiousTradition,
        services: p.services,
        availability: p.availability,
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
   * Get Pandit Public Details by ID
   */
  static async getPanditById(id: string) {
    const pandit = await PanditModel.findById(id).lean();
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
   * Update Pandit Profile & Services
   */
  static async updatePanditProfile(userId: string, data: any) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit profile not found.');

    if (data.name) pandit.name = data.name.trim();
    if (data.bio) pandit.bio = data.bio.trim();
    if (data.experienceYears !== undefined) pandit.experienceYears = data.experienceYears;
    if (data.languages) pandit.languages = data.languages;
    if (data.serviceLocations) pandit.serviceLocations = data.serviceLocations;
    if (data.religiousTradition) pandit.religiousTradition = data.religiousTradition;
    if (data.services) pandit.services = data.services;
    if (data.availability) pandit.availability = data.availability;
    if (data.profilePhoto) pandit.profilePhoto = data.profilePhoto;

    await pandit.save();
    return pandit;
  }

  /**
   * Pandit Dashboard Metrics
   */
  static async getPanditDashboard(userId: string) {
    const pandit = await PanditModel.findOne({ userId });
    if (!pandit) throw new Error('Pandit account not found.');

    const [upcomingBookings, completedBookings, pendingRequests] = await Promise.all([
      BookingModel.find({
        panditId: pandit._id,
        status: 'accepted',
      }).sort({ bookingDate: 1 }).limit(10).lean(),
      BookingModel.countDocuments({
        panditId: pandit._id,
        status: 'completed',
      }),
      BookingModel.find({
        panditId: pandit._id,
        status: 'requested',
      }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    // Calculate approximate earnings
    const completedList = await BookingModel.find({
      panditId: pandit._id,
      status: 'completed',
    }).select('priceInr');
    const totalEarnings = completedList.reduce((sum, b) => sum + (b.priceInr || 0), 0);

    return {
      pandit: {
        id: pandit._id.toString(),
        name: pandit.name,
        verificationStatus: pandit.verificationStatus,
        rating: pandit.rating,
        reviewsCount: pandit.reviewsCount,
      },
      stats: {
        totalEarnings,
        completedBookings,
        upcomingCount: upcomingBookings.length,
        pendingRequestsCount: pendingRequests.length,
      },
      upcomingBookings,
      pendingRequests,
    };
  }

  /**
   * Admin: List Pandits (with verification filter)
   */
  static async listAdminPandits(page = 1, limit = 20, status = 'all') {
    const skip = (page - 1) * limit;
    const query = status === 'all' ? {} : { verificationStatus: status };

    const [items, totalCount] = await Promise.all([
      PanditModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PanditModel.countDocuments(query),
    ]);

    return {
      items: items.map((p: any) => ({
        id: p._id.toString(),
        userId: p.userId ? p.userId.toString() : '',
        name: p.name,
        profilePhoto: p.profilePhoto,
        phone: p.phone,
        email: p.email,
        experienceYears: p.experienceYears,
        languages: p.languages,
        religiousTradition: p.religiousTradition,
        serviceLocations: p.serviceLocations,
        servicesCount: p.services?.length || 0,
        verificationStatus: p.verificationStatus,
        rating: p.rating,
        createdAt: p.createdAt?.toISOString(),
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
   * Admin: Verify Pandit
   */
  static async verifyPandit(panditId: string, adminId: string, ipAddress?: string) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    pandit.verificationStatus = 'verified';
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      pandit.verifiedBy = new mongoose.Types.ObjectId(adminId);
    }
    pandit.verifiedAt = new Date();
    await pandit.save();

    await AuditLogModel.create({
      adminId,
      action: 'VERIFY_PANDIT',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      targetUserEmail: pandit.email,
      targetUserMobile: pandit.phone,
      details: { panditId, name: pandit.name },
      ipAddress,
    });

    return { success: true, message: 'Pandit verified successfully.' };
  }

  /**
   * Admin: Reject Pandit
   */
  static async rejectPandit(panditId: string, adminId: string, reason: string, ipAddress?: string) {
    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    pandit.verificationStatus = 'rejected';
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      pandit.verifiedBy = new mongoose.Types.ObjectId(adminId);
    }
    pandit.verifiedAt = new Date();
    await pandit.save();

    await AuditLogModel.create({
      adminId,
      action: 'REJECT_PANDIT',
      targetUserId: pandit.userId ? pandit.userId.toString() : '',
      targetUserEmail: pandit.email,
      targetUserMobile: pandit.phone,
      details: { panditId, name: pandit.name, reason },
      ipAddress,
    });

    return { success: true, message: 'Pandit application rejected.' };
  }
}
