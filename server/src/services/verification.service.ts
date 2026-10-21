import mongoose from 'mongoose';
import { VerificationRequestModel } from '../models/verification-request.model';
import { UserModel } from '../models/user.model';
import { ProfileModel } from '../models/profile.model';
import { AuditLogModel } from '../models/audit-log.model';

export interface SubmitIdentityInput {
  userId: string;
  documentType: 'aadhaar_card' | 'passport' | 'voter_id';
  documentReferenceNumber: string; // e.g. "1234 5678 9012"
  documentStorageKey: string;
  consentGranted: boolean;
  termsVersion?: string;
}

export class VerificationService {
  /**
   * Mask sensitive identification number (e.g. 1234 5678 9012 -> XXXX-XXXX-9012)
   */
  static maskIdentityNumber(rawNumber: string): string {
    const cleaned = rawNumber.replace(/[\s-]/g, '');
    if (cleaned.length <= 4) return 'XXXX-' + cleaned;
    const lastFour = cleaned.slice(-4);
    return 'XXXX-XXXX-' + lastFour;
  }

  /**
   * Submit an identity verification request with explicit user consent
   */
  static async submitIdentityVerification(input: SubmitIdentityInput) {
    if (!input.consentGranted) {
      throw new Error('Explicit consent is required for identity verification document submission.');
    }

    const user = await UserModel.findById(input.userId);
    if (!user) throw new Error('User not found.');

    const maskedRef = this.maskIdentityNumber(input.documentReferenceNumber);

    // Create verification request
    const request = await VerificationRequestModel.create({
      userId: user._id,
      userDisplayName: user.displayName || 'Member',
      userMobile: user.mobile,
      userEmail: user.email,
      documentType: input.documentType,
      documentReferenceMasked: maskedRef,
      documentStorageKey: input.documentStorageKey,
      consentGranted: true,
      consentTimestamp: new Date(),
      status: 'pending',
    });

    // Update user model verification status
    user.identityVerificationStatus = 'pending';
    user.identityDocumentType = input.documentType;
    user.identityDocumentReferenceMasked = maskedRef;
    user.identityConsent = {
      hasConsent: true,
      agreedAt: new Date(),
      termsVersion: input.termsVersion || 'v1.0',
    };
    await user.save();

    return {
      requestId: request._id.toString(),
      status: 'pending',
      documentReferenceMasked: maskedRef,
      message: 'Identity verification request submitted for review.',
    };
  }

  /**
   * Get user verification status
   */
  static async getUserVerificationStatus(userId: string) {
    const user = await UserModel.findById(userId).select(
      'phoneVerified identityVerificationStatus photoApprovalStatus approvalStatus identityDocumentReferenceMasked'
    );
    if (!user) throw new Error('User not found.');

    return {
      phoneVerified: !!user.phoneVerified,
      identityVerificationStatus: user.identityVerificationStatus || 'none',
      photoApprovalStatus: user.photoApprovalStatus || 'none',
      approvalStatus: user.approvalStatus,
      identityDocumentReferenceMasked: user.identityDocumentReferenceMasked,
    };
  }

  /**
   * Admin: List pending identity verification requests
   */
  static async listIdentityRequests(page = 1, limit = 20, status = 'pending') {
    const skip = (page - 1) * limit;
    const query = status === 'all' ? {} : { status };

    const [items, totalCount] = await Promise.all([
      VerificationRequestModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VerificationRequestModel.countDocuments(query),
    ]);

    return {
      items: items.map((r: any) => ({
        id: r._id.toString(),
        userId: r.userId.toString(),
        userDisplayName: r.userDisplayName,
        userMobile: r.userMobile,
        userEmail: r.userEmail,
        documentType: r.documentType,
        documentReferenceMasked: r.documentReferenceMasked,
        status: r.status,
        consentGranted: r.consentGranted,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt.toISOString(),
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
   * Admin: Approve identity verification
   */
  static async approveIdentity(requestId: string, adminId: string, ipAddress?: string) {
    const request = await VerificationRequestModel.findById(requestId);
    if (!request) throw new Error('Verification request not found.');

    request.status = 'verified';
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      request.verifiedBy = new mongoose.Types.ObjectId(adminId);
    }
    request.verifiedAt = new Date();
    await request.save();

    // Update user & profile
    await UserModel.findByIdAndUpdate(request.userId, {
      identityVerificationStatus: 'verified',
    });

    await ProfileModel.findOneAndUpdate(
      { userId: request.userId },
      { isVerified: true }
    );

    // Audit log
    await AuditLogModel.create({
      adminId,
      action: 'APPROVE_IDENTITY',
      targetUserId: request.userId.toString(),
      targetUserEmail: request.userEmail,
      targetUserMobile: request.userMobile,
      details: { documentType: request.documentType, requestId },
      ipAddress,
    });

    return { success: true, message: 'Identity verification approved.' };
  }

  /**
   * Admin: Reject identity verification
   */
  static async rejectIdentity(requestId: string, adminId: string, reason: string, ipAddress?: string) {
    if (!reason || !reason.trim()) {
      throw new Error('A reason is mandatory when rejecting identity verification.');
    }

    const request = await VerificationRequestModel.findById(requestId);
    if (!request) throw new Error('Verification request not found.');

    request.status = 'rejected';
    request.rejectionReason = reason.trim();
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      request.verifiedBy = new mongoose.Types.ObjectId(adminId);
    }
    request.verifiedAt = new Date();
    await request.save();

    await UserModel.findByIdAndUpdate(request.userId, {
      identityVerificationStatus: 'rejected',
    });

    await AuditLogModel.create({
      adminId,
      action: 'REJECT_IDENTITY',
      targetUserId: request.userId.toString(),
      targetUserEmail: request.userEmail,
      targetUserMobile: request.userMobile,
      details: { reason, requestId },
      ipAddress,
    });

    return { success: true, message: 'Identity verification rejected.' };
  }

  /**
   * Admin: Moderate user profile photo
   */
  static async moderateProfilePhoto(
    userId: string,
    action: 'approve' | 'reject',
    adminId: string,
    remarks?: string,
    ipAddress?: string
  ) {
    const isDbConnected = mongoose.connection.readyState === 1;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    if (!isDbConnected) {
      return { success: true, photoApprovalStatus: newStatus, status: newStatus };
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found.');

    user.photoApprovalStatus = newStatus;
    await user.save();

    const profile = await ProfileModel.findOne({ userId });
    if (profile) {
      profile.photoChecked = action === 'approve';
      if (profile.photos && profile.photos.length > 0) {
        profile.photos.forEach((p: any) => {
          p.approved = action === 'approve';
        });
      }
      await profile.save();
    }

    await AuditLogModel.create({
      adminId,
      action: action === 'approve' ? 'APPROVE_PHOTO' : 'REJECT_PHOTO',
      targetUserId: userId,
      targetUserEmail: user.email,
      targetUserMobile: user.mobile,
      details: { action, remarks },
      ipAddress,
    });

    return { success: true, photoApprovalStatus: newStatus, status: newStatus };
  }

  /**
   * Admin: List users with profile photos pending moderation
   */
  static async listPendingPhotos(page = 1, limit = 20) {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return {
        items: [],
        pagination: {
          page,
          limit,
          totalCount: 0,
          totalPages: 0,
        },
      };
    }

    const skip = (page - 1) * limit;
    const query = { photoApprovalStatus: 'pending' };

    const [users, totalCount] = await Promise.all([
      UserModel.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(query),
    ]);

    const userIds = users.map((u) => u._id);
    const profiles = await ProfileModel.find({ userId: { $in: userIds } }).lean();
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const items = users.map((u: any) => {
      const prof = profileMap.get(u._id.toString());
      return {
        id: u._id.toString(),
        userId: u._id.toString(),
        displayName: prof ? `${prof.firstName} ${prof.lastName}` : u.displayName || 'Member',
        mobile: u.mobile,
        email: u.email,
        photos: (prof?.photos || []).map((p: any) => ({
          id: p._id?.toString() || p.id,
          url: p.url,
          isMain: p.isMain,
          approved: p.approved,
        })),
        photoApprovalStatus: u.photoApprovalStatus || 'pending',
        updatedAt: u.updatedAt ? u.updatedAt.toISOString() : new Date().toISOString(),
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }
}
