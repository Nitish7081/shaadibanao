import mongoose, { Schema, Document } from 'mongoose';
import { PROFILE_CREATED_FOR, ProfileCreatedFor } from '@bandhansetu/shared';

export interface IUser extends Document {
  mobile?: string;
  email?: string;
  emailVerified?: boolean;
  firebaseUid?: string;
  authProvider?: 'phone' | 'google' | 'both';
  displayName?: string;
  avatarUrl?: string;
  passwordHash?: string;
  role: 'member' | 'pandit' | 'moderator' | 'admin';
  status: 'active' | 'pending' | 'suspended' | 'deleted';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  phoneVerified?: boolean;
  identityVerificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  identityDocumentType?: string;
  identityDocumentReferenceMasked?: string;
  identityConsent?: {
    hasConsent: boolean;
    agreedAt: Date;
    termsVersion: string;
  };
  photoApprovalStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  approvedBy?: mongoose.Types.ObjectId | string;
  approvedAt?: Date;
  rejectionReason?: string;
  moderationRemarks?: string;
  profileFor: ProfileCreatedFor;
  hasProfile: boolean;
  consent: {
    agreedAt: Date;
    ipAddress?: string;
    termsVersion: string;
  };
  refreshTokens: Array<{
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
    device?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    mobile: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    firebaseUid: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
    },
    authProvider: {
      type: String,
      enum: ['phone', 'google', 'both'],
      default: 'phone',
    },
    displayName: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ['member', 'pandit', 'moderator', 'admin'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending',
      index: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    identityVerificationStatus: {
      type: String,
      enum: ['none', 'pending', 'verified', 'rejected'],
      default: 'none',
      index: true,
    },
    identityDocumentType: {
      type: String,
      enum: ['aadhaar_card', 'passport', 'voter_id'],
      required: false,
    },
    identityDocumentReferenceMasked: {
      type: String,
      trim: true,
      required: false,
    },
    identityConsent: {
      hasConsent: { type: Boolean, default: false },
      agreedAt: { type: Date },
      termsVersion: { type: String },
    },
    photoApprovalStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
      index: true,
    },
    approvedBy: {
      type: Schema.Types.Mixed,
      ref: 'User',
      required: false,
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    rejectionReason: {
      type: String,
      trim: true,
      required: false,
    },
    moderationRemarks: {
      type: String,
      trim: true,
      required: false,
    },
    profileFor: {
      type: String,
      enum: PROFILE_CREATED_FOR,
      default: 'myself',
    },
    hasProfile: {
      type: Boolean,
      default: false,
    },
    consent: {
      agreedAt: { type: Date, default: Date.now },
      ipAddress: { type: String },
      termsVersion: { type: String, default: 'v1.0' },
    },
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        device: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Export model
export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
