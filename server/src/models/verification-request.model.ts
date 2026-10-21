import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationRequest extends Document {
  userId: mongoose.Types.ObjectId;
  userDisplayName?: string;
  userMobile?: string;
  userEmail?: string;
  documentType: 'aadhaar_card' | 'passport' | 'voter_id';
  documentReferenceMasked: string; // e.g. "XXXX-XXXX-1234"
  documentStorageKey: string;      // Private internal storage key; never served publicly
  consentGranted: boolean;
  consentTimestamp: Date;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  verifiedBy?: mongoose.Types.ObjectId | string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userDisplayName: { type: String, trim: true },
    userMobile: { type: String, trim: true },
    userEmail: { type: String, trim: true },
    documentType: {
      type: String,
      enum: ['aadhaar_card', 'passport', 'voter_id'],
      required: true,
    },
    documentReferenceMasked: {
      type: String,
      required: true,
      trim: true,
    },
    documentStorageKey: {
      type: String,
      required: true,
      select: false, // Never return in default queries for security
    },
    consentGranted: {
      type: Boolean,
      required: true,
      default: false,
    },
    consentTimestamp: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    verifiedBy: { type: Schema.Types.Mixed, ref: 'User' },
    verifiedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const VerificationRequestModel =
  mongoose.models.VerificationRequest ||
  mongoose.model<IVerificationRequest>('VerificationRequest', VerificationRequestSchema);
