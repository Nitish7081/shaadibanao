import mongoose, { Schema, Document } from 'mongoose';
import { MARITAL_STATUS } from '@bandhansetu/shared';

export interface IPartnerPreference extends Document {
  userId: mongoose.Types.ObjectId | string;
  minAge: number;
  maxAge: number;
  minHeightCm: number;
  maxHeightCm: number;
  maritalStatuses: string[];
  religions: string[];
  motherTongues: string[];
  educations: string[];
  occupations: string[];
  cities: string[];
  manglikPreference: 'any' | 'yes' | 'no';
  createdAt: Date;
  updatedAt: Date;
}

const PartnerPreferenceSchema = new Schema<IPartnerPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    minAge: { type: Number, default: 21 },
    maxAge: { type: Number, default: 32 },
    minHeightCm: { type: Number, default: 150 },
    maxHeightCm: { type: Number, default: 185 },
    maritalStatuses: {
      type: [String],
      enum: MARITAL_STATUS,
      default: ['never_married'],
    },
    religions: { type: [String], default: ['Hindu'] },
    motherTongues: { type: [String], default: [] },
    educations: { type: [String], default: [] },
    occupations: { type: [String], default: [] },
    cities: { type: [String], default: [] },
    manglikPreference: {
      type: String,
      enum: ['any', 'yes', 'no'],
      default: 'any',
    },
  },
  {
    timestamps: true,
  }
);

export const PartnerPreferenceModel =
  mongoose.models.PartnerPreference ||
  mongoose.model<IPartnerPreference>('PartnerPreference', PartnerPreferenceSchema);
