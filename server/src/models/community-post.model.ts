import mongoose, { Schema, Document } from 'mongoose';
import {
  COMMUNITY_CATEGORY,
  CommunityCategory,
  COMMUNITY_MODERATION_STATUS,
  CommunityModerationStatus,
} from '@bandhansetu/shared';

export interface ICommunityPost extends Document {
  userId: mongoose.Types.ObjectId;
  authorName: string;
  authorAvatar?: string;
  mediaUrl: string;
  publicId?: string;
  caption: string;
  category: CommunityCategory;
  moderationStatus: CommunityModerationStatus;
  moderatedBy?: mongoose.Types.ObjectId | string;
  moderatedAt?: Date;
  moderationReason?: string;
  likes: mongoose.Types.ObjectId[];
  reportsCount: number;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityPostSchema = new Schema<ICommunityPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorName: { type: String, required: true, trim: true },
    authorAvatar: { type: String, trim: true },
    mediaUrl: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    caption: { type: String, required: true, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: COMMUNITY_CATEGORY,
      default: 'wedding_story',
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: COMMUNITY_MODERATION_STATUS,
      default: 'pending',
      index: true,
    },
    moderatedBy: { type: Schema.Types.Mixed, ref: 'User' },
    moderatedAt: { type: Date },
    moderationReason: { type: String, trim: true },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reportsCount: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for public feed and moderation queues
CommunityPostSchema.index({ moderationStatus: 1, createdAt: -1 });
CommunityPostSchema.index({ moderationStatus: 1, isPinned: -1, createdAt: -1 });
CommunityPostSchema.index({ category: 1, moderationStatus: 1, isPinned: -1, createdAt: -1 });
CommunityPostSchema.index({ userId: 1, moderationStatus: 1, createdAt: -1 });

export const CommunityPostModel =
  mongoose.models.CommunityPost ||
  mongoose.model<ICommunityPost>('CommunityPost', CommunityPostSchema);
