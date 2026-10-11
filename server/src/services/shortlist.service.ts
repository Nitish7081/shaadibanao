import mongoose from 'mongoose';
import { ShortlistModel } from '../models/shortlist.model';
import { ProfileModel } from '../models/profile.model';
import { ProfileService, inMemoryProfileStore } from './profile.service';
import { inMemoryProfileRegistry } from './search.service';
import { AppError } from '../middleware/errorHandler';
import { ShortlistItem } from '@bandhansetu/shared';

// In-memory fallback
const inMemoryShortlistStore: Array<{ id: string; userId: string; profileId: string; createdAt: Date }> = [];

export class ShortlistService {
  private static findInMemoryProfile(profileId: string): any {
    if (inMemoryProfileStore.has(profileId)) {
      return inMemoryProfileStore.get(profileId);
    }
    for (const p of inMemoryProfileStore.values()) {
      if (p.id === profileId || p._id === profileId || p.userId === profileId) {
        return p;
      }
    }
    return inMemoryProfileRegistry.find(
      (p) => p.id === profileId || p._id === profileId || p.userId === profileId
    );
  }

  /**
   * Shortlists a profile
   */
  public static async addShortlist(userId: string, targetProfileId: string): Promise<void> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let targetProfile: any = null;

    if (isDbConnected) {
      if (mongoose.Types.ObjectId.isValid(targetProfileId)) {
        targetProfile = await ProfileModel.findOne({
          $or: [{ _id: targetProfileId }, { userId: targetProfileId }],
        });
      } else {
        targetProfile = await ProfileModel.findOne({ userId: targetProfileId });
      }
    } else {
      targetProfile = this.findInMemoryProfile(targetProfileId);
    }

    if (!targetProfile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    const resolvedProfileUserId = targetProfile.userId?.toString?.() || targetProfile.userId;

    // Prevent shortlisting oneself
    if (resolvedProfileUserId === userId) {
      throw new AppError('You cannot shortlist your own profile', 400, 'SELF_SHORTLIST_PROHIBITED');
    }

    if (isDbConnected) {
      const existing = await ShortlistModel.findOne({
        userId,
        profileId: targetProfile._id,
      });

      if (existing) {
        throw new AppError('Profile is already shortlisted', 409, 'ALREADY_SHORTLISTED');
      }

      await ShortlistModel.create({
        userId,
        profileId: targetProfile._id,
      });
    } else {
      const existing = inMemoryShortlistStore.find(
        (s) => s.userId === userId && s.profileId === targetProfileId
      );
      if (existing) {
        throw new AppError('Profile is already shortlisted', 409, 'ALREADY_SHORTLISTED');
      }
      inMemoryShortlistStore.push({
        id: `sl_${Date.now()}`,
        userId,
        profileId: targetProfileId,
        createdAt: new Date(),
      });
    }
  }

  /**
   * Removes a profile from shortlist
   */
  public static async removeShortlist(userId: string, targetProfileId: string): Promise<void> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      await ShortlistModel.deleteOne({
        userId,
        $or: [{ profileId: targetProfileId }],
      });
    } else {
      const idx = inMemoryShortlistStore.findIndex(
        (s) => s.userId === userId && s.profileId === targetProfileId
      );
      if (idx !== -1) {
        inMemoryShortlistStore.splice(idx, 1);
      }
    }
  }

  /**
   * Retrieves all shortlisted profiles for user
   */
  public static async getShortlists(userId: string): Promise<ShortlistItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const entries = await ShortlistModel.find({ userId }).populate('profileId');
      return entries
        .filter((e) => e.profileId)
        .map((e: any) => ({
          id: e._id.toString(),
          userId,
          profileId: e.profileId._id.toString(),
          profile: ProfileService.formatPublicProfile(e.profileId),
          createdAt: e.createdAt.toISOString(),
        }));
    }

    const entries = inMemoryShortlistStore.filter((s) => s.userId === userId);
    return entries
      .map((e) => {
        const profileDoc = this.findInMemoryProfile(e.profileId);
        if (!profileDoc) return null;
        return {
          id: e.id,
          userId,
          profileId: e.profileId,
          profile: ProfileService.formatPublicProfile(profileDoc),
          createdAt: e.createdAt.toISOString(),
        };
      })
      .filter(Boolean) as ShortlistItem[];
  }
}
