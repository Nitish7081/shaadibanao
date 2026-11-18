import mongoose, { Schema, Document } from 'mongoose';
import { ACCOUNT_DELETION_REASONS, AccountDeletionReason } from '@bandhansetu/shared';

export interface IDeletionAuditEntry {
  action: string;
  actor: 'user_verified' | 'system' | 'admin';
  timestamp: Date;
  note?: string;
}

export interface IAccountDeletionRequest extends Document {
  requestId: string;
  userId: mongoose.Types.ObjectId | string;
  identifierType: 'mobile' | 'email' | 'account';
  maskedIdentifier: string;
  identifierHash: string;
  reason: AccountDeletionReason;
  additionalFeedback?: string;
  status: 'completed' | 'scheduled' | 'rejected';
  verificationMethod: 'jwt_session' | 'firebase_id_token' | 'otp_challenge';
  verifiedAt: Date;
  completedAt?: Date;
  deletedCollectionsSummary: string[];
  ipHash?: string;
  auditTrail: IDeletionAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const DeletionAuditEntrySchema = new Schema<IDeletionAuditEntry>(
  {
    action: { type: String, required: true, trim: true },
    actor: {
      type: String,
      enum: ['user_verified', 'system', 'admin'],
      default: 'system',
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const AccountDeletionRequestSchema = new Schema<IAccountDeletionRequest>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    identifierType: {
      type: String,
      enum: ['mobile', 'email', 'account'],
      required: true,
    },
    maskedIdentifier: {
      type: String,
      required: true,
      trim: true,
    },
    identifierHash: {
      type: String,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ACCOUNT_DELETION_REASONS,
      default: 'other',
    },
    additionalFeedback: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['completed', 'scheduled', 'rejected'],
      default: 'completed',
      index: true,
    },
    verificationMethod: {
      type: String,
      enum: ['jwt_session', 'firebase_id_token', 'otp_challenge'],
      required: true,
    },
    verifiedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    deletedCollectionsSummary: {
      type: [String],
      default: [],
    },
    ipHash: {
      type: String,
      trim: true,
    },
    auditTrail: {
      type: [DeletionAuditEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

AccountDeletionRequestSchema.index({ createdAt: -1 });

export const AccountDeletionRequestModel =
  mongoose.models.AccountDeletionRequest ||
  mongoose.model<IAccountDeletionRequest>('AccountDeletionRequest', AccountDeletionRequestSchema);
