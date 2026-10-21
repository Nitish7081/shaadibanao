import mongoose, { Schema, Document, Types } from 'mongoose';
import { REPORT_REASONS, ReportReason } from '@bandhansetu/shared';

export interface IReport extends Document {
  reporterId: Types.ObjectId | string;
  reportedUserId: Types.ObjectId | string;
  reportedProfileId?: string;
  reason: ReportReason;
  comments?: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  actionTaken?: 'none' | 'warning' | 'suspended' | 'profile_removed';
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedProfileId: {
      type: String,
      required: false,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
      index: true,
    },
    comments: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'actioned', 'dismissed'],
      default: 'pending',
      index: true,
    },
    actionTaken: {
      type: String,
      enum: ['none', 'warning', 'suspended', 'profile_removed'],
      default: 'none',
    },
  },
  {
    timestamps: true,
  }
);

export const ReportModel =
  mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);
