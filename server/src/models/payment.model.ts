import mongoose, { Schema, Document } from 'mongoose';

export type PaymentType = 'booking' | 'membership' | 'astrology' | 'pandit_chat';
export type PaymentStatus = 'created' | 'pending' | 'captured' | 'failed' | 'refunded';

export interface IPayment extends Document {
  orderId: string;
  paymentId?: string;
  signature?: string;
  userId: mongoose.Types.ObjectId;
  userName?: string;
  userMobile?: string;
  userEmail?: string;
  type: PaymentType;
  referenceId: string; // bookingId or planId
  referenceDescription?: string;
  amount: number; // in INR
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string; // 'upi' | 'card' | 'netbanking' | 'wallet'
  gateway: string; // 'razorpay' | 'test_gateway'
  metadata?: Record<string, any>;
  failureReason?: string;
  capturedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: String,
      sparse: true,
      index: true,
    },
    signature: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: { type: String, trim: true },
    userMobile: { type: String, trim: true },
    userEmail: { type: String, trim: true },
    type: {
      type: String,
      enum: ['booking', 'membership', 'astrology', 'pandit_chat'],
      required: true,
      index: true,
    },
    referenceId: {
      type: String,
      required: true,
      index: true,
    },
    referenceDescription: { type: String, trim: true },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['created', 'pending', 'captured', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    paymentMethod: { type: String, trim: true },
    gateway: { type: String, default: 'razorpay' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    failureReason: { type: String, trim: true },
    capturedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const PaymentModel =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
