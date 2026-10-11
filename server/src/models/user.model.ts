import mongoose, { Schema, Document } from 'mongoose';
import { PROFILE_CREATED_FOR, ProfileCreatedFor } from '@bandhansetu/shared';

export interface IUser extends Document {
  mobile: string;
  role: 'member' | 'pandit' | 'moderator' | 'admin';
  status: 'active' | 'pending' | 'suspended' | 'deleted';
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
      required: true,
      unique: true,
      trim: true,
      index: true,
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
