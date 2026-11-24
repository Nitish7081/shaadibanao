import mongoose, { Schema, Document } from 'mongoose';

export interface IPanditService {
  serviceId: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceInr: number;
  ceremonyType: string;
}

export interface IPanditAvailability {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "13:00"
  isAvailable: boolean;
}

export interface IPanditDocument {
  docType: string; // e.g. 'aadhaar', 'pan', 'degree_shastri', 'experience_cert'
  docUrl: string;
  docName: string;
  verifiedAt?: Date;
  status: 'pending' | 'verified' | 'rejected';
}

export interface IPanditBankDetails {
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
}

export interface IPanditAddress {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface IPandit extends Document {
  panditId: string; // e.g. "PND-2026-1001"
  userId: mongoose.Types.ObjectId;
  name: string;
  profilePhoto?: string;
  phone?: string;
  email?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: Date;
  address?: IPanditAddress;
  city?: string;
  state?: string;
  bio: string;
  experienceYears: number;
  languages: string[];
  specialization: string[];
  serviceLocations: string[];
  religiousTradition: string;
  services: IPanditService[];
  availability: IPanditAvailability[];
  offersAstrology: boolean;
  astrologyExpertise: string[];
  consultationCharges: number;
  bankDetails?: IPanditBankDetails;
  documents: IPanditDocument[];
  verificationStatus: 'pending' | 'under_review' | 'approved' | 'verified' | 'rejected' | 'suspended';
  verifiedBy?: mongoose.Types.ObjectId | string;
  verifiedAt?: Date;
  rejectionReason?: string;
  requestedDocuments?: string[];
  isActive: boolean;
  isOnline: boolean;
  isChatAvailable?: boolean;
  isAudioCallAvailable?: boolean;
  isVideoCallAvailable?: boolean;
  audioCallChargePerMin?: number;
  videoCallChargePerMin?: number;
  isAssigned: boolean;
  totalEarnings: number;
  pendingPayout: number;
  rating: number;
  reviewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PanditServiceSchema = new Schema<IPanditService>(
  {
    serviceId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    durationMinutes: { type: Number, default: 60 },
    priceInr: { type: Number, required: true, min: 0 },
    ceremonyType: { type: String, default: 'other_puja' },
  },
  { _id: true }
);

const PanditAvailabilitySchema = new Schema<IPanditAvailability>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false }
);

const PanditDocumentSchema = new Schema<IPanditDocument>(
  {
    docType: { type: String, required: true },
    docUrl: { type: String, required: true },
    docName: { type: String, required: true },
    verifiedAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
  },
  { _id: true }
);

const PanditSchema = new Schema<IPandit>(
  {
    panditId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    profilePhoto: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'male',
    },
    dateOfBirth: { type: Date },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    bio: { type: String, default: '', trim: true },
    experienceYears: { type: Number, default: 5, min: 0 },
    languages: { type: [String], default: ['Hindi', 'Sanskrit'] },
    specialization: {
      type: [String],
      default: ['Vedic Sanatan Puja', 'Vivah Sanskar', 'Kundli Milan', 'Astrology'],
    },
    serviceLocations: { type: [String], default: ['Delhi NCR', 'Online'] },
    religiousTradition: { type: String, default: 'Vedic Sanatan', trim: true },
    services: { type: [PanditServiceSchema], default: [] },
    availability: { type: [PanditAvailabilitySchema], default: [] },
    offersAstrology: { type: Boolean, default: true },
    astrologyExpertise: {
      type: [String],
      default: ['Kundli Milan', 'Horoscope Analysis', 'Career & Marriage Guidance', 'Guna Milan'],
    },
    consultationCharges: { type: Number, default: 501, min: 0 },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    documents: { type: [PanditDocumentSchema], default: [] },
    verificationStatus: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'verified', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    verifiedBy: { type: Schema.Types.Mixed, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    requestedDocuments: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isOnline: { type: Boolean, default: true, index: true },
    isChatAvailable: { type: Boolean, default: true },
    isAudioCallAvailable: { type: Boolean, default: true },
    isVideoCallAvailable: { type: Boolean, default: true },
    audioCallChargePerMin: { type: Number, default: 21, min: 0 },
    videoCallChargePerMin: { type: Number, default: 51, min: 0 },
    isAssigned: { type: Boolean, default: false, index: true },
    totalEarnings: { type: Number, default: 0, min: 0 },
    pendingPayout: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes
PanditSchema.index({ verificationStatus: 1, rating: -1 });
PanditSchema.index({ isActive: 1, isOnline: 1 });
PanditSchema.index({ offersAstrology: 1, verificationStatus: 1 });

export const PanditModel =
  mongoose.models.Pandit || mongoose.model<IPandit>('Pandit', PanditSchema);
