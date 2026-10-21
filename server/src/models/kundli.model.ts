import mongoose, { Schema, Document } from 'mongoose';
import { RASHI_LIST, NAKSHATRA_LIST } from '@bandhansetu/shared';

export interface IKundli extends Document {
  userId: mongoose.Types.ObjectId;
  dateOfBirth: Date;
  timeOfBirth: string; // "14:30"
  isApproximateTime: boolean;
  birthPlace: {
    name: string;
    state: string;
    country: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  rashi: string;
  nakshatra: string;
  charan?: number;
  lagna?: string;
  manglikStatus: 'non_manglik' | 'manglik' | 'anshik_manglik' | 'dont_know';
  visibility: 'private' | 'matches_only' | 'shared_with_pandit';
  chartUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KundliSchema = new Schema<IKundli>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    dateOfBirth: { type: Date, required: true },
    timeOfBirth: { type: String, required: true, trim: true },
    isApproximateTime: { type: Boolean, default: false },
    birthPlace: {
      name: { type: String, required: true, trim: true },
      state: { type: String, default: 'Delhi', trim: true },
      country: { type: String, default: 'India', trim: true },
      latitude: { type: Number },
      longitude: { type: Number },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },
    rashi: { type: String, required: true, trim: true },
    nakshatra: { type: String, required: true, trim: true },
    charan: { type: Number, min: 1, max: 4, default: 1 },
    lagna: { type: String, trim: true },
    manglikStatus: {
      type: String,
      enum: ['non_manglik', 'manglik', 'anshik_manglik', 'dont_know'],
      default: 'dont_know',
    },
    visibility: {
      type: String,
      enum: ['private', 'matches_only', 'shared_with_pandit'],
      default: 'matches_only',
    },
    chartUrl: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export const KundliModel =
  mongoose.models.Kundli || mongoose.model<IKundli>('Kundli', KundliSchema);
