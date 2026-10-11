import mongoose, { Schema, Document } from 'mongoose';
import { INTEREST_STATUS, InterestStatus } from '@bandhansetu/shared';

export interface IInterest extends Document {
  senderId: mongoose.Types.ObjectId | string;
  receiverId: mongoose.Types.ObjectId | string;
  status: InterestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InterestSchema = new Schema<IInterest>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: INTEREST_STATUS,
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent sending duplicate interests to the same member
InterestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

export const InterestModel =
  mongoose.models.Interest || mongoose.model<IInterest>('Interest', InterestSchema);
