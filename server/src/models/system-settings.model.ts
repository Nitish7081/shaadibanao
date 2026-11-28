import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSettings extends Document {
  key: string;
  appName: string;
  femaleFreeChatEnabled: boolean;
  malePaidChatRequired: boolean;
  maleFreeReplyToFemale: boolean;
  maleFreeMessageLimit: number;
  panditFreeChatEnabled: boolean;
  panditFreeMessageLimit: number;
  panditPaidChatRequired: boolean;
  femaleFreePanditChat: boolean;
  panditWhatsappEnabled: boolean;
  panditWhatsappRule:
    | 'paid_booking_or_subscription'
    | 'paid_booking_only'
    | 'paid_subscription_only'
    | 'always_off';
  plusPlanPriceInr: number;
  premiumPlanPriceInr: number;
  defaultPanditConsultationFee: number;
  defaultAstrologyFee: number;
  audioConsultationPriceInr: number;
  videoConsultationPriceInr: number;
  chatConsultationPriceInr: number;
  consultationDurationMinutes: number;
  freeTrialCallMinutes: number;
  callCommissionRate: number;
  maxMessageLength: number;
  mediaAttachmentsEnabled: boolean;
  bannedKeywords: string[];
  supportPhone: string;
  contactPhone: string;
  supportEmail: string;
  contactEmail: string;
  whatsappPhone: string;
  contactWhatsApp: string;
  whatsappUrl: string;
  bookingAutoAssign: boolean;
  defaultLanguage: string;
  updatedBy?: string;
  updatedAt: Date;
  createdAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, default: 'global_settings', unique: true, index: true },
    appName: { type: String, default: 'ShaadiBanao' },
    femaleFreeChatEnabled: { type: Boolean, default: true },
    malePaidChatRequired: { type: Boolean, default: true },
    maleFreeReplyToFemale: { type: Boolean, default: false },
    maleFreeMessageLimit: { type: Number, default: 1, min: 0 },
    panditFreeChatEnabled: { type: Boolean, default: true },
    panditFreeMessageLimit: { type: Number, default: 1, min: 0 },
    panditPaidChatRequired: { type: Boolean, default: true },
    femaleFreePanditChat: { type: Boolean, default: false },
    panditWhatsappEnabled: { type: Boolean, default: true },
    panditWhatsappRule: {
      type: String,
      enum: [
        'paid_booking_or_subscription',
        'paid_booking_only',
        'paid_subscription_only',
        'always_off',
      ],
      default: 'paid_booking_or_subscription',
    },
    plusPlanPriceInr: { type: Number, default: 2999, min: 0 },
    premiumPlanPriceInr: { type: Number, default: 4999, min: 0 },
    defaultPanditConsultationFee: { type: Number, default: 501, min: 0 },
    defaultAstrologyFee: { type: Number, default: 501, min: 0 },
    audioConsultationPriceInr: { type: Number, default: 501, min: 0 },
    videoConsultationPriceInr: { type: Number, default: 1100, min: 0 },
    chatConsultationPriceInr: { type: Number, default: 251, min: 0 },
    consultationDurationMinutes: { type: Number, default: 20, min: 1 },
    freeTrialCallMinutes: { type: Number, default: 2, min: 0 },
    callCommissionRate: { type: Number, default: 15, min: 0, max: 100 },
    maxMessageLength: { type: Number, default: 1000, min: 10 },
    mediaAttachmentsEnabled: { type: Boolean, default: true },
    bannedKeywords: {
      type: [String],
      default: ['abuse', 'fraud', 'scam', 'money transfer', 'account number', 'bank details'],
    },
    supportPhone: { type: String, default: '8076168502' },
    contactPhone: { type: String, default: '8076168502' },
    supportEmail: { type: String, default: 'shaadibanao.urbanpower@gmail.com' },
    contactEmail: { type: String, default: 'shaadibanao.urbanpower@gmail.com' },
    whatsappPhone: { type: String, default: '8076168502' },
    contactWhatsApp: { type: String, default: '8076168502' },
    whatsappUrl: { type: String, default: 'https://wa.me/918076168502' },
    bookingAutoAssign: { type: Boolean, default: false },
    defaultLanguage: { type: String, default: 'hi' },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

export const SystemSettingsModel =
  mongoose.models.SystemSettings || mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
