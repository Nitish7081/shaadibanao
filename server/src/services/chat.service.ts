import mongoose, { Types } from 'mongoose';
import { ConversationModel, IConversation } from '../models/conversation.model';
import { MessageModel, IMessage } from '../models/message.model';
import { MatchModel } from '../models/match.model';
import { ProfileModel } from '../models/profile.model';
import { UserModel } from '../models/user.model';
import { PanditModel } from '../models/pandit.model';
import { BookingModel } from '../models/booking.model';
import { PanditChatEntitlementModel } from '../models/pandit-chat-entitlement.model';
import { SystemSettingsModel } from '../models/system-settings.model';
import { AuditLogModel } from '../models/audit-log.model';
import { MembershipService } from './membership.service';
import { PanditService } from './pandit.service';
import { PushNotificationService } from './push-notification.service';
import { getAcceptedUserIds } from './photoPrivacy';
import { ProfileService, inMemoryProfileStore } from './profile.service';
import { inMemoryProfileRegistry } from './search.service';
import { inMemoryMatchStore } from './interest.service';
import { SocketService } from '../socket/socket.service';
import { AppError } from '../middleware/errorHandler';
import {
  ConversationItem,
  ChatMessage,
  PaginatedResponse,
  ContactExchangeDetails,
} from '@bandhansetu/shared';

// In-Memory Fallback Stores for testing and offline development
export interface InMemoryConversation {
  id: string;
  matchId?: string;
  category?: 'matrimonial' | 'pandit_consultation' | 'booking_consultation';
  participantPairKey?: string;
  panditId?: string;
  bookingId?: string;
  user1Id: string;
  user2Id: string;
  contactExchange: {
    status: 'none' | 'requested' | 'accepted' | 'declined';
    requestedBy?: string;
    updatedAt?: Date;
  };
  isFreeChat?: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  attachmentUrl?: string;
  isFreeChat?: boolean;
  planTier?: string;
  status: 'sent' | 'delivered' | 'read';
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const inMemoryConversationStore: InMemoryConversation[] = [];
export const inMemoryMessageStore: InMemoryMessage[] = [];

export class ChatService {
  /**
   * Helper to resolve target user's userId from profileId or userId
   */
  private static async resolveUserId(targetId: string): Promise<string> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        const profile = await ProfileModel.findOne({
          $or: [{ _id: targetId }, { userId: targetId }],
        });
        if (profile) {
          return profile.userId.toString();
        }
      }
      return targetId;
    }

    if (inMemoryProfileStore.has(targetId)) {
      const p = inMemoryProfileStore.get(targetId);
      return p.userId || p.id;
    }

    for (const p of inMemoryProfileStore.values()) {
      if (p.id === targetId || p._id === targetId || p.userId === targetId) {
        return p.userId || p.id;
      }
    }

    const fromRegistry = inMemoryProfileRegistry.find(
      (p) => p.id === targetId || p._id === targetId || p.userId === targetId
    );
    if (fromRegistry) {
      return fromRegistry.userId || fromRegistry.id;
    }

    return targetId;
  }

  /**
   * Helper to resolve a user's verified gender
   */
  public static async resolveUserGender(userId: string): Promise<'female' | 'male' | 'other'> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(userId)) {
      const profile = (await ProfileModel.findOne({ userId }).select('gender').lean()) as any;
      if (profile?.gender) return String(profile.gender).toLowerCase() as 'female' | 'male' | 'other';
      const userDoc = (await UserModel.findById(userId).select('gender').lean()) as any;
      if (userDoc?.gender) return String(userDoc.gender).toLowerCase() as 'female' | 'male' | 'other';
    }

    if (inMemoryProfileStore.has(userId)) {
      const p = inMemoryProfileStore.get(userId);
      if (p.gender) return String(p.gender).toLowerCase() as 'female' | 'male' | 'other';
    }

    for (const p of inMemoryProfileStore.values()) {
      if (p.userId === userId || p.id === userId || p._id === userId) {
        if (p.gender) return String(p.gender).toLowerCase() as 'female' | 'male' | 'other';
      }
    }

    return 'male';
  }

  /**
   * Atomically reserve 1 free introductory message slot for (userId, panditId).
   * Prevents duplicate free intro messages from parallel requests or multiple devices.
   */
  private static async consumePanditFreeIntroSlot(
    userId: string,
    panditId: mongoose.Types.ObjectId | string,
    freeLimit: number
  ): Promise<boolean> {
    if (freeLimit <= 0) return false;
    const now = new Date();

    const updated = await PanditChatEntitlementModel.findOneAndUpdate(
      {
        userId,
        panditId,
        freeMessagesUsed: { $lt: freeLimit },
      },
      {
        $inc: { freeMessagesUsed: 1 },
        $set: {
          freeLimitSnapshot: freeLimit,
          lastFreeMessageAt: now,
        },
      },
      { new: true }
    );
    if (updated) return true;

    const existing = await PanditChatEntitlementModel.findOne({ userId, panditId }).lean();
    if (existing) {
      return false;
    }

    try {
      await PanditChatEntitlementModel.create({
        userId,
        panditId,
        freeMessagesUsed: 1,
        freeLimitSnapshot: freeLimit,
        lastFreeMessageAt: now,
      });
      return true;
    } catch (err: any) {
      if (err?.code === 11000) {
        const retried = await PanditChatEntitlementModel.findOneAndUpdate(
          {
            userId,
            panditId,
            freeMessagesUsed: { $lt: freeLimit },
          },
          {
            $inc: { freeMessagesUsed: 1 },
            $set: {
              freeLimitSnapshot: freeLimit,
              lastFreeMessageAt: now,
            },
          },
          { new: true }
        );
        return Boolean(retried);
      }
      throw err;
    }
  }

  /**
   * Check whether chat between sender and receiver is eligible across the 3 permission categories:
   * 1. booking_consultation (confirmed/paid booking communication - never blocked by matrimonial plan)
   * 2. pandit_consultation (1 free intro message per user+pandit pair, then subscription or consultation payment)
   * 3. matrimonial (Female->Male free, Male 1 free message then Plus/Premium required)
   */
  public static async checkChatEligibility(
    senderId: string,
    receiverId: string,
    conversationId?: string,
    options?: { consumePanditFreeSlot?: boolean }
  ): Promise<{
    allowed: boolean;
    isFree: boolean;
    reason?: string;
    category?: 'matrimonial' | 'pandit_consultation' | 'booking_consultation';
    senderGender: string;
    receiverGender: string;
    planId?: string;
    entitlement?: any;
  }> {
    const isDbConnected = mongoose.connection.readyState === 1;

    // 0. Account Block Check (Applies across all chat categories)
    if (isDbConnected && mongoose.Types.ObjectId.isValid(senderId)) {
      const user = (await UserModel.findById(senderId).select('isChatBlocked chatBlockReason status').lean()) as any;
      if (user?.isChatBlocked || user?.status === 'suspended') {
        throw new AppError(
          user?.chatBlockReason || 'Your messaging privileges have been suspended due to community guidelines violations.',
          403,
          'ACCOUNT_CHAT_BLOCKED'
        );
      }
    }

    const conv =
      isDbConnected && conversationId && mongoose.Types.ObjectId.isValid(conversationId)
        ? ((await ConversationModel.findById(conversationId).lean()) as any)
        : null;

    // 1. Booking Consultation Category (Paid/Active booking communication - never blocked by matrimonial sub)
    if (conv?.category === 'booking_consultation' && conv.bookingId && isDbConnected) {
      const booking = (await BookingModel.findById(conv.bookingId).lean()) as any;
      if (!booking || ['cancelled', 'declined'].includes(booking.status)) {
        throw new AppError(
          'Booking consultation communication is closed because the booking is cancelled or declined.',
          403,
          'BOOKING_CHAT_UNAVAILABLE'
        );
      }
      const pandit = booking.panditId
        ? ((await PanditModel.findById(booking.panditId).select('userId').lean()) as any)
        : null;
      const isParticipant =
        booking.userId.toString() === senderId ||
        (pandit?.userId && pandit.userId.toString() === senderId);
      if (!isParticipant) {
        throw new AppError('Unauthorized for this booking consultation.', 403, 'FORBIDDEN');
      }
      return {
        allowed: true,
        isFree: booking.paymentStatus !== 'paid',
        reason: 'BOOKING_CONSULTATION_CHAT',
        category: 'booking_consultation',
        senderGender: 'other',
        receiverGender: 'other',
      };
    }

    // 2. Pandit Personal Consultation Category
    let targetPandit: any = null;
    if (isDbConnected && conv?.category !== 'matrimonial') {
      if (conv?.category === 'pandit_consultation' && conv.panditId) {
        targetPandit = await PanditModel.findById(conv.panditId).lean();
      } else if (mongoose.Types.ObjectId.isValid(senderId) && mongoose.Types.ObjectId.isValid(receiverId)) {
        const matchExists = await MatchModel.exists({
          $or: [
            { user1Id: senderId, user2Id: receiverId },
            { user1Id: receiverId, user2Id: senderId },
          ],
        });
        if (!matchExists) {
          targetPandit = await PanditModel.findOne({
            userId: { $in: [senderId, receiverId] },
            verificationStatus: { $in: ['approved', 'verified'] },
            isActive: { $ne: false },
          }).lean();
        }
      }
    }

    if (targetPandit) {
      if (!['approved', 'verified'].includes(targetPandit.verificationStatus) || targetPandit.isActive === false) {
        throw new AppError('This Pandit is not currently active or approved for consultations.', 403, 'PANDIT_UNAVAILABLE');
      }

      const senderGender = await this.resolveUserGender(senderId);
      const receiverGender = await this.resolveUserGender(receiverId);

      // Pandit replying in existing consultation chat is permitted unless chat was disabled
      if (targetPandit.userId && targetPandit.userId.toString() === senderId) {
        return {
          allowed: true,
          isFree: true,
          reason: 'PANDIT_REPLY_ALLOWED',
          category: 'pandit_consultation',
          senderGender,
          receiverGender,
        };
      }

      if (targetPandit.isChatAvailable === false) {
        throw new AppError('This Pandit has paused personal consultation chat right now.', 403, 'PANDIT_CHAT_DISABLED');
      }

      const ent = await PanditService.getPanditChatEligibility(senderId, targetPandit._id.toString());

      if (ent.paidAccessActive) {
        return {
          allowed: true,
          isFree: !ent.hasActiveSubscription && !ent.hasPaidBooking,
          reason: ent.reason,
          category: 'pandit_consultation',
          planId: ent.hasActiveSubscription ? 'plus' : 'pandit_paid',
          entitlement: ent,
          senderGender,
          receiverGender,
        };
      }

      if (ent.freeChatEnabled && ent.freeRemaining > 0) {
        if (options?.consumePanditFreeSlot) {
          const consumed = await this.consumePanditFreeIntroSlot(
            senderId,
            targetPandit._id,
            ent.freeMessageLimit
          );
          if (!consumed) {
            return {
              allowed: false,
              isFree: false,
              reason: 'PANDIT_CHAT_PAYMENT_REQUIRED',
              category: 'pandit_consultation',
              entitlement: { ...ent, freeRemaining: 0, requiresPayment: true },
              senderGender,
              receiverGender,
            };
          }
          return {
            allowed: true,
            isFree: true,
            reason: 'PANDIT_FREE_INTRO_CHAT',
            category: 'pandit_consultation',
            entitlement: {
              ...ent,
              freeMessagesUsed: ent.freeMessagesUsed + 1,
              freeRemaining: Math.max(0, ent.freeRemaining - 1),
            },
            senderGender,
            receiverGender,
          };
        }

        return {
          allowed: true,
          isFree: true,
          reason: 'PANDIT_FREE_INTRO_CHAT',
          category: 'pandit_consultation',
          entitlement: ent,
          senderGender,
          receiverGender,
        };
      }

      return {
        allowed: false,
        isFree: false,
        reason: 'PANDIT_CHAT_PAYMENT_REQUIRED',
        category: 'pandit_consultation',
        entitlement: ent,
        senderGender,
        receiverGender,
      };
    }

    const senderGender = await this.resolveUserGender(senderId);
    const receiverGender = await this.resolveUserGender(receiverId);

    // 2. Fetch system settings
    let femaleFreeChatEnabled = true;
    let malePaidChatRequired = true;
    let maleFreeReplyToFemale = true;
    let maleFreeMessageLimit = 1;

    if (isDbConnected) {
      try {
        const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
        if (settings) {
          femaleFreeChatEnabled = settings.femaleFreeChatEnabled !== false;
          malePaidChatRequired = settings.malePaidChatRequired !== false;
          maleFreeReplyToFemale = settings.maleFreeReplyToFemale !== false;
          maleFreeMessageLimit =
            typeof settings.maleFreeMessageLimit === 'number' ? settings.maleFreeMessageLimit : 1;
        }
      } catch {
        // Defaults
      }
    }

    // 3. Female sender rule: Free chat!
    if (senderGender === 'female' && femaleFreeChatEnabled) {
      return {
        allowed: true,
        isFree: true,
        reason: 'FEMALE_FREE_CHAT',
        senderGender,
        receiverGender,
      };
    }

    // 4. Male sender rule: Plan check (Free plan allows ONLY a single free message; subsequent messages require Plus/Premium)
    if (senderGender === 'male') {
      if (!malePaidChatRequired) {
        return {
          allowed: true,
          isFree: true,
          reason: 'PAID_GATE_DISABLED',
          senderGender,
          receiverGender,
        };
      }

      // Check membership
      const membership = await MembershipService.getUserMembership(senderId);
      const isPaid = membership.planId === 'plus' || membership.planId === 'premium';
      const isActive = membership.status === 'active';
      let isNotExpired = true;
      if (membership.expiresAt) {
        const expTime = new Date(membership.expiresAt).getTime();
        if (!isNaN(expTime) && expTime <= Date.now()) {
          isNotExpired = false;
        }
      }

      if (isPaid && isActive && isNotExpired) {
        return {
          allowed: true,
          isFree: false,
          planId: membership.planId,
          senderGender,
          receiverGender,
        };
      }

      // Count prior matrimonial messages sent by this male user (excluding Pandit/booking consultations)
      let sentCount = 0;
      if (isDbConnected) {
        try {
          const panditConvs = await ConversationModel.find({
            $or: [{ user1Id: senderId }, { user2Id: senderId }],
            category: { $in: ['pandit_consultation', 'booking_consultation'] },
          })
            .select('_id')
            .lean();
          const panditConvIds = panditConvs.map((c: any) => c._id);

          const panditDocs = await PanditModel.find({
            verificationStatus: { $in: ['approved', 'verified'] },
          })
            .select('userId')
            .lean();
          const panditUserIds = panditDocs.map((p: any) => p.userId).filter(Boolean);
          const countFilter: any = { senderId };
          if (panditUserIds.length > 0) {
            countFilter.receiverId = { $nin: panditUserIds };
          }
          if (panditConvIds.length > 0) {
            countFilter.conversationId = { $nin: panditConvIds };
          }
          sentCount = await MessageModel.countDocuments(countFilter);
        } catch {
          sentCount = await MessageModel.countDocuments({ senderId });
        }
      } else {
        sentCount = inMemoryMessageStore.filter((m) => m.senderId === senderId).length;
      }

      // Enforce single-message free-plan allowance when maleFreeMessageLimit > 0
      if (maleFreeMessageLimit > 0) {
        if (sentCount < maleFreeMessageLimit) {
          return {
            allowed: true,
            isFree: true,
            reason: 'MALE_FREE_TRIAL',
            senderGender,
            receiverGender,
          };
        }

        return {
          allowed: false,
          isFree: false,
          reason: 'MALE_PLAN_REQUIRED',
          senderGender,
          receiverGender,
        };
      }

      // When maleFreeMessageLimit is explicitly 0, allow at most 1 free reply if female initiated and male hasn't sent yet
      if (isDbConnected && maleFreeReplyToFemale && receiverGender === 'female' && sentCount < 1) {
        try {
          const targetConvId =
            conversationId ||
            (
              await ConversationModel.findOne({
                $or: [
                  { user1Id: senderId, user2Id: receiverId },
                  { user1Id: receiverId, user2Id: senderId },
                ],
              }).select('_id')
            )?._id;

          if (targetConvId) {
            const hasFemaleMessage = await MessageModel.exists({
              conversationId: targetConvId,
              senderId: receiverId,
            });
            if (hasFemaleMessage) {
              return {
                allowed: true,
                isFree: true,
                reason: 'MALE_REPLY_TO_FEMALE_ALLOWED',
                senderGender,
                receiverGender,
              };
            }
          }
        } catch {
          // continue to plan required
        }
      }

      return {
        allowed: false,
        isFree: false,
        reason: 'MALE_PLAN_REQUIRED',
        senderGender,
        receiverGender,
      };
    }

    return {
      allowed: true,
      isFree: true,
      senderGender,
      receiverGender,
    };
  }

  /**
   * Helper to get public profile by userId
   */
  private static async getPublicProfileByUserId(userId: string, viewerId?: string) {
    const isDbConnected = mongoose.connection.readyState === 1;
    const ctx = { viewerId, acceptedUserIds: await getAcceptedUserIds(viewerId, [userId]) };

    if (isDbConnected) {
      const doc = await ProfileModel.findOne({ userId });
      if (doc) {
        return ProfileService.formatPublicProfile(doc, ctx);
      }

      if (mongoose.Types.ObjectId.isValid(userId)) {
        const panditDoc = (await PanditModel.findOne({ userId })
          .select('name profilePhoto bio city state verificationStatus isOnline')
          .lean()) as any;
        if (panditDoc) {
          return {
            id: userId,
            displayName: panditDoc.name || 'Acharya Ji',
            gender: 'male' as const,
            age: 35,
            heightCm: 170,
            maritalStatus: 'never_married',
            motherTongue: 'Hindi',
            religion: 'Hindu',
            city: panditDoc.city || 'Varanasi',
            state: panditDoc.state || 'UP',
            education: 'Vedic Acharya',
            occupation: 'Vedic Pandit',
            photos: panditDoc.profilePhoto
              ? [{ url: panditDoc.profilePhoto, isMain: true, isBlurred: false }]
              : [],
            aboutMe: panditDoc.bio || '',
            isVerified: ['approved', 'verified'].includes(panditDoc.verificationStatus),
            photoChecked: true,
            isContactLocked: true,
          };
        }
      }
    }

    if (inMemoryProfileStore.has(userId)) {
      return ProfileService.formatPublicProfile(inMemoryProfileStore.get(userId), ctx);
    }

    for (const p of inMemoryProfileStore.values()) {
      if (p.userId === userId || p.id === userId || p._id === userId) {
        return ProfileService.formatPublicProfile(p, ctx);
      }
    }

    const reg = inMemoryProfileRegistry.find(
      (p) => p.userId === userId || p.id === userId || p._id === userId
    );
    if (reg) {
      return ProfileService.formatPublicProfile(reg, ctx);
    }

    // Default fallback profile representation
    return {
      id: userId,
      displayName: 'ShaadiBanao Member',
      gender: 'female' as const,
      age: 26,
      heightCm: 162,
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Delhi NCR',
      state: 'Delhi',
      education: 'Graduate',
      occupation: 'Professional',
      photos: [],
      aboutMe: '',
      isVerified: true,
      photoChecked: true,
      isContactLocked: true,
    };
  }

  /**
   * Checks whether a user is an authorized participant in a conversation
   */
  public static async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return false;
      const conv = await ConversationModel.findById(conversationId);
      if (!conv) return false;
      return (
        conv.user1Id.toString() === userId || conv.user2Id.toString() === userId
      );
    }

    const conv = inMemoryConversationStore.find((c) => c.id === conversationId);
    if (!conv) return false;
    return conv.user1Id === userId || conv.user2Id === userId;
  }

  /**
   * GET /api/v1/conversations
   * Retrieves all conversations for the user using batch aggregation + Hash Maps (O(1) DB round-trips)
   */
  public static async getConversations(userId: string): Promise<ConversationItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let convDocs: any[] = [];

    if (isDbConnected) {
      convDocs = await ConversationModel.find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
      })
        .sort({ lastMessageAt: -1 })
        .lean();
    } else {
      convDocs = inMemoryConversationStore
        .filter((c) => c.user1Id === userId || c.user2Id === userId)
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    }

    if (convDocs.length === 0) {
      return [];
    }

    // Batch fetch in DB mode instead of O(N) sequential queries
    const lastMsgMap = new Map<string, any>();
    const unreadMap = new Map<string, number>();
    const profileMap = new Map<string, any>();
    const panditMap = new Map<string, any>();
    const userMobileMap = new Map<string, string>();
    let acceptedUserIds = new Set<string>();

    if (isDbConnected) {
      const convIds = convDocs.map((c) => c._id);
      const partnerIdSet = new Set<string>();
      const acceptedContactPartnerSet = new Set<string>();

      for (const c of convDocs) {
        const u1 = c.user1Id?.toString();
        const u2 = c.user2Id?.toString();
        const partnerId = u1 === userId ? u2 : u1;
        if (partnerId) {
          partnerIdSet.add(partnerId);
          if (c.contactExchange?.status === 'accepted') {
            acceptedContactPartnerSet.add(partnerId);
          }
        }
      }

      const partnerIds = Array.from(partnerIdSet);
      const partnerObjectIds = partnerIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      const acceptedPartnerObjIds = Array.from(acceptedContactPartnerSet)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      const userObjOrStr = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

      const [lastMsgAgg, unreadAgg, profiles, pandits, acceptedUsers, acceptedSet] = await Promise.all([
        MessageModel.aggregate([
          { $match: { conversationId: { $in: convIds } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$conversationId', doc: { $first: '$$ROOT' } } },
        ]),
        MessageModel.aggregate([
          {
            $match: {
              conversationId: { $in: convIds },
              receiverId: userObjOrStr,
              status: { $ne: 'read' },
            },
          },
          { $group: { _id: '$conversationId', count: { $sum: 1 } } },
        ]),
        partnerObjectIds.length > 0
          ? ProfileModel.find({ userId: { $in: partnerObjectIds } }).lean()
          : Promise.resolve([]),
        partnerObjectIds.length > 0
          ? PanditModel.find({ userId: { $in: partnerObjectIds } })
              .select('userId name profilePhoto bio city state verificationStatus isOnline')
              .lean()
          : Promise.resolve([]),
        acceptedPartnerObjIds.length > 0
          ? UserModel.find({ _id: { $in: acceptedPartnerObjIds } }).select('mobile').lean()
          : Promise.resolve([]),
        getAcceptedUserIds(userId, partnerIds),
      ]);

      for (const row of lastMsgAgg as any[]) {
        lastMsgMap.set(row._id.toString(), row.doc);
      }
      for (const row of unreadAgg as any[]) {
        unreadMap.set(row._id.toString(), row.count || 0);
      }
      for (const prof of profiles as any[]) {
        if (prof.userId) profileMap.set(prof.userId.toString(), prof);
      }
      for (const pnd of pandits as any[]) {
        if (pnd.userId) panditMap.set(pnd.userId.toString(), pnd);
      }
      for (const u of acceptedUsers as any[]) {
        if (u._id && u.mobile) userMobileMap.set(u._id.toString(), u.mobile);
      }
      acceptedUserIds = acceptedSet;
    }

    const items: ConversationItem[] = [];

    for (const conv of convDocs) {
      const convId = conv._id?.toString() || conv.id;
      const user1 = conv.user1Id?.toString() || conv.user1Id;
      const user2 = conv.user2Id?.toString() || conv.user2Id;
      const partnerId = user1 === userId ? user2 : user1;

      let participant: any;
      if (isDbConnected) {
        const profDoc = profileMap.get(partnerId);
        if (profDoc) {
          participant = ProfileService.formatPublicProfile(profDoc, {
            viewerId: userId,
            acceptedUserIds,
          });
        } else {
          const pndDoc = panditMap.get(partnerId);
          if (pndDoc) {
            participant = {
              id: partnerId,
              displayName: pndDoc.name || 'Acharya Ji',
              gender: 'male' as const,
              age: 35,
              heightCm: 170,
              maritalStatus: 'never_married',
              motherTongue: 'Hindi',
              religion: 'Hindu',
              city: pndDoc.city || 'Varanasi',
              state: pndDoc.state || 'UP',
              education: 'Vedic Acharya',
              occupation: 'Vedic Pandit',
              photos: pndDoc.profilePhoto
                ? [{ url: pndDoc.profilePhoto, isMain: true, isBlurred: false }]
                : [],
              aboutMe: pndDoc.bio || '',
              isVerified: ['approved', 'verified'].includes(pndDoc.verificationStatus),
              photoChecked: true,
              isContactLocked: true,
            };
          } else {
            participant = await this.getPublicProfileByUserId(partnerId, userId);
          }
        }
      } else {
        participant = await this.getPublicProfileByUserId(partnerId, userId);
      }

      // Fetch last message & unread count from O(1) Maps in DB mode
      let lastMsg: any = null;
      let unreadCount = 0;

      if (isDbConnected) {
        lastMsg = lastMsgMap.get(convId) || null;
        unreadCount = unreadMap.get(convId) || 0;
      } else {
        const msgs = inMemoryMessageStore
          .filter((m) => m.conversationId === convId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        lastMsg = msgs[0];
        unreadCount = msgs.filter(
          (m) => m.receiverId === userId && m.status !== 'read'
        ).length;
      }

      // Check contact exchange details
      const exchangeStatus = conv.contactExchange?.status || 'none';
      const contactExchange: ContactExchangeDetails = {
        status: exchangeStatus,
        requestedBy: conv.contactExchange?.requestedBy?.toString(),
      };

      if (exchangeStatus === 'accepted') {
        if (isDbConnected) {
          const mob = userMobileMap.get(partnerId);
          if (mob) {
            contactExchange.phone = `+91 ${mob}`;
          }
        } else {
          contactExchange.phone = '+91 9811100002';
          contactExchange.email = 'partner@shaadibanao.in';
        }
      }

      let entitlement: any = undefined;
      if (isDbConnected && conv.category === 'pandit_consultation' && conv.panditId) {
        try {
          const pndObj = panditMap.get(partnerId);
          const panditUserStr = pndObj?.userId?.toString();
          const devoteeId = panditUserStr && panditUserStr === user1 ? user2 : user1;
          entitlement = await PanditService.getPanditChatEligibility(
            devoteeId,
            conv.panditId.toString()
          );
        } catch {
          // Non-blocking
        }
      }

      items.push({
        id: convId,
        matchId: conv.matchId?.toString() || conv.matchId,
        category: conv.category || 'matrimonial',
        panditId: conv.panditId?.toString() || conv.panditId,
        bookingId: conv.bookingId?.toString() || conv.bookingId,
        participant,
        lastMessage: lastMsg
          ? {
              id: lastMsg._id?.toString() || lastMsg.id,
              conversationId: convId,
              senderId: lastMsg.senderId?.toString() || lastMsg.senderId,
              text: lastMsg.text,
              status: lastMsg.status,
              createdAt:
                lastMsg.createdAt?.toISOString?.() ||
                new Date(lastMsg.createdAt).toISOString(),
            }
          : undefined,
        unreadCount,
        contactExchange,
        isFreeChat: Boolean(conv.isFreeChat),
        entitlement,
        createdAt:
          conv.createdAt?.toISOString?.() || new Date(conv.createdAt).toISOString(),
        updatedAt:
          conv.updatedAt?.toISOString?.() || new Date(conv.updatedAt).toISOString(),
      });
    }

    return items;
  }

  /**
   * POST /api/v1/conversations
   * Creates or gets conversation across separate permission categories:
   * - matrimonial (Mutual Match or Female-to-Male Free Chat)
   * - pandit_consultation (User <-> Approved & Active Pandit, deduplicated per user+pandit)
   * - booking_consultation (Authorized booking owner <-> Assigned Pandit, independent of matrimonial plan)
   */
  public static async getOrCreateConversation(
    userId: string,
    participantId: string,
    options?: {
      category?: 'matrimonial' | 'pandit_consultation' | 'booking_consultation';
      panditId?: string;
      bookingId?: string;
    }
  ): Promise<ConversationItem> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const requestedCategory = options?.category;

    // CATEGORY A: Booking Consultation Communication
    if ((requestedCategory === 'booking_consultation' || options?.bookingId) && isDbConnected) {
      if (!options?.bookingId || !mongoose.Types.ObjectId.isValid(options.bookingId)) {
        throw new AppError('Valid bookingId is required for booking consultation chat.', 400, 'INVALID_BOOKING_ID');
      }
      const booking = (await BookingModel.findById(options.bookingId).lean()) as any;
      if (!booking) {
        throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
      }
      if (['cancelled', 'declined'].includes(booking.status)) {
        throw new AppError('Cannot open consultation chat for a cancelled or declined booking.', 403, 'BOOKING_CHAT_UNAVAILABLE');
      }
      if (!booking.panditId) {
        throw new AppError('A Pandit has not been assigned to this booking yet.', 400, 'PANDIT_NOT_ASSIGNED');
      }
      const pandit = (await PanditModel.findById(booking.panditId).lean()) as any;
      if (!pandit || !['approved', 'verified'].includes(pandit.verificationStatus) || pandit.isActive === false) {
        throw new AppError('Assigned Pandit is currently unavailable.', 403, 'PANDIT_UNAVAILABLE');
      }

      const devoteeId = booking.userId.toString();
      const panditUserId = pandit.userId.toString();
      if (userId !== devoteeId && userId !== panditUserId) {
        throw new AppError('You are not an authorized participant for this booking.', 403, 'FORBIDDEN');
      }

      const canOpenBookingChat =
        booking.paymentStatus === 'paid' ||
        ['assigned', 'accepted', 'confirmed', 'in_progress', 'completed'].includes(booking.status);
      if (!canOpenBookingChat) {
        throw new AppError(
          'Booking consultation chat becomes active once payment is verified or the booking is confirmed.',
          402,
          'BOOKING_PAYMENT_REQUIRED'
        );
      }

      const pairKey = `booking_consultation:${booking._id.toString()}`;
      let conv = await ConversationModel.findOne({ participantPairKey: pairKey });
      if (!conv) {
        try {
          conv = await ConversationModel.findOneAndUpdate(
            { participantPairKey: pairKey },
            {
              $setOnInsert: {
                category: 'booking_consultation',
                participantPairKey: pairKey,
                panditId: pandit._id,
                bookingId: booking._id,
                user1Id: devoteeId,
                user2Id: panditUserId,
                contactExchange: { status: 'none' },
                isFreeChat: true,
                lastMessageAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
        } catch (err: any) {
          if (err?.code === 11000) {
            conv = await ConversationModel.findOne({ participantPairKey: pairKey });
          } else {
            throw err;
          }
        }
      }

      const partnerId = userId === devoteeId ? panditUserId : devoteeId;
      const participant = await this.getPublicProfileByUserId(partnerId, userId);
      return {
        id: conv._id.toString(),
        matchId: `booking_${booking._id.toString()}`,
        category: 'booking_consultation',
        panditId: pandit._id.toString(),
        bookingId: booking._id.toString(),
        participant,
        unreadCount: 0,
        contactExchange: { status: conv.contactExchange?.status || 'none' },
        isFreeChat: true,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      };
    }

    // CATEGORY B: Pandit Personal Consultation
    let resolvedPandit: any = null;
    if (isDbConnected && requestedCategory !== 'matrimonial') {
      if (requestedCategory === 'pandit_consultation' || options?.panditId) {
        resolvedPandit = await PanditService.findApprovedPanditOrThrow(options?.panditId || participantId);
      } else {
        // Check if participantId itself is a Pandit _id / panditId, or an approved Pandit userId with no mutual match
        const byPanditRef = (
          mongoose.Types.ObjectId.isValid(participantId)
            ? await PanditModel.findById(participantId).lean()
            : await PanditModel.findOne({ panditId: participantId }).lean()
        ) as any;
        if (byPanditRef) {
          resolvedPandit = await PanditService.findApprovedPanditOrThrow(byPanditRef._id.toString());
        } else if (mongoose.Types.ObjectId.isValid(participantId)) {
          const panditByUser = (await PanditModel.findOne({
            userId: participantId,
            verificationStatus: { $in: ['approved', 'verified'] },
            isActive: { $ne: false },
          }).lean()) as any;
          if (panditByUser) {
            const hasMutualMatch = await MatchModel.exists({
              $or: [
                { user1Id: userId, user2Id: participantId },
                { user1Id: participantId, user2Id: userId },
              ],
            });
            if (!hasMutualMatch) {
              resolvedPandit = panditByUser;
            }
          }
        }
      }
    }

    if (resolvedPandit) {
      const panditUserId = resolvedPandit.userId.toString();
      if (userId === panditUserId) {
        throw new AppError('Cannot start a consultation conversation with yourself.', 400, 'SELF_CONVERSATION_PROHIBITED');
      }
      const devoteeId = userId;
      const pairKey = `pandit_consultation:${devoteeId}:${resolvedPandit._id.toString()}`;

      let conv = await ConversationModel.findOne({
        $or: [
          { participantPairKey: pairKey },
          {
            category: 'pandit_consultation',
            panditId: resolvedPandit._id,
            $or: [
              { user1Id: devoteeId, user2Id: panditUserId },
              { user1Id: panditUserId, user2Id: devoteeId },
            ],
          },
        ],
      });

      if (!conv) {
        try {
          conv = await ConversationModel.findOneAndUpdate(
            { participantPairKey: pairKey },
            {
              $setOnInsert: {
                category: 'pandit_consultation',
                participantPairKey: pairKey,
                panditId: resolvedPandit._id,
                user1Id: devoteeId,
                user2Id: panditUserId,
                contactExchange: { status: 'none' },
                isFreeChat: true,
                lastMessageAt: new Date(),
              },
            },
            { upsert: true, new: true }
          );
        } catch (err: any) {
          if (err?.code === 11000) {
            conv = await ConversationModel.findOne({ participantPairKey: pairKey });
          } else {
            throw err;
          }
        }
      }

      const entitlement = await PanditService.getPanditChatEligibility(
        devoteeId,
        resolvedPandit._id.toString()
      );
      const participant = await this.getPublicProfileByUserId(panditUserId, userId);

      return {
        id: conv._id.toString(),
        matchId: `pandit_${resolvedPandit._id.toString()}`,
        category: 'pandit_consultation',
        panditId: resolvedPandit._id.toString(),
        participant,
        unreadCount: 0,
        contactExchange: { status: conv.contactExchange?.status || 'none' },
        isFreeChat: !entitlement.paidAccessActive,
        entitlement,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      };
    }

    // CATEGORY C: Matrimonial Conversation (Existing rules preserved intact)
    const targetUserId = await this.resolveUserId(participantId);

    if (userId === targetUserId) {
      throw new AppError('Cannot start a conversation with yourself', 400, 'SELF_CONVERSATION_PROHIBITED');
    }

    // Check Genders
    const senderGender = await this.resolveUserGender(userId);
    const targetGender = await this.resolveUserGender(targetUserId);
    const isFemaleFreeChat = senderGender === 'female' && targetGender === 'male';

    // STEP 1: Return existing matrimonial conversation immediately if one already exists between the two users
    let conv: any = null;
    if (isDbConnected) {
      conv = await ConversationModel.findOne({
        $or: [{ category: 'matrimonial' }, { category: { $exists: false } }],
        $and: [
          {
            $or: [
              { user1Id: userId, user2Id: targetUserId },
              { user1Id: targetUserId, user2Id: userId },
            ],
          },
        ],
      });
    } else {
      conv = inMemoryConversationStore.find(
        (c) =>
          (!c.category || c.category === 'matrimonial') &&
          ((c.user1Id === userId && c.user2Id === targetUserId) ||
            (c.user1Id === targetUserId && c.user2Id === userId))
      );
    }

    // STEP 2: Verify valid Mutual Match (or Female-to-Male Free Chat initiation privilege) when creating new
    let matchRecord: any = null;

    if (isDbConnected) {
      matchRecord = await MatchModel.findOne({
        $or: [
          { user1Id: userId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: userId },
        ],
      });
    } else {
      matchRecord = inMemoryMatchStore.find(
        (m) =>
          (m.user1Id === userId && m.user2Id === targetUserId) ||
          (m.user1Id === targetUserId && m.user2Id === userId)
      );
    }

    if (!conv && !matchRecord && !isFemaleFreeChat) {
      throw new AppError(
        'Messaging is restricted to mutual matches. You may only start a conversation after an interest is mutually accepted.',
        403,
        'NO_MUTUAL_MATCH'
      );
    }

    const matchId = conv?.matchId?.toString() || matchRecord?._id?.toString() || matchRecord?.id || 'free_female_chat';

    // STEP 3: Create conversation if not already found
    if (!conv) {
      if (isDbConnected) {
        conv = await ConversationModel.create({
          category: 'matrimonial',
          matchId: matchRecord ? matchRecord._id : undefined,
          user1Id: userId,
          user2Id: targetUserId,
          contactExchange: { status: 'none' },
          isFreeChat: isFemaleFreeChat,
          lastMessageAt: new Date(),
        });
      } else {
        conv = {
          id: `conv_${Date.now()}`,
          category: 'matrimonial',
          matchId,
          user1Id: userId,
          user2Id: targetUserId,
          contactExchange: { status: 'none' },
          isFreeChat: isFemaleFreeChat,
          lastMessageAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryConversationStore.push(conv);
      }
    }

    const convId = conv._id?.toString() || conv.id;
    const participant = await this.getPublicProfileByUserId(targetUserId, userId);

    return {
      id: convId,
      matchId,
      category: 'matrimonial',
      participant,
      unreadCount: 0,
      contactExchange: { status: conv.contactExchange?.status || 'none' },
      isFreeChat: Boolean(conv.isFreeChat),
      createdAt: conv.createdAt?.toISOString?.() || new Date(conv.createdAt).toISOString(),
      updatedAt: conv.updatedAt?.toISOString?.() || new Date(conv.updatedAt).toISOString(),
    };
  }

  /**
   * GET /api/v1/conversations/:conversationId/messages
   * Returns paginated message history (supports both cursor `before` ISO timestamp and `page`/`limit`)
   */
  public static async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 20,
    before?: string
  ): Promise<PaginatedResponse<ChatMessage>> {
    const isMember = await this.isUserInConversation(conversationId, userId);
    if (!isMember) {
      throw new AppError('Unauthorized. You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    let items: ChatMessage[] = [];
    let totalCount = 0;

    if (isDbConnected) {
      const msgFilter: any = { conversationId };
      const parsedBefore = before ? new Date(before) : null;
      const useCursor = Boolean(parsedBefore && !isNaN(parsedBefore.getTime()));
      if (useCursor && parsedBefore) {
        msgFilter.createdAt = { $lt: parsedBefore };
      }

      const [count, docs] = await Promise.all([
        MessageModel.countDocuments({ conversationId }),
        MessageModel.find(msgFilter)
          .sort({ createdAt: -1 })
          .skip(useCursor ? 0 : (page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
      totalCount = count;

      items = docs.map((m: any) => ({
        id: m._id.toString(),
        conversationId,
        senderId: m.senderId.toString(),
        text: m.text,
        status: m.status,
        createdAt: m.createdAt?.toISOString?.() || new Date(m.createdAt).toISOString(),
      }));
    } else {
      const allMsgs = inMemoryMessageStore
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      totalCount = allMsgs.length;
      const filtered = before
        ? allMsgs.filter((m) => new Date(m.createdAt).getTime() < new Date(before).getTime())
        : allMsgs.slice((page - 1) * limit, page * limit);
      const sliced = before ? filtered.slice(0, limit) : filtered;

      items = sliced.map((m) => ({
        id: m.id,
        conversationId,
        senderId: m.senderId,
        text: m.text,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      }));
    }

    return {
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * POST /api/v1/conversations/:conversationId/messages
   * Sends a message with female-free chat vs male-paid gate enforcement
   */
  public static async sendMessage(
    userId: string,
    conversationId: string,
    text: string,
    attachmentUrl?: string
  ): Promise<ChatMessage> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let conv: any = null;

    if (isDbConnected) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new AppError('Invalid conversation ID', 400, 'INVALID_CONVERSATION_ID');
      }
      conv = await ConversationModel.findById(conversationId);
    } else {
      conv = inMemoryConversationStore.find((c) => c.id === conversationId);
    }

    if (!conv) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    const user1 = conv.user1Id?.toString() || conv.user1Id;
    const user2 = conv.user2Id?.toString() || conv.user2Id;

    if (user1 !== userId && user2 !== userId) {
      throw new AppError('Unauthorized. You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const receiverId = user1 === userId ? user2 : user1;

    // STEP 1: Verify Chat Eligibility across categories (and atomically consume free Pandit intro slot if applicable)
    const eligibility = await this.checkChatEligibility(userId, receiverId, conversationId, {
      consumePanditFreeSlot: true,
    });
    if (!eligibility.allowed) {
      if (eligibility.category === 'pandit_consultation' || eligibility.reason === 'PANDIT_CHAT_PAYMENT_REQUIRED') {
        throw new AppError(
          'Your free introductory chat with this Pandit has been used. Please subscribe to Plus/Premium or unlock personal Pandit consultation to continue chatting.',
          402,
          'PANDIT_CHAT_PAYMENT_REQUIRED'
        );
      }
      throw new AppError(
        'A paid membership plan (Plus or Premium) is required for male users to send messages. Please choose a plan to continue chatting.',
        402,
        'SUBSCRIPTION_REQUIRED'
      );
    }

    // STEP 2: Content Moderation & Length Validation
    let maxLength = 1000;
    let bannedKeywords = ['abuse', 'fraud', 'scam', 'money transfer'];

    if (isDbConnected) {
      try {
        const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
        if (settings) {
          if (settings.maxMessageLength) maxLength = settings.maxMessageLength;
          if (settings.bannedKeywords && settings.bannedKeywords.length) {
            bannedKeywords = settings.bannedKeywords;
          }
        }
      } catch {
        // Fallback
      }
    }

    if (text.length > maxLength) {
      throw new AppError(`Message exceeds maximum limit of ${maxLength} characters.`, 400, 'MESSAGE_TOO_LONG');
    }

    const cleanLower = text.toLowerCase();
    for (const kw of bannedKeywords) {
      if (cleanLower.includes(kw.toLowerCase())) {
        throw new AppError(`Message contains prohibited keyword or violation of content policy: "${kw}".`, 400, 'CONTENT_POLICY_VIOLATION');
      }
    }

    let savedMessage: ChatMessage;

    if (isDbConnected) {
      const msg = await MessageModel.create({
        conversationId,
        senderId: userId,
        receiverId,
        text,
        attachmentUrl: attachmentUrl || undefined,
        attachmentType: attachmentUrl ? 'image' : 'none',
        isFreeChat: eligibility.isFree,
        planTier: eligibility.planId,
        status: 'sent',
      });

      await ConversationModel.findByIdAndUpdate(conversationId, {
        lastMessageAt: new Date(),
      });

      savedMessage = {
        id: msg._id.toString(),
        conversationId,
        senderId: userId,
        text: msg.text,
        status: 'sent',
        isFreeChat: Boolean(msg.isFreeChat),
        planTier: msg.planTier,
        createdAt: msg.createdAt.toISOString(),
      };
    } else {
      const now = new Date();
      const newMsg: InMemoryMessage = {
        id: `msg_${Date.now()}`,
        conversationId,
        senderId: userId,
        receiverId,
        text,
        attachmentUrl,
        isFreeChat: eligibility.isFree,
        planTier: eligibility.planId,
        status: 'sent',
        createdAt: now,
        updatedAt: now,
      };

      inMemoryMessageStore.push(newMsg);
      conv.lastMessageAt = now;

      savedMessage = {
        id: newMsg.id,
        conversationId,
        senderId: userId,
        text: newMsg.text,
        status: 'sent',
        isFreeChat: Boolean(newMsg.isFreeChat),
        planTier: newMsg.planTier,
        createdAt: now.toISOString(),
      };
    }

    // STEP 3: Real-Time Socket Emission
    SocketService.emitToConversation(conversationId, 'new_message', savedMessage);
    SocketService.emitToUser(receiverId, 'new_message_notification', {
      conversationId,
      message: savedMessage,
      isFreeChat: eligibility.isFree,
    });

    // STEP 4: Push notification for offline recipient
    try {
      const senderProfile = await this.getPublicProfileByUserId(userId, receiverId);
      await PushNotificationService.sendToUser(receiverId, {
        title: senderProfile?.displayName || 'New Message',
        body: text.length > 80 ? text.slice(0, 77) + '...' : text,
        data: { conversationId, senderId: userId },
      });
    } catch {
      // Non-blocking
    }

    return savedMessage;
  }

  /**
   * PATCH /api/v1/conversations/:conversationId/read
   * Marks unread messages as read
   */
  public static async markMessagesAsRead(userId: string, conversationId: string): Promise<void> {
    const isMember = await this.isUserInConversation(conversationId, userId);
    if (!isMember) {
      throw new AppError('Unauthorized. You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      await MessageModel.updateMany(
        {
          conversationId,
          receiverId: userId,
          status: { $ne: 'read' },
        },
        {
          $set: { status: 'read', readAt: new Date() },
        }
      );
    } else {
      inMemoryMessageStore.forEach((m) => {
        if (m.conversationId === conversationId && m.receiverId === userId && m.status !== 'read') {
          m.status = 'read';
          m.readAt = new Date();
        }
      });
    }

    // Real-Time Socket Read Acknowledgment
    SocketService.emitToConversation(conversationId, 'messages_read', {
      conversationId,
      readerId: userId,
      readAt: new Date().toISOString(),
    });
  }

  /**
   * POST /api/v1/conversations/:conversationId/contact-request
   * Explicit mutual consent contact-sharing workflow
   */
  public static async handleContactExchange(
    userId: string,
    conversationId: string,
    action: 'request' | 'accept' | 'decline'
  ): Promise<ContactExchangeDetails> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let conv: any = null;

    if (isDbConnected) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new AppError('Invalid conversation ID', 400, 'INVALID_CONVERSATION_ID');
      }
      conv = await ConversationModel.findById(conversationId);
    } else {
      conv = inMemoryConversationStore.find((c) => c.id === conversationId);
    }

    if (!conv) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    const user1 = conv.user1Id?.toString() || conv.user1Id;
    const user2 = conv.user2Id?.toString() || conv.user2Id;

    if (user1 !== userId && user2 !== userId) {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const partnerId = user1 === userId ? user2 : user1;
    const currentStatus = conv.contactExchange?.status || 'none';
    const requestedBy = conv.contactExchange?.requestedBy?.toString();

    if (action === 'request') {
      if (currentStatus === 'accepted') {
        throw new AppError('Contact details have already been mutually shared', 400, 'ALREADY_ACCEPTED');
      }
      if (currentStatus === 'requested' && requestedBy === userId) {
        throw new AppError('You have already requested contact details. Waiting for partner consent.', 400, 'ALREADY_REQUESTED');
      }

      conv.contactExchange = {
        status: 'requested',
        requestedBy: isDbConnected ? new Types.ObjectId(userId) : userId,
        updatedAt: new Date(),
      };
    } else if (action === 'accept') {
      if (currentStatus !== 'requested') {
        throw new AppError('No pending contact sharing request to accept', 400, 'NO_PENDING_REQUEST');
      }
      if (requestedBy === userId) {
        throw new AppError('You cannot accept your own contact sharing request', 400, 'CANNOT_ACCEPT_OWN_REQUEST');
      }

      conv.contactExchange = {
        status: 'accepted',
        requestedBy: conv.contactExchange.requestedBy,
        updatedAt: new Date(),
      };
    } else if (action === 'decline') {
      if (currentStatus !== 'requested') {
        throw new AppError('No pending contact sharing request to decline', 400, 'NO_PENDING_REQUEST');
      }
      if (requestedBy === userId) {
        throw new AppError('You cannot decline your own contact sharing request', 400, 'CANNOT_DECLINE_OWN_REQUEST');
      }

      conv.contactExchange = {
        status: 'declined',
        requestedBy: conv.contactExchange.requestedBy,
        updatedAt: new Date(),
      };
    }

    if (isDbConnected) {
      await conv.save();
    }

    const updatedStatus = conv.contactExchange.status;
    const result: ContactExchangeDetails = {
      status: updatedStatus,
      requestedBy: conv.contactExchange.requestedBy?.toString(),
    };

    if (updatedStatus === 'accepted') {
      if (isDbConnected) {
        const partnerUser = await UserModel.findById(partnerId);
        if (partnerUser) {
          result.phone = `+91 ${partnerUser.mobile}`;
        }
      } else {
        result.phone = '+91 9811100002';
        result.email = 'partner@shaadibanao.in';
      }
    }

    SocketService.emitToConversation(conversationId, 'contact_exchange_updated', {
      conversationId,
      contactExchange: result,
    });

    return result;
  }

  /**
   * Admin: List Active Conversations & Entitlements (Section 9)
   */
  public static async listAdminConversations(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return { conversations: [], total: 0, page, limit, totalPages: 1 };
    }

    const [convs, total] = await Promise.all([
      ConversationModel.find()
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user1Id', 'displayName email mobile gender isChatBlocked')
        .populate('user2Id', 'displayName email mobile gender isChatBlocked')
        .lean(),
      ConversationModel.countDocuments(),
    ]);

    const enriched = await Promise.all(
      convs.map(async (c: any) => {
        const msgCount = await MessageModel.countDocuments({ conversationId: c._id });
        const lastMsg = (await MessageModel.findOne({ conversationId: c._id }).sort({ createdAt: -1 }).lean()) as any;

        return {
          id: c._id.toString(),
          user1: {
            id: c.user1Id?._id?.toString(),
            name: c.user1Id?.displayName || 'User 1',
            email: c.user1Id?.email,
            mobile: c.user1Id?.mobile,
            gender: c.user1Id?.gender,
            isChatBlocked: Boolean(c.user1Id?.isChatBlocked),
          },
          user2: {
            id: c.user2Id?._id?.toString(),
            name: c.user2Id?.displayName || 'User 2',
            email: c.user2Id?.email,
            mobile: c.user2Id?.mobile,
            gender: c.user2Id?.gender,
            isChatBlocked: Boolean(c.user2Id?.isChatBlocked),
          },
          messageCount: msgCount,
          isFreeChat: Boolean(c.isFreeChat),
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: lastMsg?.text ? lastMsg.text.slice(0, 60) : '',
        };
      })
    );

    return {
      conversations: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Admin: Block/Unblock User Chat (Section 9)
   */
  public static async setChatBlockStatus(
    userId: string,
    isBlocked: boolean,
    reason: string,
    adminId: string
  ) {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return { success: true, isBlocked };
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    user.isChatBlocked = isBlocked;
    if (isBlocked) {
      user.chatBlockReason = reason || 'Chat privileges restricted by administrator.';
    } else {
      user.chatBlockReason = undefined;
    }
    await user.save();

    await AuditLogModel.create({
      adminId,
      action: isBlocked ? 'BLOCK_USER_CHAT' : 'UNBLOCK_USER_CHAT',
      targetUserId: user._id.toString(),
      targetUserEmail: user.email,
      targetUserMobile: user.mobile,
      details: { reason },
    });

    return {
      success: true,
      userId,
      isBlocked,
      isChatBlocked: isBlocked,
      message: `User chat access is now ${isBlocked ? 'Blocked' : 'Restored'}.`,
    };
  }
}
