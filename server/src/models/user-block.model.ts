import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUserBlock extends Document {
  blockerId: Types.ObjectId;
  blockedUserId: Types.ObjectId;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserBlockSchema = new Schema<IUserBlock>(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

UserBlockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

export const UserBlockModel =
  mongoose.models.UserBlock || mongoose.model<IUserBlock>('UserBlock', UserBlockSchema);
