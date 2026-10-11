import mongoose from 'mongoose';
import { ProfileModel, IProfile } from '../models/profile.model';
import { UserModel } from '../models/user.model';
import { AppError } from '../middleware/errorHandler';
import {
  UpsertProfileInput,
  UserProfile,
  PublicProfile,
  PhotoData,
} from '@bandhansetu/shared';

// In-memory fallback for testing / dev mode without active MongoDB
const inMemoryProfileStore = new Map<string, any>();

export class ProfileService {
  /**
   * Calculates age in years from date of birth
   */
  public static calculateAge(dob: Date | string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(18, age);
  }

  /**
   * Calculates profile completion score based on filled sections
   */
  public static calculateCompleteness(data: Partial<UpsertProfileInput>): number {
    let score = 0;
    if (data.firstName && data.lastName && data.dateOfBirth && data.heightCm) score += 25;
    if (data.city && data.religion && data.motherTongue) score += 20;
    if (data.education && data.occupation) score += 20;
    if (data.photos && data.photos.length > 0) score += 20;
    if (data.aboutMe && data.aboutMe.trim().length >= 30) score += 15;
    return Math.min(100, score);
  }

  /**
   * Formats internal profile record to full UserProfile (Owner View)
   */
  private static formatUserProfile(doc: any): UserProfile {
    const dob = doc.dateOfBirth;
    return {
      id: doc._id?.toString() || doc.id,
      userId: doc.userId?.toString(),
      firstName: doc.firstName,
      lastName: doc.lastName,
      gender: doc.gender,
      dateOfBirth: typeof dob === 'string' ? dob : dob.toISOString().split('T')[0],
      age: this.calculateAge(dob),
      maritalStatus: doc.maritalStatus,
      heightCm: doc.heightCm,
      motherTongue: doc.motherTongue,
      religion: doc.religion,
      caste: doc.caste,
      gotra: doc.gotra,
      manglik: doc.manglik,
      country: doc.country,
      state: doc.state,
      city: doc.city,
      familyValues: doc.familyValues,
      familyType: doc.familyType,
      fatherOccupation: doc.fatherOccupation,
      motherOccupation: doc.motherOccupation,
      education: doc.education,
      employedIn: doc.employedIn,
      occupation: doc.occupation,
      annualIncomeBand: doc.annualIncomeBand,
      showIncomeBand: doc.showIncomeBand,
      photos: (doc.photos || []).map((p: any) => ({
        id: p._id?.toString() || p.id,
        url: p.url,
        isMain: p.isMain,
        privacy: p.privacy,
        approved: p.approved,
      })),
      photoPrivacy: doc.photoPrivacy,
      aboutMe: doc.aboutMe || '',
      completenessPercent: doc.completenessPercent || 50,
      isVerified: doc.isVerified || false,
      photoChecked: doc.photoChecked || false,
      createdAt: doc.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString?.() || new Date().toISOString(),
    };
  }

  /**
   * Formats profile to redacted PublicProfile according to blueprint privacy display rules
   */
  public static formatPublicProfile(doc: any): PublicProfile {
    const dob = doc.dateOfBirth;
    const age = this.calculateAge(dob);

    // Rule: First name + last initial (e.g. "Priya S.")
    const lastInitial = doc.lastName ? `${doc.lastName.trim().charAt(0).toUpperCase()}.` : '';
    const displayName = `${doc.firstName.trim()} ${lastInitial}`.trim();

    // Rule: Photo privacy handling
    const isBlurred = doc.photoPrivacy === 'blurred';
    const photos = (doc.photos || []).map((p: any) => ({
      url: p.url,
      isMain: p.isMain,
      isBlurred: isBlurred || p.privacy === 'blurred',
    }));

    return {
      id: doc._id?.toString() || doc.id,
      displayName,
      gender: doc.gender,
      age,
      heightCm: doc.heightCm,
      maritalStatus: doc.maritalStatus,
      motherTongue: doc.motherTongue,
      religion: doc.religion,
      caste: doc.caste,
      city: doc.city,
      state: doc.state,
      education: doc.education,
      occupation: doc.occupation,
      annualIncomeBand: doc.showIncomeBand ? doc.annualIncomeBand : undefined,
      photos,
      aboutMe: doc.aboutMe || '',
      isVerified: doc.isVerified || false,
      photoChecked: doc.photoChecked || false,
      isContactLocked: true, // Always locked until mutual interest + explicit consent
    };
  }

  /**
   * GET /api/v1/profiles/me
   */
  public static async getMyProfile(userId: string): Promise<UserProfile> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let profileDoc: any = null;
    if (isDbConnected) {
      profileDoc = await ProfileModel.findOne({ userId });
    } else {
      profileDoc = inMemoryProfileStore.get(userId);
    }

    if (!profileDoc) {
      throw new AppError('Profile not found. Please create your profile first.', 404, 'PROFILE_NOT_FOUND');
    }

    return this.formatUserProfile(profileDoc);
  }

  /**
   * PUT /api/v1/profiles/me
   */
  public static async upsertMyProfile(
    userId: string,
    input: UpsertProfileInput
  ): Promise<UserProfile> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const completenessPercent = this.calculateCompleteness(input);

    const profileData = {
      ...input,
      dateOfBirth: new Date(input.dateOfBirth),
      completenessPercent,
      userId,
    };

    let profileDoc: any = null;

    if (isDbConnected) {
      profileDoc = await ProfileModel.findOneAndUpdate(
        { userId },
        { $set: profileData },
        { new: true, upsert: true, runValidators: true }
      );

      // Update user record to indicate profile creation
      await UserModel.findByIdAndUpdate(userId, { hasProfile: true });
    } else {
      const existing = inMemoryProfileStore.get(userId) || {};
      profileDoc = {
        ...existing,
        ...profileData,
        id: existing.id || `prof_${Date.now()}`,
        _id: existing._id || `prof_${Date.now()}`,
        createdAt: existing.createdAt || new Date(),
        updatedAt: new Date(),
      };
      inMemoryProfileStore.set(userId, profileDoc);
    }

    return this.formatUserProfile(profileDoc);
  }

  /**
   * GET /api/v1/profiles/:profileId (Public View)
   */
  public static async getPublicProfile(profileId: string): Promise<PublicProfile> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let profileDoc: any = null;

    if (isDbConnected) {
      if (mongoose.Types.ObjectId.isValid(profileId)) {
        profileDoc = await ProfileModel.findOne({
          $or: [{ _id: profileId }, { userId: profileId }],
        });
      } else {
        profileDoc = await ProfileModel.findOne({ userId: profileId });
      }
    } else {
      for (const p of inMemoryProfileStore.values()) {
        if (p.id === profileId || p._id === profileId || p.userId === profileId) {
          profileDoc = p;
          break;
        }
      }
    }

    if (!profileDoc) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    return this.formatPublicProfile(profileDoc);
  }
}
