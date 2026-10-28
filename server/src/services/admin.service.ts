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
import { StorageService } from './storage.service';
import { sanitizeBannerLink } from './banner.service';
import { presentPhoto, presentPhotoUrl } from './photoPrivacy';
import { TokenService } from './token.service';
import { SocketService } from '../socket/socket.service';
import { AppError } from '../middleware/errorHandler';
import { AuthTokens, UserSummary, PendingApprovalItem, ApprovalStatus } from '@bandhansetu/shared';

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
        recentUsers: allUsers.slice(-5),
        recentApprovals: pendingUsers.slice(-5),
        recentReports: [],
        recentAudits: inMemoryAuditStore.slice(-5),
      };
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
      pendingCommunityPosts,
      pendingIdentityRequests,
      recentUsers,
      recentApprovals,
      recentReports,
      recentAudits,
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

    return {
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
    };
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

    // Attach profile and membership information
    const userIds = users.map((u) => u._id);
    const [profiles, memberships] = await Promise.all([
      ProfileModel.find({ userId: { $in: userIds } }).select('userId firstName lastName isVerified gender city state'),
      MembershipModel.find({ userId: { $in: userIds }, status: 'active' }).select('userId planId expiresAt'),
    ]);

    const profileMap = new Map(
      profiles
        .filter((p) => p && p.userId)
        .map((p) => [p.userId.toString(), p])
    );
    const membershipMap = new Map(
      memberships
        .filter((m) => m && m.userId)
        .map((m) => [m.userId.toString(), m])
    );

    const enrichedUsers = users.map((u) => {
      const idStr = u._id.toString();
      return {
        ...u.toObject(),
        profile: profileMap.get(idStr) || null,
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
    const [profiles, preferences, kundlis] = await Promise.all([
      ProfileModel.find({ userId: { $in: userIds } }).lean(),
      PartnerPreferenceModel.find({ userId: { $in: userIds } }).lean(),
      KundliModel.find({ userId: { $in: userIds } }).lean(),
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

    const items: PendingApprovalItem[] = users.map((u) => {
      const p: any = profileMap.get(u._id.toString());
      const pref: any = prefMap.get(u._id.toString());
      const kun: any = kundliMap.get(u._id.toString());

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
        identityDocumentType: u.identityDocumentType,
        identityDocumentReferenceMasked: u.identityDocumentReferenceMasked,
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

    // Verify associated matrimonial profile if exists
    try {
      await ProfileModel.findOneAndUpdate(
        { userId: user._id },
        { $set: { isVerified: true } }
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
      }
      return user || { id: targetUserId, approvalStatus: 'rejected', rejectionReason: reason };
    }

    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw new AppError('Target user account not found.', 404, 'NOT_FOUND');
    }

    user.approvalStatus = 'rejected';
    user.rejectionReason = reason.trim();
    user.moderationRemarks = remarks?.trim() || '';
    await user.save();

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
        .populate('userId', 'email mobile status role approvalStatus createdAt'),
      ProfileModel.countDocuments(filter),
    ]);

    return {
      profiles,
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
