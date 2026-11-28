import mongoose from 'mongoose';
import { HelloModel } from '../models/hello.model';
import { FriendRequestModel } from '../models/friend-request.model';
import { UserBlockModel } from '../models/user-block.model';
import { ProfileModel } from '../models/profile.model';
import { UserModel } from '../models/user.model';
import { MatchModel } from '../models/match.model';
import { ConversationModel } from '../models/conversation.model';
import { CommunityPostModel } from '../models/community-post.model';
import { NotificationModel } from '../models/notification.model';
import { ReportModel } from '../models/report.model';
import { ProfileService, inMemoryProfileStore } from './profile.service';
import { inMemoryProfileRegistry } from './search.service';
import { inMemoryMatchStore } from './interest.service';
import { inMemoryConversationStore } from './chat.service';
import { getAcceptedUserIds, presentPhotoUrl } from './photoPrivacy';
import { SocketService } from '../socket/socket.service';
import { AppError } from '../middleware/errorHandler';
import {
  assertPairNotBlocked,
  getFriendRequestBetween,
  inMemoryBlockStore,
  inMemoryFriendRequestStore,
  inMemoryHelloStore,
  isPairBlocked,
  recordInMemoryBlock,
  removeInMemoryBlock,
} from './relationshipGuard';
import {
  FreeHelloItem,
  FriendRequestItem,
  ProfileStoryItem,
  PublicProfile,
  StorySlide,
} from '@bandhansetu/shared';

export class SocialService {
  private static findInMemoryProfile(idOrUserId: string): any {
    if (inMemoryProfileStore.has(idOrUserId)) {
      return inMemoryProfileStore.get(idOrUserId);
    }
    for (const p of inMemoryProfileStore.values()) {
      if (p.id === idOrUserId || p._id === idOrUserId || p.userId === idOrUserId) {
        return p;
      }
    }
    return inMemoryProfileRegistry.find(
      (p) => p.id === idOrUserId || p._id === idOrUserId || p.userId === idOrUserId
    );
  }

  private static async resolveUserId(targetId: string): Promise<string> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
      if (mongoose.Types.ObjectId.isValid(targetId)) {
        const prof = await ProfileModel.findOne({
          $or: [{ _id: targetId }, { userId: targetId }],
        })
          .select('userId')
          .lean();
        if (prof) return (prof as any).userId.toString();

        const user = await UserModel.findById(targetId).select('_id').lean();
        if (user) return (user as any)._id.toString();
      }
      throw new AppError('Target user or profile not found', 404, 'USER_NOT_FOUND');
    }

    const memProf = this.findInMemoryProfile(targetId);
    if (memProf) return memProf.userId || memProf.id;
    return targetId;
  }

  private static async getUserGender(userId: string): Promise<string | undefined> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected && mongoose.Types.ObjectId.isValid(userId)) {
      const [prof, user] = await Promise.all([
        ProfileModel.findOne({ userId }).select('gender').lean(),
        UserModel.findById(userId).select('gender').lean(),
      ]);
      const g = (prof as any)?.gender || (user as any)?.gender;
      return g ? String(g).toLowerCase() : undefined;
    }
    const mem = this.findInMemoryProfile(userId);
    return mem?.gender ? String(mem.gender).toLowerCase() : undefined;
  }

  private static async getPublicProfileByUserId(
    userId: string,
    viewerId?: string
  ): Promise<PublicProfile> {
    const isDbConnected = mongoose.connection.readyState === 1;
    let doc: any = null;
    if (isDbConnected && mongoose.Types.ObjectId.isValid(userId)) {
      doc = await ProfileModel.findOne({ userId });
    } else {
      doc = this.findInMemoryProfile(userId);
    }

    if (!doc) {
      let fallbackName = 'ShaadiBanao Member';
      let fallbackGender: 'male' | 'female' = 'female';
      if (isDbConnected && mongoose.Types.ObjectId.isValid(userId)) {
        const u = (await UserModel.findById(userId).select('displayName gender').lean()) as any;
        if (u?.displayName) fallbackName = u.displayName;
        if (u?.gender === 'male' || u?.gender === 'female') fallbackGender = u.gender;
      }
      return {
        id: userId,
        displayName: fallbackName,
        gender: fallbackGender,
        age: 26,
        heightCm: 165,
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
   * GET /api/v1/stories
   * Returns story-enabled profiles (opposite-gender, approved, non-blocked) with safe slides.
   */
  public static async getStoriesFeed(viewerUserId: string): Promise<ProfileStoryItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return [];
    }

    const viewerGender = await this.getUserGender(viewerUserId);
    const targetGender =
      viewerGender === 'male' ? 'female' : viewerGender === 'female' ? 'male' : undefined;

    if (!targetGender) {
      return [];
    }

    const [blocks, reports, sentHellos, friendRequests] = await Promise.all([
      UserBlockModel.find({
        $or: [{ blockerId: viewerUserId }, { blockedUserId: viewerUserId }],
      })
        .select('blockerId blockedUserId')
        .lean(),
      ReportModel.find({
        $or: [{ reporterId: viewerUserId }, { reportedUserId: viewerUserId }],
        status: { $in: ['pending', 'reviewed', 'actioned'] },
      })
        .select('reporterId reportedUserId')
        .lean(),
      HelloModel.find({ senderId: viewerUserId }).select('recipientId').lean(),
      FriendRequestModel.find({
        $or: [{ senderId: viewerUserId }, { recipientId: viewerUserId }],
      })
        .select('senderId recipientId status')
        .lean(),
    ]);

    const excludedUserIds = new Set<string>([viewerUserId]);
    for (const b of blocks as any[]) {
      excludedUserIds.add(b.blockerId.toString());
      excludedUserIds.add(b.blockedUserId.toString());
    }
    for (const r of reports as any[]) {
      excludedUserIds.add(r.reporterId.toString());
      excludedUserIds.add(r.reportedUserId.toString());
    }
    excludedUserIds.delete(viewerUserId);

    const excludedObjIds = [viewerUserId, ...Array.from(excludedUserIds)]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const profiles = await ProfileModel.find({
      gender: targetGender,
      hideProfile: { $ne: true },
      userId: { $nin: excludedObjIds },
      'photos.0': { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const candidateUserIds = profiles.map((p: any) => p.userId.toString());
    const [acceptedUserIds, posts] = await Promise.all([
      getAcceptedUserIds(viewerUserId, candidateUserIds),
      CommunityPostModel.find({
        userId: { $in: candidateUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
        moderationStatus: 'approved',
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const helloSet = new Set(sentHellos.map((h: any) => h.recipientId.toString()));
    const frMap = new Map<string, 'pending' | 'accepted' | 'rejected'>();
    for (const fr of friendRequests as any[]) {
      const other =
        fr.senderId.toString() === viewerUserId
          ? fr.recipientId.toString()
          : fr.senderId.toString();
      if (fr.status === 'accepted' || fr.status === 'pending' || fr.status === 'rejected') {
        frMap.set(other, fr.status);
      }
    }

    const postsByUser = new Map<string, any[]>();
    for (const post of posts as any[]) {
      const uid = post.userId.toString();
      const list = postsByUser.get(uid) || [];
      list.push(post);
      postsByUser.set(uid, list);
    }

    const stories: ProfileStoryItem[] = [];
    for (const prof of profiles as any[]) {
      const uid = prof.userId.toString();
      const pub = ProfileService.formatPublicProfile(prof, {
        viewerId: viewerUserId,
        acceptedUserIds,
      });

      const slides: StorySlide[] = [];
      const userPosts = postsByUser.get(uid) || [];
      for (const p of userPosts) {
        if (p.mediaUrl) {
          slides.push({
            id: p._id.toString(),
            mediaUrl: presentPhotoUrl(p.mediaUrl, 'hero') || p.mediaUrl,
            caption: p.caption,
            createdAt: p.createdAt?.toISOString?.(),
          });
        }
      }

      for (let i = 0; i < pub.photos.length; i++) {
        const ph = pub.photos[i];
        if (ph.isLocked) continue;
        const safeUrl = ph.variants?.hero || ph.variants?.card || ph.url;
        if (safeUrl) {
          slides.push({
            id: `photo_${pub.id}_${i}`,
            mediaUrl: safeUrl,
            caption: pub.aboutMe ? pub.aboutMe.slice(0, 120) : `${pub.city}, ${pub.occupation}`,
            blurred: Boolean(ph.isBlurred),
            isLocked: false,
          });
        }
      }

      if (slides.length === 0) continue;

      const mainPhoto = pub.photos.find((p) => p.isMain) || pub.photos[0];
      stories.push({
        userId: uid,
        profileId: pub.id,
        displayName: pub.displayName,
        age: pub.age,
        city: pub.city,
        isVerified: pub.isVerified,
        avatarUrl: mainPhoto?.variants?.avatar || mainPhoto?.url,
        avatarBlurred: Boolean(mainPhoto?.isBlurred || mainPhoto?.isLocked),
        hasStory: true,
        slides,
        helloSent: helloSet.has(uid),
        friendRequestStatus: frMap.get(uid) || 'none',
      });
    }

    return stories;
  }

  /**
   * POST /api/v1/hello or POST /api/v1/hello/:recipientId
   * Strictly enforces ONE free Hello per (senderId, recipientId) pair.
   */
  public static async sendFreeHello(
    senderId: string,
    recipientOrProfileId: string,
    message?: string
  ): Promise<FreeHelloItem> {
    const recipientId = await this.resolveUserId(recipientOrProfileId);

    if (senderId === recipientId) {
      throw new AppError('You cannot send a Hello to yourself.', 400, 'SELF_HELLO_PROHIBITED');
    }

    await assertPairNotBlocked(senderId, recipientId);

    const [senderGender, recipientGender] = await Promise.all([
      this.getUserGender(senderId),
      this.getUserGender(recipientId),
    ]);
    if (senderGender && recipientGender && senderGender === recipientGender) {
      throw new AppError(
        'Hellos can only be sent to opposite-gender matrimonial profiles.',
        400,
        'OPPOSITE_GENDER_REQUIRED'
      );
    }

    const cleanMsg = (message || 'Namaste! 👋').trim() || 'Namaste! 👋';
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const existing = await HelloModel.findOne({ senderId, recipientId }).lean();
      if (existing) {
        throw new AppError(
          'You have already sent your one free Hello to this user. Send a Friend Request to continue connecting.',
          409,
          'HELLO_ALREADY_SENT'
        );
      }

      let created: any;
      try {
        created = await HelloModel.create({
          senderId,
          recipientId,
          message: cleanMsg,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          throw new AppError(
            'You have already sent your one free Hello to this user.',
            409,
            'HELLO_ALREADY_SENT'
          );
        }
        throw err;
      }

      const recipientProfile = await this.getPublicProfileByUserId(recipientId, senderId);
      const senderProfile = await this.getPublicProfileByUserId(senderId, recipientId);

      try {
        await NotificationModel.create({
          userId: recipientId,
          type: 'new_hello',
          title: 'New Free Hello 👋',
          body: `${senderProfile.displayName} sent you a Hello: "${cleanMsg}"`,
          metadata: { senderId, helloId: created._id.toString() },
        });
      } catch {
        // Non-blocking notification
      }

      SocketService.emitToUser(recipientId, 'new_hello', {
        id: created._id.toString(),
        senderId,
        recipientId,
        message: cleanMsg,
        senderName: senderProfile.displayName,
        createdAt: created.createdAt.toISOString(),
      });

      return {
        id: created._id.toString(),
        senderId,
        recipientId,
        message: created.message,
        profile: recipientProfile,
        createdAt: created.createdAt.toISOString(),
      };
    }

    const existingMem = inMemoryHelloStore.find(
      (h) => h.senderId === senderId && h.recipientId === recipientId
    );
    if (existingMem) {
      throw new AppError(
        'You have already sent your one free Hello to this user.',
        409,
        'HELLO_ALREADY_SENT'
      );
    }

    const memItem = {
      id: `hello_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId,
      recipientId,
      message: cleanMsg,
      createdAt: new Date(),
    };
    inMemoryHelloStore.push(memItem);

    const recipientProfile = await this.getPublicProfileByUserId(recipientId, senderId);
    return {
      id: memItem.id,
      senderId,
      recipientId,
      message: memItem.message,
      profile: recipientProfile,
      createdAt: memItem.createdAt.toISOString(),
    };
  }

  public static async getHelloStatus(
    senderId: string,
    recipientOrProfileId: string
  ): Promise<{ sent: boolean; hello?: FreeHelloItem }> {
    const recipientId = await this.resolveUserId(recipientOrProfileId);
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.Types.ObjectId.isValid(senderId) && mongoose.Types.ObjectId.isValid(recipientId)) {
      const existing = (await HelloModel.findOne({ senderId, recipientId }).lean()) as any;
      if (!existing) return { sent: false };
      return {
        sent: true,
        hello: {
          id: existing._id.toString(),
          senderId,
          recipientId,
          message: existing.message,
          createdAt: existing.createdAt?.toISOString?.() || new Date().toISOString(),
        },
      };
    }

    const mem = inMemoryHelloStore.find(
      (h) => h.senderId === senderId && h.recipientId === recipientId
    );
    if (!mem) return { sent: false };
    return {
      sent: true,
      hello: {
        id: mem.id,
        senderId,
        recipientId,
        message: mem.message,
        createdAt: mem.createdAt.toISOString(),
      },
    };
  }

  public static async getSentHellos(userId: string): Promise<FreeHelloItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const rows: any[] = isDbConnected
      ? await HelloModel.find({ senderId: userId }).sort({ createdAt: -1 }).lean()
      : inMemoryHelloStore.filter((h) => h.senderId === userId);

    const out: FreeHelloItem[] = [];
    for (const r of rows) {
      const recId = r.recipientId.toString();
      out.push({
        id: r._id?.toString() || r.id,
        senderId: r.senderId.toString(),
        recipientId: recId,
        message: r.message,
        profile: await this.getPublicProfileByUserId(recId, userId),
        createdAt: r.createdAt?.toISOString?.() || new Date(r.createdAt).toISOString(),
      });
    }
    return out;
  }

  public static async getReceivedHellos(userId: string): Promise<FreeHelloItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const rows: any[] = isDbConnected
      ? await HelloModel.find({ recipientId: userId }).sort({ createdAt: -1 }).lean()
      : inMemoryHelloStore.filter((h) => h.recipientId === userId);

    const out: FreeHelloItem[] = [];
    for (const r of rows) {
      const sId = r.senderId.toString();
      if (await isPairBlocked(userId, sId)) continue;
      out.push({
        id: r._id?.toString() || r.id,
        senderId: sId,
        recipientId: r.recipientId.toString(),
        message: r.message,
        profile: await this.getPublicProfileByUserId(sId, userId),
        createdAt: r.createdAt?.toISOString?.() || new Date(r.createdAt).toISOString(),
      });
    }
    return out;
  }

  /**
   * POST /api/v1/friend-requests
   */
  public static async sendFriendRequest(
    senderId: string,
    recipientOrProfileId: string,
    note?: string
  ): Promise<FriendRequestItem> {
    const recipientId = await this.resolveUserId(recipientOrProfileId);

    if (senderId === recipientId) {
      throw new AppError('You cannot send a friend request to yourself.', 400, 'SELF_REQUEST_PROHIBITED');
    }

    await assertPairNotBlocked(senderId, recipientId);

    const [senderGender, recipientGender] = await Promise.all([
      this.getUserGender(senderId),
      this.getUserGender(recipientId),
    ]);
    if (senderGender && recipientGender && senderGender === recipientGender) {
      throw new AppError(
        'Friend requests can only be sent to opposite-gender matrimonial profiles.',
        400,
        'OPPOSITE_GENDER_REQUIRED'
      );
    }

    const existing = await getFriendRequestBetween(senderId, recipientId);
    if (existing.status === 'accepted') {
      throw new AppError('You are already connected as friends.', 409, 'ALREADY_FRIENDS');
    }
    if (existing.status === 'pending') {
      throw new AppError('A friend request is already pending between you two.', 409, 'FRIEND_REQUEST_ALREADY_PENDING');
    }
    if (existing.status === 'rejected') {
      throw new AppError(
        'A previous friend request between you two was declined.',
        403,
        'FRIEND_REQUEST_REJECTED'
      );
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const cleanNote = note?.trim();

    if (isDbConnected) {
      let doc: any;
      try {
        doc = await FriendRequestModel.create({
          senderId,
          recipientId,
          status: 'pending',
          note: cleanNote,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          throw new AppError('A friend request already exists between you two.', 409, 'FRIEND_REQUEST_ALREADY_PENDING');
        }
        throw err;
      }

      const [recipientProfile, senderProfile] = await Promise.all([
        this.getPublicProfileByUserId(recipientId, senderId),
        this.getPublicProfileByUserId(senderId, recipientId),
      ]);

      try {
        await NotificationModel.create({
          userId: recipientId,
          type: 'friend_request',
          title: 'New Friend Request',
          body: `${senderProfile.displayName} sent you a friend request.`,
          metadata: { senderId, friendRequestId: doc._id.toString() },
        });
      } catch {
        // Non-blocking
      }

      SocketService.emitToUser(recipientId, 'friend_request_received', {
        id: doc._id.toString(),
        senderId,
        recipientId,
        status: 'pending',
        senderName: senderProfile.displayName,
      });

      return {
        id: doc._id.toString(),
        senderId,
        recipientId,
        status: 'pending',
        note: doc.note,
        profile: recipientProfile,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      };
    }

    const now = new Date();
    const memReq = {
      id: `fr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId,
      recipientId,
      status: 'pending' as const,
      note: cleanNote,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryFriendRequestStore.push(memReq);
    const recipientProfile = await this.getPublicProfileByUserId(recipientId, senderId);

    return {
      id: memReq.id,
      senderId,
      recipientId,
      status: 'pending',
      note: memReq.note,
      profile: recipientProfile,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /**
   * PATCH /api/v1/friend-requests/:requestId
   * Only recipient can accept/reject. Accepting activates Match + Conversation for two-way chat.
   */
  public static async respondToFriendRequest(
    userId: string,
    requestId: string,
    action: 'accept' | 'reject'
  ): Promise<FriendRequestItem> {
    const isDbConnected = mongoose.connection.readyState === 1;
    let requestDoc: any = null;

    if (isDbConnected) {
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        throw new AppError('Invalid friend request ID', 400, 'INVALID_FRIEND_REQUEST_ID');
      }
      requestDoc = await FriendRequestModel.findById(requestId);
    } else {
      requestDoc = inMemoryFriendRequestStore.find((r) => r.id === requestId);
    }

    if (!requestDoc) {
      throw new AppError('Friend request not found', 404, 'FRIEND_REQUEST_NOT_FOUND');
    }

    const senderId = requestDoc.senderId.toString();
    const recipientId = requestDoc.recipientId.toString();

    if (recipientId !== userId) {
      throw new AppError(
        'Unauthorized. Only the recipient of this friend request can accept or reject it.',
        403,
        'FORBIDDEN'
      );
    }

    await assertPairNotBlocked(senderId, recipientId);

    if (requestDoc.status !== 'pending') {
      throw new AppError(
        `Cannot ${action} a friend request that is already '${requestDoc.status}'.`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'rejected';
    const now = new Date();
    requestDoc.status = nextStatus;
    requestDoc.respondedAt = now;
    requestDoc.updatedAt = now;

    let conversationId: string | undefined;

    if (nextStatus === 'accepted') {
      if (isDbConnected) {
        let matchRecord = await MatchModel.findOne({
          $or: [
            { user1Id: senderId, user2Id: recipientId },
            { user1Id: recipientId, user2Id: senderId },
          ],
        });
        if (!matchRecord) {
          matchRecord = await MatchModel.create({
            user1Id: senderId,
            user2Id: recipientId,
            friendRequestId: requestDoc._id,
          });
        }

        let conv = await ConversationModel.findOne({
          $or: [{ category: 'matrimonial' }, { category: { $exists: false } }],
          $and: [
            {
              $or: [
                { user1Id: senderId, user2Id: recipientId },
                { user1Id: recipientId, user2Id: senderId },
              ],
            },
          ],
        });

        if (!conv) {
          conv = await ConversationModel.create({
            category: 'matrimonial',
            matchId: matchRecord._id,
            friendRequestId: requestDoc._id,
            user1Id: senderId,
            user2Id: recipientId,
            contactExchange: { status: 'none' },
            isFreeChat: false,
            lastMessageAt: now,
          });
        } else if (!conv.friendRequestId) {
          conv.friendRequestId = requestDoc._id;
          if (!conv.matchId) conv.matchId = matchRecord._id;
          await conv.save();
        }

        conversationId = conv._id.toString();
        requestDoc.conversationId = conv._id;
        await requestDoc.save();
      } else {
        let matchRecord = inMemoryMatchStore.find(
          (m) =>
            (m.user1Id === senderId && m.user2Id === recipientId) ||
            (m.user1Id === recipientId && m.user2Id === senderId)
        );
        if (!matchRecord) {
          matchRecord = {
            id: `match_${Date.now()}`,
            user1Id: senderId,
            user2Id: recipientId,
            createdAt: now,
          };
          inMemoryMatchStore.push(matchRecord);
        }

        let conv = inMemoryConversationStore.find(
          (c) =>
            (!c.category || c.category === 'matrimonial') &&
            ((c.user1Id === senderId && c.user2Id === recipientId) ||
              (c.user1Id === recipientId && c.user2Id === senderId))
        );
        if (!conv) {
          conv = {
            id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            category: 'matrimonial',
            matchId: matchRecord.id,
            friendRequestId: requestDoc.id,
            user1Id: senderId,
            user2Id: recipientId,
            contactExchange: { status: 'none' },
            isFreeChat: false,
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
          };
          inMemoryConversationStore.push(conv);
        }
        conversationId = conv.id;
        requestDoc.conversationId = conv.id;
      }

      const recipientProfile = await this.getPublicProfileByUserId(recipientId, senderId);
      try {
        await NotificationModel.create({
          userId: senderId,
          type: 'friend_request_accepted',
          title: 'Friend Request Accepted 🎉',
          body: `${recipientProfile.displayName} accepted your friend request. Chat is now open!`,
          metadata: { conversationId, friendRequestId: requestDoc._id?.toString() || requestDoc.id },
        });
      } catch {
        // Non-blocking
      }

      SocketService.emitToUser(senderId, 'friend_request_accepted', {
        id: requestDoc._id?.toString() || requestDoc.id,
        conversationId,
        acceptedBy: recipientId,
      });
      SocketService.emitToUser(recipientId, 'friend_request_accepted', {
        id: requestDoc._id?.toString() || requestDoc.id,
        conversationId,
        acceptedBy: recipientId,
      });
    } else if (isDbConnected) {
      await requestDoc.save();
    }

    const senderProfile = await this.getPublicProfileByUserId(senderId, recipientId);
    return {
      id: requestDoc._id?.toString() || requestDoc.id,
      senderId,
      recipientId,
      status: nextStatus,
      note: requestDoc.note,
      conversationId,
      profile: senderProfile,
      createdAt: requestDoc.createdAt?.toISOString?.() || new Date(requestDoc.createdAt).toISOString(),
      updatedAt: requestDoc.updatedAt?.toISOString?.() || now.toISOString(),
      respondedAt: now.toISOString(),
    };
  }

  public static async getReceivedFriendRequests(userId: string): Promise<FriendRequestItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const rows: any[] = isDbConnected
      ? await FriendRequestModel.find({ recipientId: userId }).sort({ createdAt: -1 }).lean()
      : inMemoryFriendRequestStore.filter((r) => r.recipientId === userId);

    const out: FriendRequestItem[] = [];
    for (const r of rows) {
      const sId = r.senderId.toString();
      if (await isPairBlocked(userId, sId)) continue;
      out.push({
        id: r._id?.toString() || r.id,
        senderId: sId,
        recipientId: r.recipientId.toString(),
        status: r.status,
        note: r.note,
        conversationId: r.conversationId?.toString?.() || r.conversationId,
        profile: await this.getPublicProfileByUserId(sId, userId),
        createdAt: r.createdAt?.toISOString?.() || new Date(r.createdAt).toISOString(),
        updatedAt: r.updatedAt?.toISOString?.() || new Date(r.updatedAt).toISOString(),
        respondedAt: r.respondedAt?.toISOString?.() || (r.respondedAt ? new Date(r.respondedAt).toISOString() : undefined),
      });
    }
    return out;
  }

  public static async getSentFriendRequests(userId: string): Promise<FriendRequestItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const rows: any[] = isDbConnected
      ? await FriendRequestModel.find({ senderId: userId }).sort({ createdAt: -1 }).lean()
      : inMemoryFriendRequestStore.filter((r) => r.senderId === userId);

    const out: FriendRequestItem[] = [];
    for (const r of rows) {
      const recId = r.recipientId.toString();
      out.push({
        id: r._id?.toString() || r.id,
        senderId: r.senderId.toString(),
        recipientId: recId,
        status: r.status,
        note: r.note,
        conversationId: r.conversationId?.toString?.() || r.conversationId,
        profile: await this.getPublicProfileByUserId(recId, userId),
        createdAt: r.createdAt?.toISOString?.() || new Date(r.createdAt).toISOString(),
        updatedAt: r.updatedAt?.toISOString?.() || new Date(r.updatedAt).toISOString(),
        respondedAt: r.respondedAt?.toISOString?.() || (r.respondedAt ? new Date(r.respondedAt).toISOString() : undefined),
      });
    }
    return out;
  }

  public static async getFriends(userId: string): Promise<FriendRequestItem[]> {
    const isDbConnected = mongoose.connection.readyState === 1;
    const rows: any[] = isDbConnected
      ? await FriendRequestModel.find({
          status: 'accepted',
          $or: [{ senderId: userId }, { recipientId: userId }],
        })
          .sort({ respondedAt: -1, updatedAt: -1 })
          .lean()
      : inMemoryFriendRequestStore.filter(
          (r) => r.status === 'accepted' && (r.senderId === userId || r.recipientId === userId)
        );

    const out: FriendRequestItem[] = [];
    for (const r of rows) {
      const sId = r.senderId.toString();
      const recId = r.recipientId.toString();
      const partnerId = sId === userId ? recId : sId;
      if (await isPairBlocked(userId, partnerId)) continue;
      out.push({
        id: r._id?.toString() || r.id,
        senderId: sId,
        recipientId: recId,
        status: r.status,
        note: r.note,
        conversationId: r.conversationId?.toString?.() || r.conversationId,
        profile: await this.getPublicProfileByUserId(partnerId, userId),
        createdAt: r.createdAt?.toISOString?.() || new Date(r.createdAt).toISOString(),
        updatedAt: r.updatedAt?.toISOString?.() || new Date(r.updatedAt).toISOString(),
        respondedAt: r.respondedAt?.toISOString?.() || (r.respondedAt ? new Date(r.respondedAt).toISOString() : undefined),
      });
    }
    return out;
  }

  public static async blockUser(
    blockerId: string,
    targetOrProfileId: string,
    reason?: string
  ): Promise<{ blockerId: string; blockedUserId: string; blocked: boolean }> {
    const blockedUserId = await this.resolveUserId(targetOrProfileId);
    if (blockerId === blockedUserId) {
      throw new AppError('You cannot block yourself.', 400, 'SELF_BLOCK_PROHIBITED');
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
      await UserBlockModel.findOneAndUpdate(
        { blockerId, blockedUserId },
        { $set: { reason: reason?.trim() || 'Blocked by user' } },
        { upsert: true, new: true }
      );
    } else {
      await recordInMemoryBlock(blockerId, blockedUserId);
    }

    return { blockerId, blockedUserId, blocked: true };
  }

  public static async unblockUser(
    blockerId: string,
    targetOrProfileId: string
  ): Promise<{ blockerId: string; blockedUserId: string; blocked: boolean }> {
    const blockedUserId = await this.resolveUserId(targetOrProfileId);
    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
      await UserBlockModel.deleteOne({ blockerId, blockedUserId });
    } else {
      await removeInMemoryBlock(blockerId, blockedUserId);
    }
    return { blockerId, blockedUserId, blocked: false };
  }
}
