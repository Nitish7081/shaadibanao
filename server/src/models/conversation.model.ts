import mongoose, { Document, Schema, Types } from 'mongoose';

export type ContactExchangeState = 'none' | 'requested' | 'accepted' | 'declined';

export interface IConversation extends Document {
  matchId?: Types.ObjectId;
  friendRequestId?: Types.ObjectId;
  category?: 'matrimonial' | 'pandit_consultation' | 'booking_consultation';
  participantPairKey?: string;
  panditId?: Types.ObjectId;
  bookingId?: Types.ObjectId;
  user1Id: Types.ObjectId;
  user2Id: Types.ObjectId;
  contactExchange: {
    status: ContactExchangeState;
    requestedBy?: Types.ObjectId;
    updatedAt?: Date;
  };
  isFreeChat: boolean;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'Match',
      required: false,
      index: true,
    },
    friendRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'FriendRequest',
      required: false,
      index: true,
    },
    category: {
      type: String,
      enum: ['matrimonial', 'pandit_consultation', 'booking_consultation'],
      default: 'matrimonial',
      index: true,
    },
    participantPairKey: {
      type: String,
      trim: true,
    },
    panditId: {
      type: Schema.Types.ObjectId,
      ref: 'Pandit',
      required: false,
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
      index: true,
    },
    user1Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user2Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactExchange: {
      status: {
        type: String,
        enum: ['none', 'requested', 'accepted', 'declined'],
        default: 'none',
      },
      requestedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      updatedAt: {
        type: Date,
      },
    },
    isFreeChat: {
      type: Boolean,
      default: false,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ user1Id: 1, lastMessageAt: -1 });
ConversationSchema.index({ user2Id: 1, lastMessageAt: -1 });
ConversationSchema.index({ participantPairKey: 1 }, { unique: true, sparse: true });
ConversationSchema.index({ lastMessageAt: -1 });

export const ConversationModel =
  mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
