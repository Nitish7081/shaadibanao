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

export interface IPandit extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  profilePhoto?: string;
  phone?: string;
  email?: string;
  bio: string;
  experienceYears: number;
  languages: string[];
  serviceLocations: string[];
  religiousTradition: string;
  services: IPanditService[];
  availability: IPanditAvailability[];
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedBy?: mongoose.Types.ObjectId | string;
  verifiedAt?: Date;
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

const PanditSchema = new Schema<IPandit>(
  {
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
    bio: { type: String, default: '', trim: true },
    experienceYears: { type: Number, default: 5, min: 0 },
    languages: { type: [String], default: ['Hindi', 'Sanskrit'] },
    serviceLocations: { type: [String], default: ['Delhi NCR', 'Online'] },
    religiousTradition: { type: String, default: 'Vedic Sanatan', trim: true },
    services: { type: [PanditServiceSchema], default: [] },
    availability: { type: [PanditAvailabilitySchema], default: [] },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    verifiedBy: { type: Schema.Types.Mixed, ref: 'User' },
    verifiedAt: { type: Date },
    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes
PanditSchema.index({ verificationStatus: 1, rating: -1 });

export const PanditModel =
  mongoose.models.Pandit || mongoose.model<IPandit>('Pandit', PanditSchema);
