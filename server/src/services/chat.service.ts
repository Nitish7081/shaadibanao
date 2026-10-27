import mongoose, { Types } from 'mongoose';
import { ConversationModel, IConversation } from '../models/conversation.model';
import { MessageModel, IMessage } from '../models/message.model';
import { MatchModel } from '../models/match.model';
import { ProfileModel } from '../models/profile.model';
import { getAcceptedUserIds } from './photoPrivacy';
import { UserModel } from '../models/user.model';
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
  matchId: string;
  user1Id: string;
  user2Id: string;
  contactExchange: {
    status: 'none' | 'requested' | 'accepted' | 'declined';
    requestedBy?: string;
    updatedAt?: Date;
  };
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
        // Disclose contact details only after mutual consent
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
   * Creates or gets conversation for a MUTUAL MATCH ONLY
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

    // STEP 1: Verify valid Mutual Match (Strict Access Control)
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

    if (!matchRecord) {
      throw new AppError(
        'Messaging is restricted to mutual matches. You may only start a conversation after an interest is mutually accepted.',
        403,
        'NO_MUTUAL_MATCH'
      );
    }

    const matchId = matchRecord._id?.toString() || matchRecord.id;

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
          matchId: matchRecord._id,
          user1Id: userId,
          user2Id: targetUserId,
          contactExchange: { status: 'none' },
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
   * Sends a message in a conversation
   */
  public static async sendMessage(
    userId: string,
    conversationId: string,
    text: string
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

    let savedMessage: ChatMessage;

    if (isDbConnected) {
      const msg = await MessageModel.create({
        conversationId,
        senderId: userId,
        receiverId,
        text,
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
        createdAt: now.toISOString(),
      };
    }

    // Real-Time Socket Emission
    SocketService.emitToConversation(conversationId, 'new_message', savedMessage);
    SocketService.emitToUser(receiverId, 'new_message_notification', {
      conversationId,
      message: savedMessage,
    });

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
}
