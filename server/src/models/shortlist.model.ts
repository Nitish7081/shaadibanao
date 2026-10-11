import mongoose, { Schema, Document } from 'mongoose';

export interface IShortlist extends Document {
  userId: mongoose.Types.ObjectId | string;
  profileId: mongoose.Types.ObjectId | string;
  createdAt: Date;
}

const ShortlistSchema = new Schema<IShortlist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Prevent duplicate shortlisting of the same profile by the same user
ShortlistSchema.index({ userId: 1, profileId: 1 }, { unique: true });

export const ShortlistModel =
  mongoose.models.Shortlist || mongoose.model<IShortlist>('Shortlist', ShortlistSchema);
