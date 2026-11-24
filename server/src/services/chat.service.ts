import mongoose, { Types } from 'mongoose';
import { ConversationModel, IConversation } from '../models/conversation.model';
import { MessageModel, IMessage } from '../models/message.model';
import { MatchModel } from '../models/match.model';
import { ProfileModel } from '../models/profile.model';
import { UserModel } from '../models/user.model';
import { PanditModel } from '../models/pandit.model';
import { SystemSettingsModel } from '../models/system-settings.model';
import { AuditLogModel } from '../models/audit-log.model';
import { MembershipService } from './membership.service';
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
      if (profile?.gender) return profile.gender;
      const userDoc = (await UserModel.findById(userId).select('gender').lean()) as any;
      if (userDoc?.gender) return userDoc.gender;
    }

    if (inMemoryProfileStore.has(userId)) {
      const p = inMemoryProfileStore.get(userId);
      if (p.gender) return p.gender;
    }

    for (const p of inMemoryProfileStore.values()) {
      if (p.userId === userId || p.id === userId || p._id === userId) {
        if (p.gender) return p.gender;
      }
    }

    return 'male';
  }

  /**
   * Check whether chat between sender and receiver is eligible
   * Enforces:
   * 1. Female-to-Male Free Chat (0 coins, 0 plan required)
   * 2. Male User Paid Chat / Plan Required (Plus/Premium plan required unless trial limit applies)
   * 3. Abusive account block check
   */
  public static async checkChatEligibility(
    senderId: string,
    receiverId: string,
    conversationId?: string
  ): Promise<{
    allowed: boolean;
    isFree: boolean;
    reason?: string;
    senderGender: string;
    receiverGender: string;
    planId?: string;
  }> {
    const isDbConnected = mongoose.connection.readyState === 1;

    // 0. Pandit Consultation Check:
    // If either party is a registered & approved Pandit, permit consultation communication
    if (isDbConnected && (mongoose.Types.ObjectId.isValid(senderId) || mongoose.Types.ObjectId.isValid(receiverId))) {
      const isPanditInvolved = await PanditModel.exists({
        $or: [
          { userId: senderId, verificationStatus: { $in: ['approved', 'verified'] } },
          { userId: receiverId, verificationStatus: { $in: ['approved', 'verified'] } },
        ],
      });
      if (isPanditInvolved) {
        return {
          allowed: true,
          isFree: true,
          reason: 'PANDIT_CONSULTATION_CHAT',
          senderGender: 'other',
          receiverGender: 'other',
        };
      }
    }

    // 1. Account Block Check
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

    const senderGender = await this.resolveUserGender(senderId);
    const receiverGender = await this.resolveUserGender(receiverId);

    // 2. Fetch system settings
    let femaleFreeChatEnabled = true;
    let malePaidChatRequired = true;
    let maleFreeReplyToFemale = true;
    let maleFreeMessageLimit = 0;

    if (isDbConnected) {
      try {
        const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
        if (settings) {
          femaleFreeChatEnabled = settings.femaleFreeChatEnabled !== false;
          malePaidChatRequired = settings.malePaidChatRequired !== false;
          maleFreeReplyToFemale = settings.maleFreeReplyToFemale !== false;
          maleFreeMessageLimit = settings.maleFreeMessageLimit || 0;
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

    // 4. Male sender rule: Plan check
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

      // Check if male is replying to an incoming female message in an existing conversation
      if (isDbConnected && maleFreeReplyToFemale && receiverGender === 'female') {
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
          // continue to next checks
        }
      }

      // If unit test / offline fallback without DB, allow
      if (!isDbConnected) {
        return {
          allowed: true,
          isFree: false,
          senderGender,
          receiverGender,
        };
      }

      // Check free trial limit
      if (maleFreeMessageLimit > 0) {
        const sentCount = await MessageModel.countDocuments({ senderId });
        if (sentCount < maleFreeMessageLimit) {
          return {
            allowed: true,
            isFree: true,
            reason: 'MALE_FREE_TRIAL',
            senderGender,
            receiverGender,
          };
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
   * Retrieves all conversations for the user
   */
  public static async getConversations(userId: string): Promise<ConversationItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;

    let convDocs: any[] = [];

    if (isDbConnected) {
      convDocs = await ConversationModel.find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
      }).sort({ lastMessageAt: -1 });
    } else {
      convDocs = inMemoryConversationStore
        .filter((c) => c.user1Id === userId || c.user2Id === userId)
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    }

    const items: ConversationItem[] = [];

    for (const conv of convDocs) {
      const convId = conv._id?.toString() || conv.id;
      const user1 = conv.user1Id?.toString() || conv.user1Id;
      const user2 = conv.user2Id?.toString() || conv.user2Id;
      const partnerId = user1 === userId ? user2 : user1;

      const participant = await this.getPublicProfileByUserId(partnerId, userId);

      // Fetch last message & unread count
      let lastMsg: any = null;
      let unreadCount = 0;

      if (isDbConnected) {
        lastMsg = await MessageModel.findOne({ conversationId: conv._id }).sort({ createdAt: -1 });
        unreadCount = await MessageModel.countDocuments({
          conversationId: conv._id,
          receiverId: userId,
          status: { $ne: 'read' },
        });
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
          const partnerUser = await UserModel.findById(partnerId);
          if (partnerUser) {
            contactExchange.phone = `+91 ${partnerUser.mobile}`;
          }
        } else {
          contactExchange.phone = '+91 9811100002';
          contactExchange.email = 'partner@shaadibanao.in';
        }
      }

      items.push({
        id: convId,
        matchId: conv.matchId?.toString() || conv.matchId,
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
   * Creates or gets conversation for a MUTUAL MATCH or FEMALE FREE CHAT
   */
  public static async getOrCreateConversation(
    userId: string,
    participantId: string
  ): Promise<ConversationItem> {
    const targetUserId = await this.resolveUserId(participantId);

    if (userId === targetUserId) {
      throw new AppError('Cannot start a conversation with yourself', 400, 'SELF_CONVERSATION_PROHIBITED');
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    // Check Genders
    const senderGender = await this.resolveUserGender(userId);
    const targetGender = await this.resolveUserGender(targetUserId);
    const isFemaleFreeChat = senderGender === 'female' && targetGender === 'male';

    // STEP 1: Verify valid Mutual Match (or Female-to-Male Free Chat initiation privilege)
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

    if (!matchRecord && !isFemaleFreeChat) {
      throw new AppError(
        'Messaging is restricted to mutual matches. You may only start a conversation after an interest is mutually accepted.',
        403,
        'NO_MUTUAL_MATCH'
      );
    }

    const matchId = matchRecord?._id?.toString() || matchRecord?.id || 'free_female_chat';

    // STEP 2: Find or create conversation
    let conv: any = null;

    if (isDbConnected) {
      conv = await ConversationModel.findOne({
        $or: [
          { user1Id: userId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: userId },
        ],
      });

      if (!conv) {
        conv = await ConversationModel.create({
          matchId: matchRecord ? matchRecord._id : undefined,
          user1Id: userId,
          user2Id: targetUserId,
          contactExchange: { status: 'none' },
          isFreeChat: isFemaleFreeChat,
          lastMessageAt: new Date(),
        });
      }
    } else {
      conv = inMemoryConversationStore.find(
        (c) =>
          (c.user1Id === userId && c.user2Id === targetUserId) ||
          (c.user1Id === targetUserId && c.user2Id === userId)
      );

      if (!conv) {
        conv = {
          id: `conv_${Date.now()}`,
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
   * Returns paginated message history
   */
  public static async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<ChatMessage>> {
    const isMember = await this.isUserInConversation(conversationId, userId);
    if (!isMember) {
      throw new AppError('Unauthorized. You are not a participant in this conversation.', 403, 'FORBIDDEN');
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    let items: ChatMessage[] = [];
    let totalCount = 0;

    if (isDbConnected) {
      totalCount = await MessageModel.countDocuments({ conversationId });
      const docs = await MessageModel.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      items = docs.map((m) => ({
        id: m._id.toString(),
        conversationId,
        senderId: m.senderId.toString(),
        text: m.text,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      }));
    } else {
      const allMsgs = inMemoryMessageStore
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      totalCount = allMsgs.length;
      const sliced = allMsgs.slice((page - 1) * limit, page * limit);

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

    // STEP 1: Verify Chat Eligibility (Female Free vs Male Paid Plan)
    const eligibility = await this.checkChatEligibility(userId, receiverId, conversationId);
    if (!eligibility.allowed) {
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
