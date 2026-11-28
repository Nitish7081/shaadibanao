import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IHello extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const HelloSchema = new Schema<IHello>(
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
    message: {
      type: String,
      trim: true,
      maxlength: 200,
      default: 'Namaste! 👋',
    },
  },
  { timestamps: true }
);

// Strictly enforce one free Hello per sender-recipient pair at database level
HelloSchema.index({ senderId: 1, recipientId: 1 }, { unique: true });

export const HelloModel =
  mongoose.models.Hello || mongoose.model<IHello>('Hello', HelloSchema);
