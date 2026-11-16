import mongoose, { Schema, Document } from 'mongoose';

export interface IConsentLog extends Document {
  userId: mongoose.Types.ObjectId | string;
  consentType: 'registration' | 'reconsent';
  privacyPolicyVersion: string;
  termsVersion: string;
  agreedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  authMethod: 'phone_otp' | 'firebase_phone' | 'google_oauth' | 'jwt_session';
  source: 'mobile_registration' | 'mobile_reconsent' | 'web_consent';
  createdAt: Date;
}

const ConsentLogSchema = new Schema<IConsentLog>(
  {
    userId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    consentType: {
      type: String,
      enum: ['registration', 'reconsent'],
      required: true,
      index: true,
    },
    privacyPolicyVersion: {
      type: String,
      required: true,
      trim: true,
    },
    termsVersion: {
      type: String,
      required: true,
      trim: true,
    },
    agreedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 512,
    },
    authMethod: {
      type: String,
      enum: ['phone_otp', 'firebase_phone', 'google_oauth', 'jwt_session'],
      required: true,
    },
    source: {
      type: String,
      enum: ['mobile_registration', 'mobile_reconsent', 'web_consent'],
      default: 'mobile_registration',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ConsentLogSchema.index({ userId: 1, agreedAt: -1 });
ConsentLogSchema.index({ privacyPolicyVersion: 1, termsVersion: 1 });

export const ConsentLogModel =
  mongoose.models.ConsentLog || mongoose.model<IConsentLog>('ConsentLog', ConsentLogSchema);
