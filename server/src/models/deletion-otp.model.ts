import mongoose, { Schema, Document } from 'mongoose';

export interface IDeletionOtp extends Document {
  identifierHash: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const DeletionOtpSchema = new Schema<IDeletionOtp>(
  {
    identifierHash: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL auto-deletion on expiry
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const DeletionOtpModel =
  mongoose.models.DeletionOtp ||
  mongoose.model<IDeletionOtp>('DeletionOtp', DeletionOtpSchema);
