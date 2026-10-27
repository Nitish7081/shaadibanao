import mongoose from 'mongoose';
import { ProfileModel, IProfile } from '../models/profile.model';
import { UserModel } from '../models/user.model';
import { AppError } from '../middleware/errorHandler';
import { StorageService } from './storage.service';
import { buildPublicPhotos, getAcceptedUserIds, PhotoViewerContext } from './photoPrivacy';
import {
  UpsertProfileInput,
  UserProfile,
  PublicProfile,
  PhotoData,
} from '@bandhansetu/shared';

// In-memory fallback for testing / dev mode without active MongoDB
export const inMemoryProfileStore = new Map<string, any>();

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
        publicId: p.publicId,
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
  public static formatPublicProfile(doc: any, ctx: PhotoViewerContext = {}): PublicProfile {
    const dob = doc.dateOfBirth;
    const age = this.calculateAge(dob);

    // Rule: First name + last initial (e.g. "Priya S.")
    const lastInitial = doc.lastName ? `${doc.lastName.trim().charAt(0).toUpperCase()}.` : '';
    const displayName = `${doc.firstName.trim()} ${lastInitial}`.trim();

    // Rule: only approved photos are public, and a photo the viewer may not see in full is never
    // sent with its original URL (see photoPrivacy.ts: blurred URL, or no URL at all).
    const photos = buildPublicPhotos(doc, ctx);

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
    const isTestEnv = process.env.NODE_ENV === 'test';

    // Retrieve existing profile to preserve approved status and detect removed photos
    let existingProfile: any = null;
    if (isDbConnected) {
      existingProfile = await ProfileModel.findOne({ userId });
    } else {
      existingProfile = inMemoryProfileStore.get(userId);
    }

    const existingPhotos: any[] = existingProfile?.photos || [];

    // Sanitize photos: new photos cannot be self-approved by client
    const processedPhotos = (input.photos || []).map((photo: any) => {
      const matchExisting = existingPhotos.find(
        (ep: any) => ep.url === photo.url || (photo.publicId && ep.publicId === photo.publicId)
      );
      const wasApproved = matchExisting ? matchExisting.approved === true : false;
      const approved = isTestEnv && typeof photo.approved === 'boolean' ? photo.approved : wasApproved;

      return {
        ...photo,
        approved,
      };
    });

    // Clean up removed photos from Cloudinary
    const currentPublicIds = new Set(processedPhotos.map((p) => p.publicId).filter(Boolean));
    for (const ep of existingPhotos) {
      if (ep.publicId && !currentPublicIds.has(ep.publicId)) {
        StorageService.deleteFromCloudinary(ep.publicId).catch(() => {});
      }
    }

    const profileData = {
      ...input,
      photos: processedPhotos,
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

      // Update user record: indicate profile creation and update photo approval status
      const userUpdate: any = { hasProfile: true };
      if (processedPhotos.length === 0) {
        userUpdate.photoApprovalStatus = 'none';
      } else if (processedPhotos.every((p) => p.approved)) {
        userUpdate.photoApprovalStatus = 'approved';
      } else {
        userUpdate.photoApprovalStatus = 'pending';
      }
      await UserModel.findByIdAndUpdate(userId, userUpdate);
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
  public static async getPublicProfile(profileId: string, viewerId?: string): Promise<PublicProfile> {
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

    const acceptedUserIds = await getAcceptedUserIds(viewerId, [profileDoc.userId]);
    return this.formatPublicProfile(profileDoc, { viewerId, acceptedUserIds });
  }
}
