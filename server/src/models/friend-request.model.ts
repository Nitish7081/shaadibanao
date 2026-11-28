import mongoose, { Document, Schema, Types } from 'mongoose';

export type FriendRequestState = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface IFriendRequest extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  status: FriendRequestState;
  note?: string;
  conversationId?: Types.ObjectId;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FriendRequestSchema = new Schema<IFriendRequest>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 250,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: false,
    },
    respondedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

FriendRequestSchema.index({ senderId: 1, recipientId: 1 }, { unique: true });
FriendRequestSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
FriendRequestSchema.index({ senderId: 1, status: 1, createdAt: -1 });

export const FriendRequestModel =
  mongoose.models.FriendRequest ||
  mongoose.model<IFriendRequest>('FriendRequest', FriendRequestSchema);
