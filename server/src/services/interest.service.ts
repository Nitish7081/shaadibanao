import mongoose from 'mongoose';
import { InterestModel } from '../models/interest.model';
import { MatchModel } from '../models/match.model';
import { ProfileModel } from '../models/profile.model';
import { getAcceptedUserIds } from './photoPrivacy';
import { ProfileService, inMemoryProfileStore } from './profile.service';
import { inMemoryProfileRegistry } from './search.service';
import { AppError } from '../middleware/errorHandler';
import { InterestItem, InterestStatus } from '@bandhansetu/shared';

// In-memory fallback
interface InMemoryInterest {
  id: string;
  senderId: string;
  receiverId: string;
  status: InterestStatus;
  createdAt: Date;
  updatedAt: Date;
}
export const inMemoryInterestStore: InMemoryInterest[] = [];
export const inMemoryMatchStore: any[] = [];

export class InterestService {
  private static findInMemoryProfile(profileOrUserId: string): any {
    if (inMemoryProfileStore.has(profileOrUserId)) {
      return inMemoryProfileStore.get(profileOrUserId);
    }
    for (const p of inMemoryProfileStore.values()) {
      if (p.id === profileOrUserId || p._id === profileOrUserId || p.userId === profileOrUserId) {
        return p;
      }
    }
    return inMemoryProfileRegistry.find(
      (p) => p.id === profileOrUserId || p._id === profileOrUserId || p.userId === profileOrUserId
    );
  }

  /**
   * Helper to resolve receiver's userId from profileId
   */
  private static async resolveTargetUserId(targetProfileId: string): Promise<string> {
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

    return targetProfile.userId?.toString?.() || targetProfile.userId;
  }

  /**
   * Helper to get public profile by userId
   */
  private static async getPublicProfileByUserId(userId: string, viewerId?: string) {
    const isDbConnected = mongoose.connection.readyState === 1;

    let doc: any = null;
    if (isDbConnected) {
      doc = await ProfileModel.findOne({ userId });
    } else {
      doc = this.findInMemoryProfile(userId);
    }

    if (!doc) {
      return {
        id: userId,
        displayName: 'ShaadiBanao Member',
        gender: 'female' as const,
        age: 26,
        heightCm: 160,
        maritalStatus: 'never_married',
        motherTongue: 'Hindi',
        religion: 'Hindu',
        city: 'Delhi NCR',
        state: 'Delhi',
        education: 'Graduate',
        occupation: 'Professional',
        photos: [],
        aboutMe: '',
        isVerified: false,
        photoChecked: false,
        isContactLocked: true,
      };
    }

    const acceptedUserIds = await getAcceptedUserIds(viewerId, [userId]);
    return ProfileService.formatPublicProfile(doc, { viewerId, acceptedUserIds });
  }

  /**
   * POST /api/v1/interests/:profileId (Send Interest)
   */
  public static async sendInterest(senderId: string, targetProfileId: string): Promise<InterestItem> {
    const receiverId = await this.resolveTargetUserId(targetProfileId);

    // Prevent self-interest
    if (senderId === receiverId) {
      throw new AppError('You cannot express interest in your own profile', 400, 'SELF_INTEREST_PROHIBITED');
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const existing = await InterestModel.findOne({
        senderId,
        receiverId,
      });

      if (existing) {
        throw new AppError(
          `Interest is already in '${existing.status}' status. Duplicate requests are prohibited.`,
          409,
          'DUPLICATE_INTEREST'
        );
      }

      const interest = await InterestModel.create({
        senderId,
        receiverId,
        status: 'pending',
      });

      const receiverProfile = await this.getPublicProfileByUserId(receiverId, senderId);

      return {
        id: interest._id.toString(),
        senderId,
        receiverId,
        profile: receiverProfile,
        status: 'pending',
        createdAt: interest.createdAt.toISOString(),
        updatedAt: interest.updatedAt.toISOString(),
      };
    }

    const existing = inMemoryInterestStore.find(
      (i) => i.senderId === senderId && i.receiverId === receiverId
    );
    if (existing) {
      throw new AppError(
        `Interest is already in '${existing.status}' status. Duplicate requests are prohibited.`,
        409,
        'DUPLICATE_INTEREST'
      );
    }

    const newInterest: InMemoryInterest = {
      id: `int_${Date.now()}`,
      senderId,
      receiverId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryInterestStore.push(newInterest);

    const receiverProfile = await this.getPublicProfileByUserId(receiverId, senderId);

    return {
      id: newInterest.id,
      senderId,
      receiverId,
      profile: receiverProfile,
      status: 'pending',
      createdAt: newInterest.createdAt.toISOString(),
      updatedAt: newInterest.updatedAt.toISOString(),
    };
  }

  /**
   * GET /api/v1/interests/received
   */
  public static async getReceivedInterests(receiverId: string): Promise<InterestItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let items: any[] = [];
    if (isDbConnected) {
      items = await InterestModel.find({ receiverId }).sort({ createdAt: -1 });
    } else {
      items = inMemoryInterestStore.filter((i) => i.receiverId === receiverId);
    }

    const result: InterestItem[] = [];
    for (const item of items) {
      const senderProfile = await this.getPublicProfileByUserId(item.senderId.toString(), receiverId);
      result.push({
        id: item._id?.toString() || item.id,
        senderId: item.senderId.toString(),
        receiverId: item.receiverId.toString(),
        profile: senderProfile,
        status: item.status,
        createdAt: item.createdAt.toISOString?.() || new Date(item.createdAt).toISOString(),
        updatedAt: item.updatedAt.toISOString?.() || new Date(item.updatedAt).toISOString(),
      });
    }

    return result;
  }

  /**
   * GET /api/v1/interests/sent
   */
  public static async getSentInterests(senderId: string): Promise<InterestItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let items: any[] = [];
    if (isDbConnected) {
      items = await InterestModel.find({ senderId }).sort({ createdAt: -1 });
    } else {
      items = inMemoryInterestStore.filter((i) => i.senderId === senderId);
    }

    const result: InterestItem[] = [];
    for (const item of items) {
      const receiverProfile = await this.getPublicProfileByUserId(item.receiverId.toString(), senderId);
      result.push({
        id: item._id?.toString() || item.id,
        senderId: item.senderId.toString(),
        receiverId: item.receiverId.toString(),
        profile: receiverProfile,
        status: item.status,
        createdAt: item.createdAt.toISOString?.() || new Date(item.createdAt).toISOString(),
        updatedAt: item.updatedAt.toISOString?.() || new Date(item.updatedAt).toISOString(),
      });
    }

    return result;
  }

  /**
   * PATCH /api/v1/interests/:interestId (Accept or Decline)
   */
  public static async updateInterestStatus(
    userId: string,
    interestId: string,
    newStatus: 'accepted' | 'declined'
  ): Promise<InterestItem> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let interest: any = null;

    if (isDbConnected) {
      interest = await InterestModel.findById(interestId);
    } else {
      interest = inMemoryInterestStore.find((i) => i.id === interestId);
    }

    if (!interest) {
      throw new AppError('Interest request not found', 404, 'INTEREST_NOT_FOUND');
    }

    const receiverId = interest.receiverId?.toString?.() || interest.receiverId;

    // Rule: Only the intended recipient can accept or decline!
    if (receiverId !== userId) {
      throw new AppError(
        'Unauthorized. Only the recipient of this interest can accept or decline.',
        403,
        'FORBIDDEN'
      );
    }

    if (interest.status !== 'pending') {
      throw new AppError(
        `Cannot update an interest that is already '${interest.status}'.`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    interest.status = newStatus;
    interest.updatedAt = new Date();

    if (isDbConnected) {
      await interest.save();
    }

    // If accepted: Create mutual match
    if (newStatus === 'accepted') {
      const senderId = interest.senderId?.toString?.() || interest.senderId;
      if (isDbConnected) {
        await MatchModel.create({
          user1Id: senderId,
          user2Id: receiverId,
          interestId: interest._id,
        });
      } else {
        inMemoryMatchStore.push({
          id: `match_${Date.now()}`,
          user1Id: senderId,
          user2Id: receiverId,
          interestId,
          createdAt: new Date(),
        });
      }
    }

    const senderProfile = await this.getPublicProfileByUserId(
      interest.senderId?.toString?.() || interest.senderId,
      receiverId
    );

    return {
      id: interest._id?.toString() || interest.id,
      senderId: interest.senderId.toString(),
      receiverId: interest.receiverId.toString(),
      profile: senderProfile,
      status: newStatus,
      createdAt: interest.createdAt.toISOString?.() || new Date(interest.createdAt).toISOString(),
      updatedAt: interest.updatedAt.toISOString?.() || new Date(interest.updatedAt).toISOString(),
    };
  }

  /**
   * DELETE /api/v1/interests/:interestId (Withdraw)
   */
  public static async withdrawInterest(userId: string, interestId: string): Promise<void> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let interest: any = null;

    if (isDbConnected) {
      interest = await InterestModel.findById(interestId);
    } else {
      interest = inMemoryInterestStore.find((i) => i.id === interestId);
    }

    if (!interest) {
      throw new AppError('Interest request not found', 404, 'INTEREST_NOT_FOUND');
    }

    const senderId = interest.senderId?.toString?.() || interest.senderId;

    // Rule: Only the sender can withdraw their interest
    if (senderId !== userId) {
      throw new AppError(
        'Unauthorized. Only the sender can withdraw this interest.',
        403,
        'FORBIDDEN'
      );
    }

    // Rule: Can only withdraw while status is 'pending'
    if (interest.status !== 'pending') {
      throw new AppError(
        `Cannot withdraw an interest with status '${interest.status}'.`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    interest.status = 'withdrawn';
    interest.updatedAt = new Date();

    if (isDbConnected) {
      await interest.save();
    }
  }
}
