import mongoose, { Schema, Document } from 'mongoose';
import { GENDER, MARITAL_STATUS, PHOTO_PRIVACY, PhotoPrivacy } from '@bandhansetu/shared';

export interface IProfilePhoto {
  url: string;
  publicId?: string;
  isMain: boolean;
  privacy: PhotoPrivacy;
  approved: boolean;
}

export interface IProfile extends Document {
  userId: mongoose.Types.ObjectId | string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  dateOfBirth: Date;
  maritalStatus: string;
  heightCm: number;
  motherTongue: string;
  religion: string;
  caste?: string;
  gotra?: string;
  manglik: 'yes' | 'no' | 'dont_know' | 'anshik';
  country: string;
  state: string;
  city: string;
  familyValues: 'traditional' | 'moderate' | 'liberal';
  familyType: 'joint' | 'nuclear';
  fatherOccupation?: string;
  motherOccupation?: string;
  education: string;
  employedIn: string;
  occupation: string;
  annualIncomeBand: string;
  showIncomeBand: boolean;
  photos: IProfilePhoto[];
  photoPrivacy: PhotoPrivacy;
  aboutMe: string;
  completenessPercent: number;
  isVerified: boolean;
  photoChecked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProfilePhotoSchema = new Schema<IProfilePhoto>(
  {
    url: { type: String, required: true },
    publicId: { type: String, trim: true },
    isMain: { type: Boolean, default: false },
    privacy: {
      type: String,
      enum: PHOTO_PRIVACY,
      default: 'everyone',
    },
    approved: { type: Boolean, default: false },
  },
  { _id: true }
);

const ProfileSchema = new Schema<IProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    gender: {
      type: String,
      enum: GENDER,
      required: true,
      index: true,
    },
    dateOfBirth: { type: Date, required: true },
    maritalStatus: {
      type: String,
      enum: MARITAL_STATUS,
      default: 'never_married',
      index: true,
    },
    heightCm: { type: Number, required: true, index: true },
    motherTongue: { type: String, required: true, index: true },
    religion: { type: String, default: 'Hindu', index: true },
    caste: { type: String, trim: true },
    gotra: { type: String, trim: true },
    manglik: {
      type: String,
      enum: ['yes', 'no', 'dont_know', 'anshik'],
      default: 'dont_know',
    },
    country: { type: String, default: 'India' },
    state: { type: String, default: 'Delhi' },
    city: { type: String, required: true, index: true },
    familyValues: {
      type: String,
      enum: ['traditional', 'moderate', 'liberal'],
      default: 'moderate',
    },
    familyType: {
      type: String,
      enum: ['joint', 'nuclear'],
      default: 'nuclear',
    },
    fatherOccupation: { type: String },
    motherOccupation: { type: String },
    education: { type: String, required: true },
    employedIn: {
      type: String,
      enum: ['private', 'government', 'business', 'self_employed', 'not_working'],
      default: 'private',
    },
    occupation: { type: String, required: true },
    annualIncomeBand: { type: String, default: '₹10L - ₹15L' },
    showIncomeBand: { type: Boolean, default: true },
    photos: { type: [ProfilePhotoSchema], default: [] },
    photoPrivacy: {
      type: String,
      enum: PHOTO_PRIVACY,
      default: 'everyone',
    },
    aboutMe: { type: String, default: '' },
    completenessPercent: { type: Number, default: 50 },
    isVerified: { type: Boolean, default: false },
    photoChecked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for matrimonial matching and query speed
ProfileSchema.index({ gender: 1, city: 1 });
ProfileSchema.index({ gender: 1, religion: 1 });
ProfileSchema.index({ gender: 1, heightCm: 1 });

export const ProfileModel =
  mongoose.models.Profile || mongoose.model<IProfile>('Profile', ProfileSchema);
