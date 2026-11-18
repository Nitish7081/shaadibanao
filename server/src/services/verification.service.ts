import mongoose from 'mongoose';
import { VerificationRequestModel } from '../models/verification-request.model';
import { UserModel } from '../models/user.model';
import { ProfileModel } from '../models/profile.model';
import { AuditLogModel } from '../models/audit-log.model';
import { StorageService } from './storage.service';
import { presentPhoto } from './photoPrivacy';
import { AppError } from '../middleware/errorHandler';
import { SocketService } from '../socket/socket.service';
import { IDENTITY_DOCUMENT_TYPES, IdentityDocumentType } from '@bandhansetu/shared';

export interface SubmitIdentityInput {
  userId: string;
  documentType: IdentityDocumentType;
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

    if (!IDENTITY_DOCUMENT_TYPES.includes(input.documentType)) {
      throw new AppError(
        `Invalid document type '${input.documentType}'. Allowed: Aadhaar Card, PAN Card, Voter ID, Passport, Bank Passbook.`,
        400,
        'INVALID_DOCUMENT_TYPE'
      );
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
    user.rejectionReason = undefined;
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

    // Update user & profile: verifying identity also approves pending/changes_requested accounts
    // so the verified user can immediately log into ShaadiBanao without waiting for a second manual step.
    const targetUser = await UserModel.findById(request.userId);
    if (targetUser) {
      targetUser.identityVerificationStatus = 'verified';
      targetUser.identityDocumentType = request.documentType;
      targetUser.identityDocumentReferenceMasked = request.documentReferenceMasked;
      if (targetUser.status !== 'suspended' && targetUser.approvalStatus !== 'approved') {
        targetUser.approvalStatus = 'approved';
        targetUser.approvedBy = adminId;
        targetUser.approvedAt = new Date();
        targetUser.rejectionReason = undefined;
        targetUser.moderationRemarks = undefined;
      }
      await targetUser.save();

      SocketService.emitToUser(targetUser._id.toString(), 'user:approval_status_changed', {
        approvalStatus: targetUser.approvalStatus,
        identityVerificationStatus: 'verified',
        approvedAt: targetUser.approvedAt,
      });
    } else {
      await UserModel.findByIdAndUpdate(request.userId, {
        identityVerificationStatus: 'verified',
      });
    }

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
      details: { documentType: request.documentType, requestId, accountApproved: targetUser?.approvalStatus === 'approved' },
      ipAddress,
    });

    return { success: true, message: 'Identity verification approved and user account unlocked for ShaadiBanao.' };
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

    const targetUser = await UserModel.findById(request.userId);
    if (targetUser) {
      targetUser.identityVerificationStatus = 'rejected';
      targetUser.rejectionReason = reason.trim();
      await targetUser.save();

      SocketService.emitToUser(targetUser._id.toString(), 'user:approval_status_changed', {
        approvalStatus: targetUser.approvalStatus,
        identityVerificationStatus: 'rejected',
        rejectionReason: reason.trim(),
      });
    } else {
      await UserModel.findByIdAndUpdate(request.userId, {
        identityVerificationStatus: 'rejected',
        rejectionReason: reason.trim(),
      });
    }

    await ProfileModel.findOneAndUpdate(
      { userId: request.userId },
      { isVerified: false }
    );

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
   * Admin: short-lived (10 min) signed URL to view the submitted identity document.
   * The raw Cloudinary URL is never stored or returned; the access is audit-logged
   * (request id only, never the URL, key or document number).
   */
  static async getDocumentSignedUrl(requestId: string, adminId: string, ipAddress?: string) {
    const request: any = await VerificationRequestModel.findById(requestId).select('+documentStorageKey');
    if (!request) throw new AppError('Verification request not found.', 404, 'NOT_FOUND');

    const key: string = request.documentStorageKey;
    if (!StorageService.isPrivatePublicId(key)) {
      throw new AppError(
        'This request has no document in the private vault (legacy or missing upload).',
        404,
        'DOCUMENT_NOT_AVAILABLE'
      );
    }

    let signed;
    try {
      signed = await StorageService.getSignedPrivateUrl(key, 600);
    } catch {
      throw new AppError('The document could not be retrieved from secure storage.', 502, 'DOCUMENT_FETCH_FAILED');
    }

    await AuditLogModel.create({
      adminId,
      action: 'VIEW_IDENTITY_DOCUMENT',
      targetUserId: request.userId.toString(),
      details: { requestId },
      ipAddress,
    });

    return {
      url: signed.url,
      format: signed.format || 'jpg',
      documentType: request.documentType,
      documentReferenceMasked: request.documentReferenceMasked,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  /**
   * Admin: Moderate user profile photo (single photo via optional photoId, or all photos)
   */
  static async moderateProfilePhoto(
    userId: string,
    action: 'approve' | 'reject',
    adminId: string,
    remarks?: string,
    ipAddress?: string,
    photoId?: string
  ) {
    const isDbConnected = mongoose.connection.readyState === 1;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    if (!isDbConnected) {
      return { success: true, photoApprovalStatus: newStatus, status: newStatus };
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found.');

    const profile = await ProfileModel.findOne({ userId });
    let finalPhotoStatus: 'approved' | 'rejected' | 'pending' | 'none' = newStatus;

    if (profile && profile.photos && profile.photos.length > 0) {
      if (photoId) {
        const target = profile.photos.find(
          (p: any) =>
            p._id?.toString() === photoId ||
            p.id === photoId ||
            (p.publicId && p.publicId === photoId)
        );
        if (!target) {
          throw new AppError('Photo not found on user profile.', 404, 'PHOTO_NOT_FOUND');
        }
        target.approved = action === 'approve';
        const anyApproved = profile.photos.some((p: any) => p.approved !== false);
        profile.photoChecked = anyApproved;
        finalPhotoStatus = anyApproved ? 'approved' : 'rejected';
      } else {
        profile.photoChecked = action === 'approve';
        profile.photos.forEach((p: any) => {
          p.approved = action === 'approve';
        });
        finalPhotoStatus = newStatus;
      }
      await profile.save();
    } else if (profile) {
      profile.photoChecked = action === 'approve';
      await profile.save();
    }

    user.photoApprovalStatus = finalPhotoStatus;
    await user.save();

    await AuditLogModel.create({
      adminId,
      action: action === 'approve' ? 'APPROVE_PHOTO' : 'REJECT_PHOTO',
      targetUserId: userId,
      targetUserEmail: user.email,
      targetUserMobile: user.mobile,
      details: { action, remarks, ...(photoId ? { photoId } : { scope: 'all' }) },
      ipAddress,
    });

    return { success: true, photoApprovalStatus: finalPhotoStatus, status: finalPhotoStatus };
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
    const profileMap = new Map(
      profiles
        .filter((p: any) => p && p.userId)
        .map((p: any) => [p.userId.toString(), p])
    );

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
          ...presentPhoto(p.url, p.publicId),
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
