import mongoose from 'mongoose';
import { PartnerPreferenceModel } from '../models/preference.model';
import { PartnerPreferencesInput, PartnerPreferences } from '@bandhansetu/shared';

// In-memory fallback
const inMemoryPrefStore = new Map<string, any>();

export class PreferenceService {
  private static formatPreference(doc: any): PartnerPreferences {
    return {
      id: doc._id?.toString() || doc.id,
      userId: doc.userId?.toString(),
      minAge: doc.minAge,
      maxAge: doc.maxAge,
      minHeightCm: doc.minHeightCm,
      maxHeightCm: doc.maxHeightCm,
      maritalStatuses: doc.maritalStatuses || ['never_married'],
      religions: doc.religions || ['Hindu'],
      motherTongues: doc.motherTongues || [],
      educations: doc.educations || [],
      occupations: doc.occupations || [],
      cities: doc.cities || [],
      manglikPreference: doc.manglikPreference || 'any',
    };
  }

  public static async getMyPreferences(userId: string): Promise<PartnerPreferences> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let prefDoc: any = null;
    if (isDbConnected) {
      prefDoc = await PartnerPreferenceModel.findOne({ userId });
    } else {
      prefDoc = inMemoryPrefStore.get(userId);
    }

    if (!prefDoc) {
      // Default preferences if none saved yet
      return {
        userId,
        minAge: 21,
        maxAge: 32,
        minHeightCm: 150,
        maxHeightCm: 185,
        maritalStatuses: ['never_married'],
        religions: ['Hindu'],
        motherTongues: [],
        educations: [],
        occupations: [],
        cities: [],
        manglikPreference: 'any',
      };
    }

    return this.formatPreference(prefDoc);
  }

  public static async upsertMyPreferences(
    userId: string,
    input: PartnerPreferencesInput
  ): Promise<PartnerPreferences> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let prefDoc: any = null;
    if (isDbConnected) {
      prefDoc = await PartnerPreferenceModel.findOneAndUpdate(
        { userId },
        { $set: { ...input, userId } },
        { new: true, upsert: true, runValidators: true }
      );
    } else {
      prefDoc = {
        id: `pref_${Date.now()}`,
        _id: `pref_${Date.now()}`,
        userId,
        ...input,
      };
      inMemoryPrefStore.set(userId, prefDoc);
    }

    return this.formatPreference(prefDoc);
  }
}
