import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ReportModel } from '../models/report.model';
import { UserBlockModel } from '../models/user-block.model';
import { ProfileModel } from '../models/profile.model';
import { UserModel } from '../models/user.model';
import { recordInMemoryBlock } from '../services/relationshipGuard';
import { AppError } from '../middleware/errorHandler';

export class ReportController {
  /**
   * POST /api/v1/reports
   * Normal user files a confidential report / block against another user
   */
  public static async createReport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const reporterId = (req as any).user?.userId;
      if (!reporterId) {
        throw new AppError('Authentication required to submit report.', 401, 'UNAUTHORIZED');
      }

      const { profileId, reportedUserId, reason, comments, alsoBlock = true } = req.body;

      if (!reason) {
        throw new AppError('A valid reason for reporting is required.', 400, 'VALIDATION_ERROR');
      }

      let resolvedUserId: string | null = null;
      let targetProfileId: string | undefined = profileId;

      const isDbConnected = mongoose.connection.readyState === 1;

      if (isDbConnected) {
        // Try finding by profileId
        if (profileId && mongoose.Types.ObjectId.isValid(profileId)) {
          const profile = await ProfileModel.findById(profileId);
          if (profile) {
            resolvedUserId = profile.userId.toString();
            targetProfileId = profile._id.toString();
          }
        }

        // If not found, try finding by reportedUserId
        if (!resolvedUserId && reportedUserId && mongoose.Types.ObjectId.isValid(reportedUserId)) {
          const user = await UserModel.findById(reportedUserId);
          if (user) {
            resolvedUserId = user._id.toString();
          }
        }

        // If still not found but profileId is valid user id
        if (!resolvedUserId && profileId && mongoose.Types.ObjectId.isValid(profileId)) {
          const user = await UserModel.findById(profileId);
          if (user) {
            resolvedUserId = user._id.toString();
          }
        }
      } else {
        resolvedUserId = reportedUserId || profileId || 'usr_mock_reported';
      }

      if (!resolvedUserId) {
        throw new AppError('Target user or profile not found.', 404, 'USER_NOT_FOUND');
      }

      if (resolvedUserId.toString() === reporterId.toString()) {
        throw new AppError('You cannot report or block yourself.', 400, 'SELF_REPORT_PROHIBITED');
      }

      if (isDbConnected) {
        // Check if existing pending report already filed
        const existing = await ReportModel.findOne({
          reporterId,
          reportedUserId: resolvedUserId,
          status: 'pending',
        });

        if (existing) {
          existing.reason = reason;
          if (comments) existing.comments = comments;
          if (alsoBlock) existing.actionTaken = 'warning';
          await existing.save();
        } else {
          await ReportModel.create({
            reporterId,
            reportedUserId: resolvedUserId,
            reportedProfileId: targetProfileId,
            reason,
            comments: comments || '',
            status: 'pending',
            actionTaken: alsoBlock ? 'warning' : 'none',
          });
        }

        if (alsoBlock && mongoose.Types.ObjectId.isValid(reporterId) && mongoose.Types.ObjectId.isValid(resolvedUserId)) {
          await UserBlockModel.findOneAndUpdate(
            { blockerId: reporterId, blockedUserId: resolvedUserId },
            { $set: { reason: reason || 'Blocked via report' } },
            { upsert: true, new: true }
          );
        }
      } else if (alsoBlock) {
        await recordInMemoryBlock(reporterId, resolvedUserId);
      }

      res.status(201).json({
        success: true,
        message: 'Thank you for protecting our community. Your report has been securely filed with Trust & Safety and the profile has been blocked.',
        data: {
          reportedUserId: resolvedUserId,
          status: 'pending',
          blocked: !!alsoBlock,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
