import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel, IUser } from '../models/user.model';
import { ProfileModel } from '../models/profile.model';
import { MembershipModel } from '../models/membership.model';
import { ReportModel } from '../models/report.model';
import { AuditLogModel } from '../models/audit-log.model';
import { PanditModel } from '../models/pandit.model';
import { BookingModel } from '../models/booking.model';
import { CommunityPostModel } from '../models/community-post.model';
import { VerificationRequestModel } from '../models/verification-request.model';
import { PartnerPreferenceModel } from '../models/preference.model';
import { KundliModel } from '../models/kundli.model';
import { BannerModel } from '../models/banner.model';
import { ContactInquiryModel } from '../models/contact-inquiry.model';
import { NotificationModel } from '../models/notification.model';
import { ServiceCatalogModel } from '../models/service-catalog.model';
import { SystemSettingsModel } from '../models/system-settings.model';
import { WithdrawalModel } from '../models/withdrawal.model';
import { PaymentModel } from '../models/payment.model';
import { ErrorLogModel } from '../models/error-log.model';
import { StorageService } from './storage.service';
import { sanitizeBannerLink } from './banner.service';
import { presentPhoto, presentPhotoUrl } from './photoPrivacy';
import { TokenService } from './token.service';
import { SocketService } from '../socket/socket.service';
import { AppError } from '../middleware/errorHandler';
import { readCache } from '../utils/cache';
import { AuthTokens, UserSummary, PendingApprovalItem, ApprovalStatus } from '@bandhansetu/shared';
import { inMemoryProfileStore } from './profile.service';

// In-memory mock store for isolated unit tests when MongoDB is disconnected
const inMemoryAdminStore = new Map<string, any>();
const inMemoryAuditStore: any[] = [];

export class AdminService {
  /**
   * Secure administrator login using hashed credentials
   */
  public static async login(
    emailOrMobile: string,
    password: string
  ): Promise<{ user: UserSummary; tokens: AuthTokens }> {
    const cleanIdentifier = emailOrMobile.toLowerCase().trim();
    const isDbConnected = mongoose.connection.readyState === 1;

    let adminUser: any = null;

    if (isDbConnected) {
      adminUser = await UserModel.findOne({
        $or: [{ email: cleanIdentifier }, { mobile: cleanIdentifier }],
        status: { $ne: 'deleted' },
      });
    } else {
      adminUser =
        inMemoryAdminStore.get(cleanIdentifier) ||
        Array.from(inMemoryAdminStore.values()).find(
          (u) => u.email === cleanIdentifier || u.mobile === cleanIdentifier
        );
    }

    if (!adminUser) {
      throw new AppError('Invalid credentials or administrator account not found.', 401, 'INVALID_CREDENTIALS');
    }

    if (adminUser.role !== 'admin') {
      throw new AppError(
        'Access denied. This account does not have administrative privileges.',
        403,
        'FORBIDDEN'
      );
    }

    if (adminUser.status === 'suspended') {
      throw new AppError('Administrator account is suspended. Contact system support.', 403, 'ACCOUNT_SUSPENDED');
    }

    // Verify password
    if (!adminUser.passwordHash) {
      throw new AppError(
        'Account does not have an administrative password configured. Please set one using the server admin CLI tool.',
        400,
        'PASSWORD_NOT_SET'
      );
    }

    const isMatch = bcrypt.compareSync(password, adminUser.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid credentials or administrator account not found.', 401, 'INVALID_CREDENTIALS');
    }

    const userId = adminUser._id?.toString() || adminUser.id;
    const tokens = TokenService.generateTokens({
      userId,
      email: adminUser.email,
      mobile: adminUser.mobile,
      role: 'admin',
    });

    // Persist hashed refresh token so the admin portal can transparently refresh its session
    const refreshEntry = {
      tokenHash: TokenService.hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      device: 'admin_portal',
    };
    if (isDbConnected && adminUser._id) {
      try {
        await UserModel.findByIdAndUpdate(adminUser._id, {
          $push: {
            refreshTokens: {
              $each: [refreshEntry],
              $slice: -10,
            },
          },
        });
      } catch {
        // Non-blocking refresh token persistence
      }
    } else {
      adminUser.refreshTokens = [...(adminUser.refreshTokens || []).slice(-9), refreshEntry];
    }

    const userSummary: UserSummary = {
      id: userId,
      mobile: adminUser.mobile,
      email: adminUser.email,
      role: 'admin',
      hasProfile: adminUser.hasProfile || false,
      profileFor: adminUser.profileFor || 'myself',
      status: adminUser.status || 'active',
      approvalStatus: adminUser.approvalStatus || 'approved',
      approvedBy: adminUser.approvedBy?.toString?.() || adminUser.approvedBy,
      approvedAt: adminUser.approvedAt?.toISOString?.() || adminUser.approvedAt,
      displayName: adminUser.displayName || 'Administrator',
      avatarUrl: adminUser.avatarUrl,
      createdAt: adminUser.createdAt?.toISOString?.() || new Date().toISOString(),
    };

    return { user: userSummary, tokens };
  }

  /**
   * Retrieves high-level dashboard metrics and statistics
   */
  public static async getDashboardStats(): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      const allUsers = Array.from(inMemoryAdminStore.values());
      const pendingUsers = allUsers.filter((u) => u.approvalStatus === 'pending');
      const approvedUsers = allUsers.filter((u) => u.approvalStatus === 'approved');
      const rejectedUsers = allUsers.filter((u) => u.approvalStatus === 'rejected');

      return {
        databaseConnected: false,
        totalUsers: allUsers.length,
        pendingApprovals: pendingUsers.length,
        approvedUsers: approvedUsers.length,
        rejectedUsers: rejectedUsers.length,
        suspendedUsers: allUsers.filter((u) => u.status === 'suspended').length,
        activeMemberships: 0,
        pendingVerifications: 0,
        openReports: 0,
        totalProfiles: 0,
        verifiedProfiles: 0,
        pendingProfiles: 0,
        membershipPlans: { free: 0, silver: 0, gold: 0, platinum: 0 },
        totalReports: 0,
        pendingReports: 0,
        totalBookings: 0,
        pendingBookings: 0,
        recentBookings: [],
        recentUsers: allUsers.slice(-5),
        recentApprovals: pendingUsers.slice(-5),
        recentReports: [],
        recentAudits: inMemoryAuditStore.slice(-5),
      };
    }

    const cachedStats = readCache.get('admin:dashboard:stats');
    if (cachedStats) {
      return cachedStats;
    }

    const [
      totalUsers,
      pendingApprovals,
      approvedUsers,
      rejectedUsers,
      suspendedUsers,
      totalProfiles,
      verifiedProfiles,
      totalReports,
      pendingReports,
      activeMemberships,
      totalPandits,
      pendingPandits,
      totalBookings,
      pendingBookings,
      pendingCommunityPosts,
      pendingIdentityRequests,
      recentUsers,
      recentApprovals,
      recentReports,
      recentAudits,
      recentBookings,
      membershipAgg,
    ] = await Promise.all([
      UserModel.countDocuments({ status: { $ne: 'deleted' } }),
      UserModel.countDocuments({ approvalStatus: 'pending', status: { $ne: 'deleted' } }),
      UserModel.countDocuments({ approvalStatus: 'approved', status: { $ne: 'deleted' } }),
      UserModel.countDocuments({ approvalStatus: 'rejected', status: { $ne: 'deleted' } }),
      UserModel.countDocuments({ status: 'suspended' }),
      ProfileModel.countDocuments(),
      ProfileModel.countDocuments({ isVerified: true }),
      ReportModel.countDocuments(),
      ReportModel.countDocuments({ status: 'pending' }),
      MembershipModel.countDocuments({ status: 'active', planId: { $ne: 'free' } }),
      PanditModel.countDocuments(),
      PanditModel.countDocuments({ verificationStatus: 'pending' }),
      BookingModel.countDocuments(),
      BookingModel.countDocuments({ status: { $in: ['pending', 'requested'] } }),
      CommunityPostModel.countDocuments({ moderationStatus: 'pending' }),
      VerificationRequestModel.countDocuments({ status: 'pending' }),
      UserModel.find({ status: { $ne: 'deleted' } })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('mobile email role status approvalStatus displayName createdAt hasProfile'),
      UserModel.find({ approvalStatus: 'pending', status: { $ne: 'deleted' } })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('mobile email role status approvalStatus displayName createdAt hasProfile'),
      ReportModel.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('reporterId', 'displayName mobile email')
        .populate('reportedUserId', 'displayName mobile email'),
      AuditLogModel.find()
        .sort({ createdAt: -1 })
        .limit(8),
      BookingModel.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      MembershipModel.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$planId', count: { $sum: 1 } } },
      ]),
    ]);

    const membershipPlans: Record<string, number> = { free: 0, silver: 0, gold: 0, platinum: 0, plus: 0, premium: 0 };
    for (const item of membershipAgg) {
      if (item._id) {
        membershipPlans[item._id] = item.count;
        if (item._id === 'plus') {
          membershipPlans.silver = (membershipPlans.silver || 0) + item.count;
        } else if (item._id === 'premium') {
          membershipPlans.gold = (membershipPlans.gold || 0) + item.count;
          membershipPlans.platinum = (membershipPlans.platinum || 0) + item.count;
        }
      }
    }

    const statsPayload = {
      databaseConnected: true,
      totalUsers,
      pendingApprovals,
      approvedUsers,
      rejectedUsers,
      suspendedUsers,
      activeMemberships,
      pendingVerifications: Math.max(0, totalProfiles - verifiedProfiles) + pendingIdentityRequests,
      pendingIdentityRequests,
      openReports: pendingReports,
      totalPandits,
      pendingPandits,
      totalBookings,
      pendingBookings,
      pendingCommunityPosts,
      totalProfiles,
      verifiedProfiles,
      pendingProfiles: Math.max(0, totalProfiles - verifiedProfiles),
      membershipPlans,
      totalReports,
      pendingReports,
      recentUsers,
      recentApprovals,
      recentReports,
      recentAudits,
      recentBookings: (recentBookings || []).map((b: any) => ({
        id: b._id?.toString(),
        bookingReference: b.bookingReference,
        userName: b.userName,
        userMobile: b.userMobile,
        serviceName: b.serviceName,
        bookingDate: b.bookingDate,
        timeSlot: b.timeSlot,
        mode: b.mode,
        status: b.status,
        createdAt: b.createdAt,
      })),
    };
    readCache.set('admin:dashboard:stats', statsPayload, 10_000);
    return statsPayload;
  }

  /**
   * Retrieves paginated list of users with optional filtering
   */
  public static async getUsers(query: {
    search?: string;
    role?: string;
    status?: string;
    approvalStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (!isDbConnected) {
      const users = Array.from(inMemoryAdminStore.values());
      return { users, total: users.length, page, limit, totalPages: 1 };
    }

    const filter: any = { status: { $ne: 'deleted' } };

    if (query.role) {
      filter.role = query.role;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.approvalStatus && query.approvalStatus !== 'all') {
      filter.approvalStatus = query.approvalStatus;
    }
    if (query.search) {
      const s = query.search.trim();
      filter.$or = [
        { email: { $regex: s, $options: 'i' } },
        { mobile: { $regex: s, $options: 'i' } },
        { displayName: { $regex: s, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-passwordHash -refreshTokens'),
      UserModel.countDocuments(filter),
    ]);

    // Attach profile (including signed photos) and membership information
    const userIds = users.map((u) => u._id);
    const [profiles, memberships] = await Promise.all([
      ProfileModel.find({ userId: { $in: userIds } })
        .select('userId firstName lastName isVerified photoChecked gender dateOfBirth city state education occupation completenessPercent photos')
        .lean(),
      MembershipModel.find({ userId: { $in: userIds }, status: 'active' }).select('userId planId expiresAt').lean(),
    ]);

    const profileMap = new Map(
      profiles
        .filter((p: any) => p && p.userId)
        .map((p: any) => [p.userId.toString(), p])
    );
    const membershipMap = new Map(
      memberships
        .filter((m: any) => m && m.userId)
        .map((m: any) => [m.userId.toString(), m])
    );

    const enrichedUsers = users.map((u) => {
      const idStr = u._id.toString();
      const rawProfile: any = profileMap.get(idStr) || null;
      let enrichedProfile: any = null;

      if (rawProfile) {
        const signedPhotos = (rawProfile.photos || []).map((ph: any) => ({
          ...ph,
          id: ph._id?.toString() || ph.id,
          ...presentPhoto(ph.url, ph.publicId),
        }));
        const mainPh = signedPhotos.find((ph: any) => ph.isMain) || signedPhotos[0];
        enrichedProfile = {
          ...rawProfile,
          age: rawProfile.dateOfBirth
            ? Math.floor((Date.now() - new Date(rawProfile.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
            : undefined,
          photos: signedPhotos,
          photosCount: signedPhotos.length,
          mainPhotoUrl: mainPh?.variants?.avatar || mainPh?.url || null,
        };
      }

      const rawUser = u.toObject();
      const mainPhotoUrl =
        enrichedProfile?.mainPhotoUrl ||
        presentPhotoUrl(rawUser.avatarUrl, 'avatar') ||
        null;

      return {
        ...rawUser,
        mainPhotoUrl,
        photosCount: enrichedProfile?.photosCount || 0,
        profile: enrichedProfile,
        membership: membershipMap.get(idStr) || { planId: 'free', status: 'active' },
      };
    });

    return {
      users: enrichedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves complete live user biodata, signed photos, preferences, kundli,
   * membership, verification requests, and safety reports for admin inspection.
   * Always available regardless of approvalStatus (pending, approved, rejected, changes_requested).
   */
  public static async getUserDetails(targetUserId: string): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      const u = inMemoryAdminStore.get(targetUserId);
      if (!u) {
        throw new AppError('User account not found.', 404, 'NOT_FOUND');
      }
      const p = inMemoryProfileStore.get(targetUserId) || u.profile || null;
      return {
        id: u._id?.toString() || u.id,
        mobile: u.mobile,
        email: u.email,
        displayName: u.displayName || (p ? `${p.firstName} ${p.lastName}`.trim() : 'Member'),
        avatarUrl: u.avatarUrl,
        role: u.role || 'member',
        status: u.status || 'active',
        approvalStatus: u.approvalStatus || 'pending',
        phoneVerified: u.phoneVerified ?? !!u.mobile,
        identityVerificationStatus: u.identityVerificationStatus || 'none',
        identityDocumentType: u.identityDocumentType,
        identityDocumentReferenceMasked: u.identityDocumentReferenceMasked,
        photoApprovalStatus: u.photoApprovalStatus || 'none',
        rejectionReason: u.rejectionReason,
        moderationRemarks: u.moderationRemarks,
        approvedBy: u.approvedBy,
        approvedAt: u.approvedAt?.toISOString?.() || u.approvedAt,
        createdAt: u.createdAt?.toISOString?.() || new Date().toISOString(),
        hasProfile: !!p || !!u.hasProfile,
        profile: p,
        preferences: u.preferences || null,
        kundli: u.kundli || null,
        membership: u.membership || { planId: 'free', status: 'active' },
        verifications: [],
        reports: [],
      };
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_ID');
    }

    const u = await UserModel.findById(targetUserId).select('-passwordHash -refreshTokens');
    if (!u) {
      throw new AppError('User account not found.', 404, 'NOT_FOUND');
    }

    const [p, pref, kun, membership, verifications, reports]: any[] = await Promise.all([
      ProfileModel.findOne({ userId: u._id }).lean(),
      PartnerPreferenceModel.findOne({ userId: u._id }).lean(),
      KundliModel.findOne({ userId: u._id }).lean(),
      MembershipModel.findOne({ userId: u._id, status: 'active' }).lean(),
      VerificationRequestModel.find({ userId: u._id }).sort({ createdAt: -1 }).limit(10).lean(),
      ReportModel.find({ reportedUserId: u._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('reporterId', 'displayName email mobile')
        .lean(),
    ]);

    const signedPhotos = (p?.photos || []).map((ph: any) => ({
      ...ph,
      id: ph._id?.toString() || ph.id,
      ...presentPhoto(ph.url, ph.publicId),
    }));
    const mainPhoto = signedPhotos.find((ph: any) => ph.isMain) || signedPhotos[0];

    return {
      id: u._id.toString(),
      mobile: u.mobile,
      email: u.email,
      displayName: u.displayName || (p ? `${p.firstName} ${p.lastName}`.trim() : 'Member'),
      avatarUrl:
        mainPhoto?.variants?.avatar ||
        mainPhoto?.url ||
        presentPhotoUrl(u.avatarUrl, 'avatar'),
      role: u.role,
      status: u.status,
      approvalStatus: u.approvalStatus || 'pending',
      phoneVerified: u.phoneVerified ?? !!u.mobile,
      identityVerificationStatus: u.identityVerificationStatus || 'none',
      identityDocumentType: u.identityDocumentType,
      identityDocumentReferenceMasked: u.identityDocumentReferenceMasked,
      photoApprovalStatus:
        u.photoApprovalStatus ||
        (signedPhotos.length ? (signedPhotos.some((ph: any) => ph.approved !== false) ? 'approved' : 'rejected') : 'none'),
      rejectionReason: u.rejectionReason,
      moderationRemarks: u.moderationRemarks,
      approvedBy: u.approvedBy?.toString(),
      approvedAt: u.approvedAt?.toISOString(),
      createdAt: u.createdAt.toISOString(),
      hasProfile: u.hasProfile || !!p,
      profile: p
        ? {
            id: p._id.toString(),
            firstName: p.firstName,
            lastName: p.lastName,
            gender: p.gender,
            age: p.dateOfBirth
              ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
              : undefined,
            dateOfBirth: p.dateOfBirth?.toISOString ? p.dateOfBirth.toISOString() : p.dateOfBirth,
            maritalStatus: p.maritalStatus,
            heightCm: p.heightCm,
            motherTongue: p.motherTongue,
            religion: p.religion,
            caste: p.caste,
            gotra: p.gotra,
            manglik: p.manglik,
            city: p.city,
            state: p.state,
            country: p.country,
            familyValues: p.familyValues,
            familyType: p.familyType,
            fatherOccupation: p.fatherOccupation,
            motherOccupation: p.motherOccupation,
            education: p.education,
            employedIn: p.employedIn,
            occupation: p.occupation,
            annualIncomeBand: p.annualIncomeBand,
            showIncomeBand: p.showIncomeBand,
            completenessPercent: p.completenessPercent,
            isVerified: p.isVerified,
            photoChecked: p.photoChecked,
            photoPrivacy: p.photoPrivacy,
            aboutMe: p.aboutMe,
            photos: signedPhotos,
          }
        : null,
      preferences: pref
        ? {
            minAge: pref.minAge,
            maxAge: pref.maxAge,
            minHeightCm: pref.minHeightCm,
            maxHeightCm: pref.maxHeightCm,
            maritalStatuses: pref.maritalStatuses,
            religions: pref.religions,
            motherTongues: pref.motherTongues,
            educations: pref.educations,
            occupations: pref.occupations,
            cities: pref.cities,
            manglikPreference: pref.manglikPreference,
          }
        : null,
      kundli: kun
        ? {
            rashi: kun.rashi,
            nakshatra: kun.nakshatra,
            charan: kun.charan,
            timeOfBirth: kun.timeOfBirth,
            isApproximateTime: kun.isApproximateTime,
            birthPlace: kun.birthPlace,
            manglikStatus: kun.manglikStatus,
            visibility: kun.visibility,
          }
        : null,
      membership: membership
        ? {
            planId: membership.planId,
            status: membership.status,
            expiresAt: membership.expiresAt?.toISOString?.() || membership.expiresAt,
          }
        : { planId: 'free', status: 'active' },
      verifications: (verifications || []).map((v: any) => ({
        id: v._id.toString(),
        documentType: v.documentType,
        documentReferenceMasked: v.documentReferenceMasked,
        status: v.status,
        rejectionReason: v.rejectionReason,
        createdAt: v.createdAt?.toISOString?.() || v.createdAt,
      })),
      reports: (reports || []).map((r: any) => ({
        id: r._id.toString(),
        category: r.category,
        reason: r.reason || r.description,
        status: r.status,
        reporterName: r.reporterId?.displayName || r.reporterId?.email || r.reporterId?.mobile || 'Member',
        createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      })),
    };
  }

  /**
   * Retrieves pending approvals with submitted matrimonial biodata and photos
   */
  public static async getApprovals(query: {
    approvalStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: PendingApprovalItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const requestedStatus = query.approvalStatus || 'pending';

    if (!isDbConnected) {
      let filtered = Array.from(inMemoryAdminStore.values()).filter((u) => {
        if (requestedStatus === 'all') return true;
        return (u.approvalStatus || 'pending') === requestedStatus;
      });

      if (query.search) {
        const s = query.search.toLowerCase();
        filtered = filtered.filter(
          (u) =>
            u.displayName?.toLowerCase().includes(s) ||
            u.email?.toLowerCase().includes(s) ||
            u.mobile?.includes(s)
        );
      }

      const items: PendingApprovalItem[] = filtered.map((u) => ({
        id: u._id?.toString() || u.id,
        mobile: u.mobile,
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        role: u.role || 'member',
        status: u.status || 'active',
        approvalStatus: (u.approvalStatus as ApprovalStatus) || 'pending',
        phoneVerified: u.phoneVerified ?? !!u.mobile,
        identityVerificationStatus: u.identityVerificationStatus || 'none',
        identityDocumentType: u.identityDocumentType,
        identityDocumentReferenceMasked: u.identityDocumentReferenceMasked,
        photoApprovalStatus: u.photoApprovalStatus || 'pending',
        rejectionReason: u.rejectionReason,
        moderationRemarks: u.moderationRemarks,
        approvedBy: u.approvedBy,
        approvedAt: u.approvedAt?.toISOString?.() || u.approvedAt,
        createdAt: u.createdAt?.toISOString?.() || new Date().toISOString(),
        hasProfile: !!u.hasProfile,
        profile: u.profile || null,
        preferences: u.preferences || null,
        kundli: u.kundli || null,
      }));

      return {
        items,
        total: items.length,
        page: 1,
        limit,
        totalPages: 1,
      };
    }

    const filter: any = { status: { $ne: 'deleted' } };

    if (requestedStatus !== 'all') {
      filter.approvalStatus = requestedStatus;
    }

    if (query.search) {
      const s = query.search.trim();
      filter.$or = [
        { email: { $regex: s, $options: 'i' } },
        { mobile: { $regex: s, $options: 'i' } },
        { displayName: { $regex: s, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-passwordHash -refreshTokens'),
      UserModel.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const [profiles, preferences, kundlis, verifications] = await Promise.all([
      ProfileModel.find({ userId: { $in: userIds } }).lean(),
      PartnerPreferenceModel.find({ userId: { $in: userIds } }).lean(),
      KundliModel.find({ userId: { $in: userIds } }).lean(),
      VerificationRequestModel.find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).lean(),
    ]);

    const profileMap = new Map(
      profiles
        .filter((p: any) => p && p.userId)
        .map((p: any) => [p.userId.toString(), p])
    );
    const prefMap = new Map(
      preferences
        .filter((pr: any) => pr && pr.userId)
        .map((pr: any) => [pr.userId.toString(), pr])
    );
    const kundliMap = new Map(
      kundlis
        .filter((k: any) => k && k.userId)
        .map((k: any) => [k.userId.toString(), k])
    );
    const verifMap = new Map<string, any>();
    for (const v of verifications as any[]) {
      const uid = v?.userId?.toString();
      if (uid && !verifMap.has(uid)) {
        verifMap.set(uid, {
          id: v._id.toString(),
          documentType: v.documentType,
          documentReferenceMasked: v.documentReferenceMasked,
          status: v.status,
          createdAt: v.createdAt?.toISOString?.() || v.createdAt,
        });
      }
    }

    const items: PendingApprovalItem[] = users.map((u) => {
      const p: any = profileMap.get(u._id.toString());
      const pref: any = prefMap.get(u._id.toString());
      const kun: any = kundliMap.get(u._id.toString());
      const latestVerif: any = verifMap.get(u._id.toString()) || null;

      return {
        id: u._id.toString(),
        mobile: u.mobile,
        email: u.email,
        displayName: u.displayName || (p ? `${p.firstName} ${p.lastName}`.trim() : 'New Applicant'),
        avatarUrl: u.avatarUrl || presentPhotoUrl((p?.photos?.find((ph: any) => ph.isMain)?.url) || (p?.photos?.[0]?.url), 'avatar'),
        role: u.role,
        status: u.status,
        approvalStatus: u.approvalStatus || 'pending',
        phoneVerified: u.phoneVerified ?? !!u.mobile,
        identityVerificationStatus: u.identityVerificationStatus || 'none',
        identityDocumentType: u.identityDocumentType || latestVerif?.documentType,
        identityDocumentReferenceMasked: u.identityDocumentReferenceMasked || latestVerif?.documentReferenceMasked,
        latestVerification: latestVerif,
        photoApprovalStatus: u.photoApprovalStatus || (p?.photos?.length ? (p.photos.some((ph: any) => ph.approved) ? 'approved' : 'pending') : 'none'),
        rejectionReason: u.rejectionReason,
        moderationRemarks: u.moderationRemarks,
        approvedBy: u.approvedBy?.toString(),
        approvedAt: u.approvedAt?.toISOString(),
        createdAt: u.createdAt.toISOString(),
        hasProfile: u.hasProfile,
        profile: p
          ? {
              id: p._id.toString(),
              firstName: p.firstName,
              lastName: p.lastName,
              gender: p.gender,
              age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)) : undefined,
              dateOfBirth: p.dateOfBirth?.toISOString ? p.dateOfBirth.toISOString() : p.dateOfBirth,
              maritalStatus: p.maritalStatus,
              heightCm: p.heightCm,
              motherTongue: p.motherTongue,
              religion: p.religion,
              caste: p.caste,
              gotra: p.gotra,
              manglik: p.manglik,
              city: p.city,
              state: p.state,
              country: p.country,
              familyValues: p.familyValues,
              familyType: p.familyType,
              fatherOccupation: p.fatherOccupation,
              motherOccupation: p.motherOccupation,
              education: p.education,
              employedIn: p.employedIn,
              occupation: p.occupation,
              annualIncomeBand: p.annualIncomeBand,
              showIncomeBand: p.showIncomeBand,
              completenessPercent: p.completenessPercent,
              isVerified: p.isVerified,
              photoChecked: p.photoChecked,
              photoPrivacy: p.photoPrivacy,
              aboutMe: p.aboutMe,
              photos: (p.photos || []).map((ph: any) => ({
                ...(ph.toObject?.() ?? ph),
                ...presentPhoto(ph.url, ph.publicId), // staff see authenticated photos via signed URLs
              })),
            }
          : null,
        preferences: pref
          ? {
              minAge: pref.minAge,
              maxAge: pref.maxAge,
              minHeightCm: pref.minHeightCm,
              maxHeightCm: pref.maxHeightCm,
              maritalStatuses: pref.maritalStatuses,
              religions: pref.religions,
              motherTongues: pref.motherTongues,
              educations: pref.educations,
              occupations: pref.occupations,
              cities: pref.cities,
              manglikPreference: pref.manglikPreference,
            }
          : null,
        kundli: kun
          ? {
              rashi: kun.rashi,
              nakshatra: kun.nakshatra,
              charan: kun.charan,
              timeOfBirth: kun.timeOfBirth,
              isApproximateTime: kun.isApproximateTime,
              birthPlace: kun.birthPlace,
              manglikStatus: kun.manglikStatus,
              visibility: kun.visibility,
            }
          : null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approves a registered user account
   */
  public static async approveUser(
    adminUser: any,
    targetUserId: string,
    ipAddress?: string
  ): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      const user = inMemoryAdminStore.get(targetUserId);
      if (user) {
        user.approvalStatus = 'approved';
        user.status = 'active';
        user.approvedBy = adminUser.userId || adminUser.id;
        user.approvedAt = new Date();
        delete user.rejectionReason;
        delete user.moderationRemarks;
      }
      const prof = inMemoryProfileStore.get(targetUserId);
      if (prof) {
        prof.isVerified = true;
        prof.photoChecked = true;
        if (prof.photos && prof.photos.length > 0) {
          prof.photos.forEach((ph: any) => {
            ph.approved = true;
          });
        }
      }
      return user || { id: targetUserId, approvalStatus: 'approved' };
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw new AppError('Target user account not found.', 404, 'NOT_FOUND');
    }

    const adminId = adminUser.userId || adminUser.id || 'admin';
    user.approvalStatus = 'approved';
    user.status = 'active';
    user.approvedBy = adminId;
    user.approvedAt = new Date();
    user.rejectionReason = undefined;
    user.moderationRemarks = undefined;
    await user.save();

    // Verify associated matrimonial profile if exists and approve photos for public view
    try {
      const profile = await ProfileModel.findOne({ userId: user._id });
      if (profile) {
        profile.isVerified = true;
        profile.photoChecked = true;
        if (profile.photos && profile.photos.length > 0) {
          profile.photos.forEach((ph: any) => {
            ph.approved = true;
          });
          user.photoApprovalStatus = 'approved';
          await user.save();
        }
        await profile.save();
      }
    } catch {
      // Non-blocking
    }

    // Audit Log Entry
    try {
      await AuditLogModel.create({
        adminId: adminUser.userId,
        adminEmail: adminUser.email,
        adminName: adminUser.displayName || 'Administrator',
        action: 'user_approved',
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserMobile: user.mobile,
        details: {
          previousStatus: user.approvalStatus,
          approvedAt: user.approvedAt,
        },
        ipAddress,
      });
    } catch {
      // Non-blocking audit error
    }

    // Real-Time Notification to User Socket Room
    SocketService.emitToUser(user._id.toString(), 'user:approval_status_changed', {
      approvalStatus: 'approved',
      approvedAt: user.approvedAt,
    });

    return user;
  }

  /**
   * Rejects a user registration with mandatory reason
   */
  public static async rejectUser(
    adminUser: any,
    targetUserId: string,
    reason: string,
    remarks?: string,
    ipAddress?: string
  ): Promise<any> {
    if (!reason || !reason.trim()) {
      throw new AppError('A valid rejection reason is mandatory.', 400, 'REASON_REQUIRED');
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      const user = inMemoryAdminStore.get(targetUserId);
      if (user) {
        user.approvalStatus = 'rejected';
        user.rejectionReason = reason.trim();
        user.moderationRemarks = remarks?.trim() || '';
        delete user.approvedBy;
        delete user.approvedAt;
      }
      const prof = inMemoryProfileStore.get(targetUserId);
      if (prof) {
        prof.isVerified = false;
        prof.photoChecked = false;
      }
      return user || { id: targetUserId, approvalStatus: 'rejected', rejectionReason: reason };
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw new AppError('Target user account not found.', 404, 'NOT_FOUND');
    }

    const previousStatus = user.approvalStatus;
    user.approvalStatus = 'rejected';
    user.rejectionReason = reason.trim();
    user.moderationRemarks = remarks?.trim() || '';
    user.approvedBy = undefined;
    user.approvedAt = undefined;
    await user.save();

    // Revoke verified trust badges on profile while keeping all user data & images intact for admin review
    try {
      await ProfileModel.findOneAndUpdate(
        { userId: user._id },
        { $set: { isVerified: false, photoChecked: false } }
      );
    } catch {
      // Non-blocking
    }

    // Audit Log Entry
    try {
      await AuditLogModel.create({
        adminId: adminUser.userId,
        adminEmail: adminUser.email,
        adminName: adminUser.displayName || 'Administrator',
        action: 'user_rejected',
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserMobile: user.mobile,
        details: {
          previousStatus,
          reason: user.rejectionReason,
          remarks: user.moderationRemarks,
        },
        ipAddress,
      });
    } catch {
      // Non-blocking audit error
    }

    // Real-Time Notification to User Socket Room
    SocketService.emitToUser(user._id.toString(), 'user:approval_status_changed', {
      approvalStatus: 'rejected',
      reason: user.rejectionReason,
      remarks: user.moderationRemarks,
    });

    return user;
  }

  /**
   * Requests changes on submitted profile with remarks
   */
  public static async requestChanges(
    adminUser: any,
    targetUserId: string,
    remarks: string,
    ipAddress?: string
  ): Promise<any> {
    if (!remarks || !remarks.trim()) {
      throw new AppError('Remarks detailing requested changes are mandatory.', 400, 'REMARKS_REQUIRED');
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      const user = inMemoryAdminStore.get(targetUserId);
      if (user) {
        user.approvalStatus = 'changes_requested';
        user.moderationRemarks = remarks.trim();
      }
      return user || { id: targetUserId, approvalStatus: 'changes_requested', moderationRemarks: remarks };
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw new AppError('Target user account not found.', 404, 'NOT_FOUND');
    }

    user.approvalStatus = 'changes_requested';
    user.moderationRemarks = remarks.trim();
    await user.save();

    // Audit Log Entry
    try {
      await AuditLogModel.create({
        adminId: adminUser.userId,
        adminEmail: adminUser.email,
        adminName: adminUser.displayName || 'Administrator',
        action: 'changes_requested',
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserMobile: user.mobile,
        details: {
          remarks: user.moderationRemarks,
        },
        ipAddress,
      });
    } catch {
      // Non-blocking audit error
    }

    // Real-Time Notification to User Socket Room
    SocketService.emitToUser(user._id.toString(), 'user:approval_status_changed', {
      approvalStatus: 'changes_requested',
      remarks: user.moderationRemarks,
    });

    return user;
  }

  /**
   * Retrieves administrative audit logs
   */
  public static async getAuditLogs(query: {
    action?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (!isDbConnected) {
      return {
        logs: inMemoryAuditStore.slice(skip, skip + limit),
        total: inMemoryAuditStore.length,
        page,
        limit,
        totalPages: Math.ceil(inMemoryAuditStore.length / limit) || 1,
      };
    }

    const filter: any = {};
    if (query.action && query.action !== 'all') {
      filter.action = query.action;
    }
    if (query.search) {
      const s = query.search.trim();
      filter.$or = [
        { adminEmail: { $regex: s, $options: 'i' } },
        { adminName: { $regex: s, $options: 'i' } },
        { targetUserEmail: { $regex: s, $options: 'i' } },
        { targetUserMobile: { $regex: s, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLogModel.countDocuments(filter),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Updates user status (active / suspended) with audit tracking
   */
  public static async updateUserStatus(
    userId: string,
    status: 'active' | 'suspended',
    adminUser?: any,
    ipAddress?: string
  ): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      const user = inMemoryAdminStore.get(userId);
      if (user) user.status = status;
      return user;
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { status } },
      { new: true }
    ).select('-passwordHash -refreshTokens');

    if (!user) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    // Audit log
    if (adminUser) {
      try {
        await AuditLogModel.create({
          adminId: adminUser.userId,
          adminEmail: adminUser.email,
          adminName: adminUser.displayName || 'Administrator',
          action: status === 'suspended' ? 'user_suspended' : 'user_activated',
          targetUserId: user._id,
          targetUserEmail: user.email,
          targetUserMobile: user.mobile,
          details: { newStatus: status },
          ipAddress,
        });
      } catch {
        // Non-blocking
      }
    }

    return user;
  }

  /**
   * Updates user administrative role with audit tracking
   */
  public static async updateUserRole(
    userId: string,
    role: 'member' | 'pandit' | 'moderator' | 'admin',
    adminUser?: any,
    ipAddress?: string
  ): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      const user = inMemoryAdminStore.get(userId);
      if (user) user.role = role;
      return user;
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true }
    ).select('-passwordHash -refreshTokens');

    if (!user) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    if (adminUser) {
      try {
        await AuditLogModel.create({
          adminId: adminUser.userId,
          adminEmail: adminUser.email,
          adminName: adminUser.displayName || 'Administrator',
          action: 'role_updated',
          targetUserId: user._id,
          targetUserEmail: user.email,
          targetUserMobile: user.mobile,
          details: { newRole: role },
          ipAddress,
        });
      } catch {
        // Non-blocking
      }
    }

    return user;
  }

  /**
   * Retrieves paginated profiles with filtering
   */
  public static async getProfiles(query: {
    isVerified?: boolean;
    gender?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (!isDbConnected) {
      return { profiles: [], total: 0, page, limit, totalPages: 1 };
    }

    const filter: any = {};
    if (query.isVerified !== undefined) {
      filter.isVerified = query.isVerified;
    }
    if (query.gender) {
      filter.gender = query.gender;
    }
    if (query.search) {
      const s = query.search.trim();
      filter.$or = [
        { firstName: { $regex: s, $options: 'i' } },
        { lastName: { $regex: s, $options: 'i' } },
        { city: { $regex: s, $options: 'i' } },
        { education: { $regex: s, $options: 'i' } },
      ];
    }

    const [profiles, total] = await Promise.all([
      ProfileModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'displayName email mobile status role approvalStatus photoApprovalStatus createdAt')
        .lean(),
      ProfileModel.countDocuments(filter),
    ]);

    const enrichedProfiles = profiles.map((p: any) => {
      const signedPhotos = (p.photos || []).map((ph: any) => ({
        ...ph,
        id: ph._id?.toString() || ph.id,
        ...presentPhoto(ph.url, ph.publicId),
      }));
      const mainPhoto = signedPhotos.find((ph: any) => ph.isMain) || signedPhotos[0];
      return {
        ...p,
        age: p.dateOfBirth
          ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
          : undefined,
        photos: signedPhotos,
        photosCount: signedPhotos.length,
        mainPhotoUrl: mainPhoto?.variants?.avatar || mainPhoto?.url || null,
      };
    });

    return {
      profiles: enrichedProfiles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approves or rejects profile verification
   */
  public static async verifyProfile(
    profileId: string,
    isVerified: boolean,
    photoChecked = true,
    adminUser?: any,
    ipAddress?: string
  ): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      return { id: profileId, isVerified, photoChecked };
    }

    const profile = await ProfileModel.findByIdAndUpdate(
      profileId,
      { $set: { isVerified, photoChecked } },
      { new: true }
    );

    if (!profile) {
      throw new AppError('Profile not found.', 404, 'NOT_FOUND');
    }

    if (adminUser) {
      try {
        await AuditLogModel.create({
          adminId: adminUser.userId,
          adminEmail: adminUser.email,
          adminName: adminUser.displayName || 'Administrator',
          action: isVerified ? 'profile_verified' : 'profile_unverified',
          targetUserId: profile.userId,
          details: { profileId, photoChecked },
          ipAddress,
        });
      } catch {
        // Non-blocking
      }
    }

    return profile;
  }

  /**
   * Manually upgrades or adjusts user membership
   */
  public static async updateUserMembership(
    userId: string,
    planId: string,
    durationDays = 30,
    adminUser?: any,
    ipAddress?: string
  ): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    // Normalize plan tier to valid DB enum ('free' | 'plus' | 'premium')
    const normalizedPlanId =
      planId === 'silver' ? 'plus' :
      planId === 'gold' || planId === 'platinum' ? 'premium' :
      ['free', 'plus', 'premium'].includes(planId) ? planId : 'free';

    if (!isDbConnected) {
      return { userId, planId: normalizedPlanId, status: 'active', durationDays };
    }

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const membership = await MembershipModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          planId: normalizedPlanId,
          status: 'active',
          startDate: new Date(),
          expiresAt,
          autoRenew: false,
        },
      },
      { upsert: true, new: true }
    );

    if (adminUser) {
      try {
        await AuditLogModel.create({
          adminId: adminUser.userId,
          adminEmail: adminUser.email,
          adminName: adminUser.displayName || 'Administrator',
          action: 'membership_updated',
          targetUserId: userId,
          details: { planId, durationDays, expiresAt },
          ipAddress,
        });
      } catch {
        // Non-blocking
      }
    }

    return membership;
  }

  /**
   * Retrieves trust & safety reports
   */
  public static async getReports(query: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (!isDbConnected) {
      return { reports: [], total: 0, page, limit, totalPages: 1 };
    }

    const filter: any = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    const [reports, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporterId', 'displayName mobile email avatarUrl')
        .populate('reportedUserId', 'displayName mobile email avatarUrl status approvalStatus'),
      ReportModel.countDocuments(filter),
    ]);

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Updates report status and action taken
   */
  public static async updateReportStatus(
    reportId: string,
    status: 'pending' | 'reviewed' | 'actioned' | 'dismissed',
    actionTaken: 'none' | 'warning' | 'suspended' | 'profile_removed' = 'none',
    adminUser?: any,
    ipAddress?: string
  ): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      return { id: reportId, status, actionTaken };
    }

    const report = await ReportModel.findByIdAndUpdate(
      reportId,
      { $set: { status, actionTaken } },
      { new: true }
    );

    if (!report) {
      throw new AppError('Report not found.', 404, 'NOT_FOUND');
    }

    // If action taken is 'suspended', suspend the reported user
    if (actionTaken === 'suspended' && report.reportedUserId) {
      await UserModel.findByIdAndUpdate(report.reportedUserId, {
        $set: { status: 'suspended' },
      });
    }

    if (adminUser) {
      try {
        await AuditLogModel.create({
          adminId: adminUser.userId,
          adminEmail: adminUser.email,
          adminName: adminUser.displayName || 'Administrator',
          action: 'report_updated',
          targetUserId: report.reportedUserId,
          details: { reportId, status, actionTaken },
          ipAddress,
        });
      } catch {
        // Non-blocking
      }
    }

    return report;
  }

  /**
   * Admin: Upload public matrimonial promotional banner to Cloudinary
   */
  public static async uploadBanner(
    adminUser: any,
    payload: { base64?: string; title?: string; linkUrl?: string; priority?: number },
    ipAddress?: string
  ): Promise<any> {
    const safeLink = sanitizeBannerLink(payload.linkUrl);
    if (!payload.base64) {
      throw new AppError('Banner image payload (base64) is required.', 400, 'VALIDATION_ERROR');
    }

    let rawBase64 = String(payload.base64);
    if (rawBase64.includes(';base64,')) {
      rawBase64 = rawBase64.split(';base64,').pop() || '';
    }
    const buffer = Buffer.from(rawBase64, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      throw new AppError('Banner image exceeds 5MB limit.', 400, 'FILE_TOO_LARGE');
    }

    const format = StorageService.detectFileFormat(buffer);
    if (!['jpeg', 'png', 'webp'].includes(format)) {
      throw new AppError(`Invalid image content. Expected JPEG, PNG, or WebP but detected '${format}'.`, 400, 'INVALID_FILE_TYPE');
    }

    const uploadRes = await StorageService.uploadToCloudinary(buffer, {
      folder: 'shaadibanao/banners',
      tags: ['shaadibanao', 'banner', 'matrimonial_public'],
    });

    const isDbConnected = mongoose.connection.readyState === 1;
    let bannerDoc: any = null;

    if (isDbConnected) {
      bannerDoc = await BannerModel.create({
        title: payload.title?.trim() || 'ShaadiBanao Matrimonial Banner',
        imageUrl: uploadRes.secureUrl,
        publicId: uploadRes.publicId,
        linkUrl: safeLink,
        priority: payload.priority || 0,
        isActive: true,
        uploadedBy: adminUser.userId || adminUser.id,
      });

      await AuditLogModel.create({
        adminId: adminUser.userId || adminUser.id,
        adminEmail: adminUser.email,
        adminName: adminUser.displayName || 'Administrator',
        action: 'UPLOAD_BANNER',
        details: {
          bannerId: bannerDoc._id.toString(),
          title: bannerDoc.title,
          publicId: uploadRes.publicId,
          url: uploadRes.secureUrl,
        },
        ipAddress,
      });
    } else {
      bannerDoc = {
        id: `banner_${Date.now()}`,
        _id: `banner_${Date.now()}`,
        title: payload.title?.trim() || 'ShaadiBanao Matrimonial Banner',
        imageUrl: uploadRes.secureUrl,
        publicId: uploadRes.publicId,
        linkUrl: safeLink,
        priority: payload.priority || 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
    }

    return bannerDoc;
  }

  /**
   * Admin: List active banners
   */
  public static async getBanners(): Promise<any[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return [];
    }
    return BannerModel.find({ isActive: true }).sort({ priority: -1, createdAt: -1 }).lean();
  }

  /**
   * Admin: Delete/Deactivate banner
   */
  public static async deleteBanner(bannerId: string, adminUser: any, ipAddress?: string): Promise<boolean> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return true;
    }

    const banner = await BannerModel.findById(bannerId);
    if (!banner) {
      throw new AppError('Banner not found.', 404, 'NOT_FOUND');
    }

    if (banner.publicId) {
      await StorageService.deleteFromCloudinary(banner.publicId);
    }

    await BannerModel.findByIdAndDelete(bannerId);

    await AuditLogModel.create({
      adminId: adminUser.userId || adminUser.id,
      adminEmail: adminUser.email,
      adminName: adminUser.displayName || 'Administrator',
      action: 'DELETE_BANNER',
      details: { bannerId, publicId: banner.publicId },
      ipAddress,
    });

    return true;
  }

  /**
   * Help & Support - List all customer inquiries
   */
  public static async getSupportInquiries(query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return { items: [], pagination: { totalCount: 0, page: 1, limit: 20, totalPages: 1 } };
    }
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { ticketId: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      ContactInquiryModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ContactInquiryModel.countDocuments(filter),
    ]);

    return {
      items: items.map((inq: any) => ({
        id: inq._id.toString(),
        ticketId: inq.ticketId,
        name: inq.name,
        email: inq.email,
        phone: inq.phone || 'N/A',
        category: inq.category,
        subject: inq.subject,
        message: inq.message,
        status: inq.status,
        createdAt: inq.createdAt?.toISOString(),
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
   * Help & Support - Update inquiry status
   */
  public static async updateSupportInquiryStatus(
    id: string,
    status: string,
    adminUser: any
  ): Promise<any> {
    const inq = await ContactInquiryModel.findById(id);
    if (!inq) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
    inq.status = status as any;
    await inq.save();

    const adminId = typeof adminUser === 'string' ? adminUser : (adminUser?.userId || adminUser?.id || adminUser?._id);
    const adminEmail = typeof adminUser === 'object' ? (adminUser?.email || 'admin@shaadibanao.com') : 'admin@shaadibanao.com';
    const adminName = typeof adminUser === 'object' ? (adminUser?.displayName || 'Administrator') : 'Administrator';

    if (adminId) {
      await AuditLogModel.create({
        adminId,
        adminEmail,
        adminName,
        action: 'UPDATE_SUPPORT_INQUIRY',
        details: { inquiryId: id, newStatus: status, ticketId: inq.ticketId },
      });
    }
    return inq;
  }

  /**
   * Payments & Transactions - List memberships with payment history
   */
  public static async getPaymentsList(query: {
    page?: number;
    limit?: number;
    planId?: string;
    type?: string;
  }): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return { items: [], pagination: { totalCount: 0, page: 1, limit: 20, totalPages: 1 } };
    }

    // Check unified PaymentModel first
    const paymentFilter: any = {};
    if (query.type && query.type !== 'all') {
      paymentFilter.type = query.type;
    }

    const paymentCount = await PaymentModel.countDocuments(paymentFilter);
    if (paymentCount > 0) {
      const [payments, totalCount] = await Promise.all([
        PaymentModel.find(paymentFilter)
          .populate('userId', 'displayName email mobile role')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Promise.resolve(paymentCount),
      ]);

      return {
        items: payments.map((p: any) => ({
          id: p._id.toString(),
          orderId: p.orderId,
          paymentId: p.paymentId || 'N/A',
          userId: p.userId?._id?.toString() || p.userId?.toString(),
          userName: p.userName || p.userId?.displayName || 'User',
          userEmail: p.userEmail || p.userId?.email || 'N/A',
          userMobile: p.userMobile || p.userId?.mobile || 'N/A',
          planId: p.referenceId || p.type,
          type: p.type,
          referenceDescription: p.referenceDescription || `${p.type} payment`,
          amountInr: p.amount,
          currency: p.currency || 'INR',
          status: p.status,
          gateway: p.gateway || 'razorpay',
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

    // Fallback: Legacy MembershipModel query
    const filter: any = {};
    if (query.planId && query.planId !== 'all') {
      filter.planId = query.planId;
    }

    const [items, totalCount] = await Promise.all([
      MembershipModel.find(filter)
        .populate('userId', 'displayName email mobile role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MembershipModel.countDocuments(filter),
    ]);

    const PLAN_PRICES: Record<string, number> = {
      free: 0,
      plus: 2999,
      premium: 4999,
    };

    return {
      items: items.map((m: any) => ({
        id: m._id.toString(),
        userId: m.userId?._id?.toString() || m.userId?.toString(),
        userName: m.userId?.displayName || 'User',
        userEmail: m.userId?.email || 'N/A',
        userMobile: m.userId?.mobile || 'N/A',
        planId: m.planId,
        type: 'membership',
        amountInr: PLAN_PRICES[m.planId] || 0,
        status: m.status,
        contactDisclosuresUsed: m.contactDisclosuresUsed || 0,
        startDate: m.startDate?.toISOString(),
        expiresAt: m.expiresAt?.toISOString(),
        createdAt: m.createdAt?.toISOString(),
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
   * Services Catalog - Get all puja services
   */
  public static async getServicesCatalog(): Promise<any[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) return [];

    let services = await ServiceCatalogModel.find().sort({ ceremonyType: 1, name: 1 }).lean();

    // Auto-seed default catalog if empty
    if (services.length === 0) {
      const defaults = [
        {
          serviceId: 'wedding',
          name: 'Vivah Sanskar (Wedding Ceremony)',
          nameHi: 'विवाह संस्कार',
          category: 'Vedic Wedding Ceremonies',
          description: 'Traditional Vedic Vivah ceremony including Jaymala, Kanyadaan, Saptapadi, and Sindoor Daan.',
          descriptionHi: 'पारंपरिक वैदिक विवाह संस्कार जिसमें जयमाला, कन्यादान, सप्तपदी और सिन्दूर दान शामिल हैं।',
          priceInr: 15100,
          durationMinutes: 240,
          isActive: true,
          ceremonyType: 'wedding',
        },
        {
          serviceId: 'engagement',
          name: 'Sagai & Ring Ceremony (Engagement)',
          nameHi: 'सगाई और अंगूठी समारोह',
          category: 'Vedic Wedding Ceremonies',
          description: 'Auspicious engagement rituals, ring exchange blessings, and Ganesh Pujan.',
          descriptionHi: 'शुभ सगाई अनुष्ठान, अंगूठी विनिमय आशीर्वाद एवं गणेश पूजन।',
          priceInr: 5100,
          durationMinutes: 120,
          isActive: true,
          ceremonyType: 'engagement',
        },
        {
          serviceId: 'griha_pravesh',
          name: 'Griha Pravesh & Vastu Shanti',
          nameHi: 'गृह प्रवेश एवं वास्तु शांति',
          category: 'Home & Vastu Pujas',
          description: 'Purification and blessings for entering a new home, Vastu dosha shanti, and havan.',
          descriptionHi: 'नए घर में प्रवेश, वास्तु दोष शांति और हवन के लिए शुद्धिकरण और आशीर्वाद।',
          priceInr: 7100,
          durationMinutes: 180,
          isActive: true,
          ceremonyType: 'griha_pravesh',
        },
        {
          serviceId: 'satyanarayan_puja',
          name: 'Shri Satyanarayan Katha & Puja',
          nameHi: 'श्री सत्यनारायण कथा एवं पूजा',
          category: 'Auspicious Kathas & Havans',
          description: 'Full reading of Sri Satyanarayan Katha, Panchamrit snan, and Aarti for family prosperity.',
          descriptionHi: 'पारिवारिक सुख-समृद्धि हेतु श्री सत्यनारायण कथा, पंचामृत स्नान और महाआरती।',
          priceInr: 3100,
          durationMinutes: 120,
          isActive: true,
          ceremonyType: 'satyanarayan_puja',
        },
        {
          serviceId: 'rudrabhishek',
          name: 'Maha Rudrabhishek Puja',
          nameHi: 'महा रुद्राभिषेक पूजा',
          category: 'Auspicious Kathas & Havans',
          description: 'Sacred Shiva Abhishek with milk, honey, sugarcane juice, and chanting of Sri Rudram.',
          descriptionHi: 'दूध, शहद, गन्ने के रस और श्री रुद्रम पाठ के साथ पवित्र शिव अभिषेक।',
          priceInr: 5100,
          durationMinutes: 150,
          isActive: true,
          ceremonyType: 'rudrabhishek',
        },
        {
          serviceId: 'kundli_milan',
          name: 'Vedic Kundli Milan (36 Gunas)',
          nameHi: 'वैदिक कुंडली मिलान (36 गुण)',
          category: 'Astrological Consultations',
          description: 'In-depth horoscope compatibility, Manglik dosha analysis, and remedy guidance.',
          descriptionHi: 'विस्तृत कुंडली मिलान, मांगलिक दोष विश्लेषण और वैदिक उपाय।',
          priceInr: 1100,
          durationMinutes: 60,
          isActive: true,
          ceremonyType: 'kundli_milan',
        },
        {
          serviceId: 'puja_havan',
          name: 'Vedic Puja & Havan Anushthan',
          nameHi: 'वैदिक पूजा एवं हवन अनुष्ठान',
          category: 'Auspicious Kathas & Havans',
          description: 'Customized Vedic ritual and fire sacrifice for peace, health, and spiritual elevation.',
          descriptionHi: 'शांति, स्वास्थ्य और आध्यात्मिक उन्नति के लिए विशेष वैदिक हवन और अनुष्ठान।',
          priceInr: 5500,
          durationMinutes: 180,
          isActive: true,
          ceremonyType: 'puja_havan',
        },
        {
          serviceId: 'kundli_jyotish',
          name: 'Vedic Horoscope & Jyotish Consultation',
          nameHi: 'ज्योतिष एवं भविष्यफल परामर्श',
          category: 'Astrological Consultations',
          description: 'Direct 1-on-1 consultation with Acharyas on career, marriage timing, and remedies.',
          descriptionHi: 'विवाह योग, करियर और ग्रहों के समाधान हेतु आचार्यों से सीधा परामर्श।',
          priceInr: 999,
          durationMinutes: 45,
          isActive: true,
          ceremonyType: 'kundli_jyotish',
        },
      ];
      await ServiceCatalogModel.insertMany(defaults);
      services = await ServiceCatalogModel.find().sort({ ceremonyType: 1, name: 1 }).lean();
    }

    return services.map((s: any) => ({
      id: s._id.toString(),
      serviceId: s.serviceId,
      name: s.name,
      nameHi: s.nameHi || s.name,
      category: s.category,
      description: s.description,
      descriptionHi: s.descriptionHi || s.description,
      priceInr: s.priceInr,
      durationMinutes: s.durationMinutes,
      isActive: s.isActive,
      ceremonyType: s.ceremonyType,
    }));
  }

  /**
   * Services Catalog - Save or update service
   */
  public static async saveServiceCatalogItem(data: any, adminUser: any): Promise<any> {
    const serviceId = data.serviceId?.trim() || `srv_${Date.now()}`;
    const item = await ServiceCatalogModel.findOneAndUpdate(
      { serviceId },
      {
        serviceId,
        name: data.name?.trim(),
        nameHi: data.nameHi?.trim(),
        category: data.category?.trim() || 'Vedic Ceremonies',
        description: data.description?.trim() || '',
        descriptionHi: data.descriptionHi?.trim() || '',
        priceInr: Number(data.priceInr) || 0,
        durationMinutes: Number(data.durationMinutes) || 60,
        isActive: data.isActive !== false,
        ceremonyType: data.ceremonyType || 'other_puja',
      },
      { upsert: true, new: true }
    );

    await AuditLogModel.create({
      adminId: adminUser.userId || adminUser.id,
      adminEmail: adminUser.email,
      adminName: adminUser.displayName || 'Administrator',
      action: 'UPDATE_SERVICE_CATALOG',
      details: { serviceId, name: item.name, priceInr: item.priceInr },
    });
    return item;
  }

  /**
   * Services Catalog - Delete service
   */
  public static async deleteServiceCatalogItem(id: string, adminUser: any): Promise<boolean> {
    const item = await ServiceCatalogModel.findOneAndDelete({
      $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { serviceId: id }],
    });
    if (item) {
      await AuditLogModel.create({
        adminId: adminUser.userId || adminUser.id,
        adminEmail: adminUser.email,
        adminName: adminUser.displayName || 'Administrator',
        action: 'DELETE_SERVICE_CATALOG',
        details: { serviceId: item.serviceId, name: item.name },
      });
    }
    return true;
  }

  /**
   * Categories - Get all categories
   */
  public static async getCategories(): Promise<any> {
    return {
      ceremonyCategories: [
        { id: 'wedding', name: 'Vedic Wedding Ceremonies', count: 4, icon: '💍' },
        { id: 'home_vastu', name: 'Home & Vastu Pujas', count: 3, icon: '🏛️' },
        { id: 'kathas_havans', name: 'Auspicious Kathas & Havans', count: 5, icon: '🔥' },
        { id: 'astrology', name: 'Astrological Consultations', count: 2, icon: '✨' },
        { id: 'sanskars', name: 'Sanskars & Sacred Rites', count: 3, icon: '🪔' },
      ],
      matrimonialCategories: [
        { id: 'community', name: 'Community Alliances (Brahmin, Rajput, Agarwal, etc.)', icon: '👥' },
        { id: 'location', name: 'Regional & Metro Circles (Delhi NCR, Mumbai, Bangalore, UP, Bihar)', icon: '📍' },
        { id: 'education', name: 'Professional Circles (Tech, Civil Services, Doctors, Business)', icon: '🎓' },
      ],
    };
  }

  /**
   * Notifications & Broadcasts - Get notifications history
   */
  public static async getAdminNotifications(page = 1, limit = 20): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return { items: [], pagination: { totalCount: 0, page: 1, limit: 20, totalPages: 1 } };
    }
    const skip = (page - 1) * limit;
    const [items, totalCount] = await Promise.all([
      NotificationModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(),
    ]);

    return {
      items: items.map((n: any) => ({
        id: n._id.toString(),
        title: n.title,
        message: n.message,
        type: n.type,
        targetAudience: n.targetAudience,
        createdAt: n.createdAt?.toISOString(),
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
   * Notifications & Broadcasts - Send broadcast notification
   */
  public static async sendBroadcastNotification(
    data: { title: string; message: string; targetAudience?: string },
    adminUser: any
  ): Promise<any> {
    if (!data.title?.trim() || !data.message?.trim()) {
      throw new AppError('Title and message are required for broadcast notification.', 400, 'VALIDATION_ERROR');
    }

    const notif = await NotificationModel.create({
      title: data.title.trim(),
      message: data.message.trim(),
      type: 'broadcast',
      targetAudience: data.targetAudience || 'all',
      isRead: false,
      readBy: [],
    });

    await AuditLogModel.create({
      adminId: adminUser.userId || adminUser.id,
      adminEmail: adminUser.email,
      adminName: adminUser.displayName || 'Administrator',
      action: 'SEND_BROADCAST_NOTIFICATION',
      details: { title: notif.title, targetAudience: notif.targetAudience },
    });

    return notif;
  }

  /**
   * System Settings - Get system and contact configuration
   */
  public static async getSystemSettings(): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    let settingsDoc: any = null;

    if (isDbConnected) {
      try {
        settingsDoc = await SystemSettingsModel.findOne({ key: 'global_settings' }).lean();
        if (!settingsDoc) {
          settingsDoc = await SystemSettingsModel.create({
            key: 'global_settings',
            appName: 'ShaadiBanao',
            femaleFreeChatEnabled: true,
            malePaidChatRequired: true,
            maleFreeReplyToFemale: true,
            maleFreeMessageLimit: 1,
            panditFreeChatEnabled: true,
            panditFreeMessageLimit: 1,
            panditPaidChatRequired: true,
            femaleFreePanditChat: false,
            panditWhatsappEnabled: true,
            panditWhatsappRule: 'paid_booking_or_subscription',
            plusPlanPriceInr: 2999,
            premiumPlanPriceInr: 4999,
            defaultPanditConsultationFee: 501,
            defaultAstrologyFee: 501,
            maxMessageLength: 1000,
            mediaAttachmentsEnabled: true,
            bannedKeywords: ['abuse', 'fraud', 'scam', 'money transfer'],
            supportPhone: '8076168502',
            contactPhone: '8076168502',
            supportEmail: 'shaadibanao.urbanpower@gmail.com',
            contactEmail: 'shaadibanao.urbanpower@gmail.com',
            whatsappPhone: '8076168502',
            contactWhatsApp: '8076168502',
            whatsappUrl: 'https://wa.me/918076168502',
            bookingAutoAssign: false,
            defaultLanguage: 'hi',
          });
        }
      } catch {
        // Fallback
      }
    }

    return {
      appName: settingsDoc?.appName || 'ShaadiBanao',
      femaleFreeChatEnabled: settingsDoc?.femaleFreeChatEnabled !== false,
      malePaidChatRequired: settingsDoc?.malePaidChatRequired !== false,
      maleFreeReplyToFemale: settingsDoc?.maleFreeReplyToFemale !== false,
      maleFreeMessageLimit:
        typeof settingsDoc?.maleFreeMessageLimit === 'number' ? settingsDoc.maleFreeMessageLimit : 1,
      panditFreeChatEnabled: settingsDoc?.panditFreeChatEnabled !== false,
      panditFreeMessageLimit:
        typeof settingsDoc?.panditFreeMessageLimit === 'number' ? settingsDoc.panditFreeMessageLimit : 1,
      panditPaidChatRequired: settingsDoc?.panditPaidChatRequired !== false,
      femaleFreePanditChat: settingsDoc?.femaleFreePanditChat === true,
      panditWhatsappEnabled: settingsDoc?.panditWhatsappEnabled !== false,
      panditWhatsappRule: settingsDoc?.panditWhatsappRule || 'paid_booking_or_subscription',
      audioConsultationPriceInr: settingsDoc?.audioConsultationPriceInr || 301,
      videoConsultationPriceInr: settingsDoc?.videoConsultationPriceInr || 501,
      chatConsultationPriceInr: settingsDoc?.chatConsultationPriceInr || 201,
      plusPlanPriceInr: settingsDoc?.plusPlanPriceInr || 2999,
      premiumPlanPriceInr: settingsDoc?.premiumPlanPriceInr || 4999,
      defaultPanditConsultationFee: settingsDoc?.defaultPanditConsultationFee || 501,
      defaultAstrologyFee: settingsDoc?.defaultAstrologyFee || 501,
      maxMessageLength: settingsDoc?.maxMessageLength || 1000,
      mediaAttachmentsEnabled: settingsDoc?.mediaAttachmentsEnabled !== false,
      bannedKeywords: settingsDoc?.bannedKeywords || ['abuse', 'fraud', 'scam', 'money transfer'],
      supportPhone: settingsDoc?.supportPhone || '8076168502',
      contactPhone: settingsDoc?.contactPhone || '8076168502',
      supportEmail: settingsDoc?.supportEmail || 'shaadibanao.urbanpower@gmail.com',
      contactEmail: settingsDoc?.contactEmail || 'shaadibanao.urbanpower@gmail.com',
      whatsappPhone: settingsDoc?.whatsappPhone || '8076168502',
      contactWhatsApp: settingsDoc?.contactWhatsApp || '8076168502',
      whatsappUrl: settingsDoc?.whatsappUrl || 'https://wa.me/918076168502',
      serverMode: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 5000,
      databaseStatus: isDbConnected ? 'connected' : 'disconnected',
      cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      firebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID),
      bookingAutoAssign: settingsDoc?.bookingAutoAssign || false,
      defaultLanguage: settingsDoc?.defaultLanguage || 'hi',
    };
  }

  /**
   * System Settings - Update system settings (Admin)
   */
  public static async updateSystemSettings(data: any, adminUser?: any): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return { success: true, message: 'Settings saved (in-memory mode).' };
    }

    let settings = await SystemSettingsModel.findOne({ key: 'global_settings' });
    if (!settings) {
      settings = new SystemSettingsModel({ key: 'global_settings' });
    }

    if (data.femaleFreeChatEnabled !== undefined) settings.femaleFreeChatEnabled = Boolean(data.femaleFreeChatEnabled);
    if (data.malePaidChatRequired !== undefined) settings.malePaidChatRequired = Boolean(data.malePaidChatRequired);
    if (data.maleFreeReplyToFemale !== undefined) settings.maleFreeReplyToFemale = Boolean(data.maleFreeReplyToFemale);
    if (data.maleFreeMessageLimit !== undefined) settings.maleFreeMessageLimit = Number(data.maleFreeMessageLimit);
    if (data.panditFreeChatEnabled !== undefined) settings.panditFreeChatEnabled = Boolean(data.panditFreeChatEnabled);
    if (data.panditFreeMessageLimit !== undefined) {
      settings.panditFreeMessageLimit = Math.max(0, Number(data.panditFreeMessageLimit));
    }
    if (data.panditPaidChatRequired !== undefined) settings.panditPaidChatRequired = Boolean(data.panditPaidChatRequired);
    if (data.femaleFreePanditChat !== undefined) settings.femaleFreePanditChat = Boolean(data.femaleFreePanditChat);
    if (data.panditWhatsappEnabled !== undefined) settings.panditWhatsappEnabled = Boolean(data.panditWhatsappEnabled);
    if (
      data.panditWhatsappRule &&
      ['paid_booking_or_subscription', 'paid_booking_only', 'paid_subscription_only', 'always_off'].includes(
        data.panditWhatsappRule
      )
    ) {
      settings.panditWhatsappRule = data.panditWhatsappRule;
    }
    if (data.plusPlanPriceInr !== undefined) settings.plusPlanPriceInr = Number(data.plusPlanPriceInr);
    if (data.premiumPlanPriceInr !== undefined) settings.premiumPlanPriceInr = Number(data.premiumPlanPriceInr);
    if (data.defaultPanditConsultationFee !== undefined) settings.defaultPanditConsultationFee = Number(data.defaultPanditConsultationFee);
    if (data.defaultAstrologyFee !== undefined) settings.defaultAstrologyFee = Number(data.defaultAstrologyFee);
    if (data.audioConsultationPriceInr !== undefined) settings.audioConsultationPriceInr = Number(data.audioConsultationPriceInr);
    if (data.videoConsultationPriceInr !== undefined) settings.videoConsultationPriceInr = Number(data.videoConsultationPriceInr);
    if (data.chatConsultationPriceInr !== undefined) settings.chatConsultationPriceInr = Number(data.chatConsultationPriceInr);
    if (data.consultationDurationMinutes !== undefined) settings.consultationDurationMinutes = Number(data.consultationDurationMinutes);
    if (data.freeTrialCallMinutes !== undefined) settings.freeTrialCallMinutes = Number(data.freeTrialCallMinutes);
    if (data.callCommissionRate !== undefined) settings.callCommissionRate = Number(data.callCommissionRate);
    if (data.maxMessageLength !== undefined) settings.maxMessageLength = Number(data.maxMessageLength);
    if (data.mediaAttachmentsEnabled !== undefined) settings.mediaAttachmentsEnabled = Boolean(data.mediaAttachmentsEnabled);
    if (data.bannedKeywords && Array.isArray(data.bannedKeywords)) settings.bannedKeywords = data.bannedKeywords;
    if (data.supportPhone) {
      settings.supportPhone = data.supportPhone.trim();
      settings.contactPhone = data.supportPhone.trim();
    }
    if (data.supportEmail) {
      settings.supportEmail = data.supportEmail.trim();
      settings.contactEmail = data.supportEmail.trim();
    }
    if (data.whatsappPhone) {
      settings.whatsappPhone = data.whatsappPhone.trim();
      settings.contactWhatsApp = data.whatsappPhone.trim();
      settings.whatsappUrl = `https://wa.me/91${data.whatsappPhone.trim().replace(/\D/g, '')}`;
    }
    if (data.bookingAutoAssign !== undefined) settings.bookingAutoAssign = Boolean(data.bookingAutoAssign);
    if (data.defaultLanguage) settings.defaultLanguage = data.defaultLanguage;
    if (adminUser?.userId || adminUser?.id) settings.updatedBy = adminUser.userId || adminUser.id;

    await settings.save();

    await AuditLogModel.create({
      adminId: adminUser?.userId || adminUser?.id || 'admin',
      adminEmail: adminUser?.email,
      action: 'UPDATE_SYSTEM_SETTINGS',
      details: data,
    });

    return this.getSystemSettings();
  }

  /**
   * Withdrawals: List pandit withdrawal requests
   */
  public static async listWithdrawals(query: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    const [items, totalCount] = await Promise.all([
      WithdrawalModel.find(filter)
        .populate('panditId', 'name panditId phone totalEarnings pendingPayout')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WithdrawalModel.countDocuments(filter),
    ]);

    return {
      items: items.map((w: any) => ({
        id: w._id.toString(),
        withdrawalId: w.withdrawalId,
        panditId: w.panditId?._id ? w.panditId._id.toString() : (w.panditId ? w.panditId.toString() : ''),
        panditCode: w.panditId?.panditId || '',
        panditName: w.panditName || w.panditId?.name || 'Pandit Ji',
        panditPhone: w.panditPhone || w.panditId?.phone || '',
        amount: w.amount,
        status: w.status,
        bankDetails: w.bankDetails || {},
        referenceNumber: w.referenceNumber,
        rejectionReason: w.rejectionReason,
        processedBy: w.processedBy,
        processedAt: w.processedAt?.toISOString ? w.processedAt.toISOString() : w.processedAt,
        createdAt: w.createdAt?.toISOString ? w.createdAt.toISOString() : w.createdAt,
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
   * Withdrawals: Approve payout and deduct from Pandit's pendingPayout
   */
  public static async approveWithdrawal(
    id: string,
    adminUser: any,
    referenceNumber?: string
  ): Promise<any> {
    const withdrawal = await WithdrawalModel.findById(id);
    if (!withdrawal) throw new AppError('Withdrawal request not found.', 404, 'NOT_FOUND');

    if (withdrawal.status !== 'pending') {
      throw new AppError(`Cannot approve withdrawal with status "${withdrawal.status}".`, 400, 'INVALID_STATUS');
    }

    const pandit = await PanditModel.findById(withdrawal.panditId);
    if (!pandit) throw new AppError('Associated Pandit account not found.', 404, 'NOT_FOUND');

    // Deduct from Pandit's pendingPayout
    pandit.pendingPayout = Math.max(0, (pandit.pendingPayout || 0) - withdrawal.amount);
    await pandit.save();

    withdrawal.status = 'paid';
    withdrawal.processedBy = adminUser?.userId || adminUser?.id || 'admin';
    withdrawal.processedAt = new Date();
    withdrawal.referenceNumber = referenceNumber || `PAY-${Date.now()}`;
    await withdrawal.save();

    // Audit log
    await AuditLogModel.create({
      adminId: adminUser?.userId || adminUser?.id || 'admin',
      adminEmail: adminUser?.email,
      action: 'APPROVE_PANDIT_WITHDRAWAL',
      targetUserId: withdrawal.userId?.toString(),
      details: {
        withdrawalId: withdrawal.withdrawalId,
        amount: withdrawal.amount,
        panditId: withdrawal.panditId.toString(),
        referenceNumber: withdrawal.referenceNumber,
      },
    });

    // Notify Pandit
    try {
      if (withdrawal.userId) {
        await NotificationModel.create({
          userId: withdrawal.userId,
          title: 'भुगतान पूर्ण (Payout Processed)',
          body: `आपके ₹${withdrawal.amount} की निकासी का भुगतान सफल रहा (संदर्भ: ${withdrawal.referenceNumber})।`,
          type: 'payout_processed',
          data: {
            withdrawalId: withdrawal.withdrawalId,
            amount: withdrawal.amount,
            referenceNumber: withdrawal.referenceNumber,
          },
        });
      }
    } catch {}

    return withdrawal;
  }

  /**
   * Withdrawals: Reject payout with reason
   */
  public static async rejectWithdrawal(
    id: string,
    adminUser: any,
    reason?: string
  ): Promise<any> {
    const withdrawal = await WithdrawalModel.findById(id);
    if (!withdrawal) throw new AppError('Withdrawal request not found.', 404, 'NOT_FOUND');

    if (withdrawal.status !== 'pending') {
      throw new AppError(`Cannot reject withdrawal with status "${withdrawal.status}".`, 400, 'INVALID_STATUS');
    }

    withdrawal.status = 'rejected';
    withdrawal.processedBy = adminUser?.userId || adminUser?.id || 'admin';
    withdrawal.processedAt = new Date();
    withdrawal.rejectionReason = reason || 'Payout details could not be verified by admin.';
    await withdrawal.save();

    // Audit log
    await AuditLogModel.create({
      adminId: adminUser?.userId || adminUser?.id || 'admin',
      adminEmail: adminUser?.email,
      action: 'REJECT_PANDIT_WITHDRAWAL',
      targetUserId: withdrawal.userId?.toString(),
      details: {
        withdrawalId: withdrawal.withdrawalId,
        amount: withdrawal.amount,
        reason,
      },
    });

    return withdrawal;
  }

  /**
   * Error Monitoring: List structured error logs
   */
  public static async listErrorLogs(query: {
    page?: number;
    limit?: number;
    module?: string;
    severity?: string;
    resolved?: string;
  }): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.module && query.module !== 'all') {
      filter.module = query.module;
    }
    if (query.severity && query.severity !== 'all') {
      filter.severity = query.severity;
    }
    if (query.resolved !== undefined && query.resolved !== 'all') {
      filter.resolved = query.resolved === 'true';
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return { items: [], pagination: { totalCount: 0, page: 1, limit: 20, totalPages: 1 } };
    }

    const [items, totalCount] = await Promise.all([
      ErrorLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ErrorLogModel.countDocuments(filter),
    ]);

    return {
      items: items.map((e: any) => ({
        id: e._id.toString(),
        errorId: e.errorId,
        module: e.module,
        errorMessage: e.errorMessage,
        stackTrace: e.stackTrace,
        apiEndpoint: e.apiEndpoint,
        httpMethod: e.httpMethod,
        statusCode: e.statusCode,
        severity: e.severity,
        resolved: e.resolved,
        resolutionStatus: e.resolutionStatus,
        resolvedAt: e.resolvedAt?.toISOString ? e.resolvedAt.toISOString() : e.resolvedAt,
        resolvedBy: e.resolvedBy,
        resolutionNotes: e.resolutionNotes,
        createdAt: e.createdAt?.toISOString ? e.createdAt.toISOString() : e.createdAt,
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
   * Error Monitoring: Mark an error as resolved
   */
  public static async resolveErrorLog(
    id: string,
    adminUser: any,
    resolutionNotes?: string
  ): Promise<any> {
    const err = await ErrorLogModel.findById(id);
    if (!err) throw new AppError('Error log entry not found.', 404, 'NOT_FOUND');

    err.resolved = true;
    err.resolutionStatus = 'resolved';
    err.resolvedAt = new Date();
    err.resolvedBy = adminUser?.email || adminUser?.userId || 'admin';
    if (resolutionNotes) {
      err.resolutionNotes = resolutionNotes.trim();
    }
    await err.save();

    return err;
  }

  /**
   * Database Monitoring: Health, ping latency, and collection statistics
   */
  public static async getDatabaseMonitoringStats(): Promise<any> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const startPing = Date.now();
    let pingLatencyMs = 0;

    const collectionsInfo: Array<{ name: string; count: number }> = [];

    if (isDbConnected && mongoose.connection.db) {
      try {
        await mongoose.connection.db.admin().ping();
        pingLatencyMs = Date.now() - startPing;

        const list = await mongoose.connection.db.listCollections().toArray();
        for (const col of list) {
          const count = await mongoose.connection.db.collection(col.name).countDocuments();
          collectionsInfo.push({ name: col.name, count });
        }
      } catch (err: any) {
        pingLatencyMs = Date.now() - startPing;
      }
    }

    const stateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      status: stateMap[mongoose.connection.readyState] || 'disconnected',
      host: mongoose.connection.host || 'cluster0.kx9qipw.mongodb.net',
      databaseName: mongoose.connection.name || 'bandhansetu',
      isProduction: process.env.NODE_ENV === 'production',
      pingLatencyMs,
      collectionsCount: collectionsInfo.length,
      collections: collectionsInfo.sort((a, b) => b.count - a.count),
      serverTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper hooks for unit test setups
   */
  public static registerInMemoryAdminForTesting(user: any): void {
    const id = user._id?.toString() || user.id;
    if (id) inMemoryAdminStore.set(id, user);
    if (user.email) inMemoryAdminStore.set(user.email, user);
    if (user.mobile) inMemoryAdminStore.set(user.mobile, user);
  }

  public static clearInMemoryAdminForTesting(): void {
    inMemoryAdminStore.clear();
    inMemoryAuditStore.length = 0;
  }
}
