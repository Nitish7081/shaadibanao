import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpRecord extends Document {
  mobile: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  verified: boolean;
  verificationToken?: string;
  createdAt: Date;
}

const OtpRecordSchema = new Schema<IOtpRecord>(
  {
    mobile: {
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
      index: { expires: 0 }, // TTL index: MongoDB deletes document when expiresAt timestamp arrives
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const OtpModel =
  mongoose.models.OtpRecord || mongoose.model<IOtpRecord>('OtpRecord', OtpRecordSchema);
