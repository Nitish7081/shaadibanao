import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import { AppError } from './errorHandler';

// Fallback in-memory map for unit tests when MongoDB is disconnected
const inMemoryApprovalMockStore = new Map<string, any>();

export const registerMockUserApprovalForTesting = (userId: string, data: any) => {
  inMemoryApprovalMockStore.set(userId, data);
};

export const clearMockUserApprovalForTesting = () => {
  inMemoryApprovalMockStore.clear();
};

export const requireApproved = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user;

    if (!userPayload?.userId) {
      throw new AppError(
        'Authentication required before checking approval permissions.',
        401,
        'UNAUTHORIZED'
      );
    }

    // Administrators bypass member approval checks
    if (userPayload.role === 'admin') {
      return next();
    }

    let user: any = null;

    if (mongoose.connection.readyState === 1) {
      user = await UserModel.findById(userPayload.userId);
    } else {
      user = inMemoryApprovalMockStore.get(userPayload.userId) || {
        _id: userPayload.userId,
        role: userPayload.role,
        status: 'active',
        approvalStatus: 'approved',
      };
    }

    if (!user) {
      throw new AppError('User account not found.', 401, 'USER_NOT_FOUND');
    }

    // 1. Check account suspension
    if (user.status === 'suspended') {
      throw new AppError(
        'Your account has been suspended by administration. Access to protected matrimonial features is restricted.',
        403,
        'ACCOUNT_SUSPENDED'
      );
    }

    if (user.status === 'deleted') {
      throw new AppError('This account has been deactivated.', 403, 'ACCOUNT_DELETED');
    }

    // 2. Check approval statuses
    if (user.approvalStatus === 'rejected') {
      const reasonText = user.rejectionReason || 'Profile did not meet community guidelines.';
      throw new AppError(
        `Your profile was rejected by administration. Reason: ${reasonText}`,
        403,
        'APPROVAL_REJECTED',
        {
          approvalStatus: 'rejected',
          rejectionReason: reasonText,
          moderationRemarks: user.moderationRemarks || '',
        }
      );
    }

    if (user.approvalStatus === 'changes_requested') {
      throw new AppError(
        'Administration has requested changes to your profile before approval.',
        403,
        'APPROVAL_CHANGES_REQUESTED',
        {
          approvalStatus: 'changes_requested',
          moderationRemarks: user.moderationRemarks || 'Please update your submitted details.',
        }
      );
    }

    if (user.approvalStatus !== 'approved') {
      throw new AppError(
        'Your profile is currently under review by our administration team. Search, matching, and conversations will be unlocked once approved.',
        403,
        'APPROVAL_PENDING',
        {
          approvalStatus: user.approvalStatus || 'pending',
          userId: user._id?.toString() || userPayload.userId,
        }
      );
    }

    // User is fully approved and active
    next();
  } catch (error) {
    next(error);
  }
};
