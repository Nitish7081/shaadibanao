import mongoose, { Document, Schema, Types } from 'mongoose';

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  text: string;
  attachmentUrl?: string;
  attachmentType?: string;
  isFreeChat?: boolean;
  planTier?: string;
  status: MessageDeliveryStatus;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
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
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    attachmentUrl: {
      type: String,
      trim: true,
    },
    attachmentType: {
      type: String,
      enum: ['image', 'document', 'audio', 'none'],
      default: 'none',
    },
    isFreeChat: {
      type: Boolean,
      default: false,
    },
    planTier: {
      type: String,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const MessageModel =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
