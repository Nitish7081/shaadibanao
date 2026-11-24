import mongoose, { Document, Schema, Types } from 'mongoose';

export type ContactExchangeState = 'none' | 'requested' | 'accepted' | 'declined';

export interface IConversation extends Document {
  matchId?: Types.ObjectId;
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

ConversationSchema.index({ user1Id: 1, user2Id: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

export const ConversationModel =
  mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
