import mongoose from 'mongoose';
import http from 'http';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import { SocketService } from '../src/socket/socket.service';
import { TokenService } from '../src/services/token.service';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { MembershipModel } from '../src/models/membership.model';
import { SystemSettingsModel } from '../src/models/system-settings.model';
import { PanditModel } from '../src/models/pandit.model';
import { CommunityPostModel } from '../src/models/community-post.model';
import { ConversationModel } from '../src/models/conversation.model';
import { FriendRequestModel } from '../src/models/friend-request.model';
import { HelloModel } from '../src/models/hello.model';
import { UserBlockModel } from '../src/models/user-block.model';

describe('Story Viewer, One Free Hello, Friend Request Two-Way Chat & Subscription Security', () => {
  let mongod: MongoMemoryServer;
  let app: any;
  let server: http.Server;
  let serverPort: number;

  let maleUnsubId: string;
  let maleUnsubToken: string;

  let malePaidId: string;
  let malePaidToken: string;

  let femaleAId: string;
  let femaleAToken: string;

  let femaleBId: string;
  let femaleBToken: string;

  let femaleBlockedId: string;
  let femaleBlockedToken: string;

  let panditUserId: string;
  let panditMongoId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    app = createApp();
    server = http.createServer(app);
    SocketService.init(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });

    await SystemSettingsModel.create({
      key: 'global_settings',
      femaleFreeChatEnabled: true,
      malePaidChatRequired: true,
      maleFreeReplyToFemale: false,
      maleFreeMessageLimit: 0,
      panditFreeChatEnabled: true,
      panditFreeMessageLimit: 1,
      panditPaidChatRequired: true,
    });

    const createMember = async (
      mobile: string,
      email: string,
      firstName: string,
      lastName: string,
      gender: 'male' | 'female',
      photos: any[] = []
    ) => {
      const user = await UserModel.create({
        mobile,
        email,
        displayName: `${firstName} ${lastName}`,
        role: 'member',
        gender,
        status: 'active',
        approvalStatus: 'approved',
        isPhoneVerified: true,
      });
      await ProfileModel.create({
        userId: user._id,
        firstName,
        lastName,
        gender,
        dateOfBirth: new Date('1996-06-15'),
        heightCm: gender === 'male' ? 176 : 163,
        maritalStatus: 'never_married',
        motherTongue: 'Hindi',
        religion: 'Hindu',
        city: 'Delhi NCR',
        state: 'Delhi',
        country: 'India',
        education: 'B.Tech',
        employedIn: 'private',
        occupation: 'Engineer',
        completenessPercent: 95,
        isVerified: true,
        photos,
      });
      const token = TokenService.generateTokens({
        userId: user._id.toString(),
        mobile,
        email,
        role: 'member',
      }).accessToken;
      return { id: user._id.toString(), token };
    };

    const mUnsub = await createMember(
      '9700000001',
      'male.unsub@example.com',
      'Aarav',
      'Kumar',
      'male',
      [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/aarav.jpg', isMain: true, privacy: 'everyone', approved: true }]
    );
    maleUnsubId = mUnsub.id;
    maleUnsubToken = mUnsub.token;

    const mPaid = await createMember(
      '9700000002',
      'male.paid@example.com',
      'Vikram',
      'Verma',
      'male',
      [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/vikram.jpg', isMain: true, privacy: 'everyone', approved: true }]
    );
    malePaidId = mPaid.id;
    malePaidToken = mPaid.token;
    await MembershipModel.create({
      userId: malePaidId,
      planId: 'plus',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });

    const fA = await createMember(
      '9700000003',
      'female.a@example.com',
      'Ananya',
      'Sharma',
      'female',
      [
        {
          url: 'https://res.cloudinary.com/demo/image/upload/v1/ananya_public.jpg',
          isMain: true,
          privacy: 'everyone',
          approved: true,
        },
        {
          url: 'https://res.cloudinary.com/demo/image/upload/v1/ananya_private_secret.jpg',
          isMain: false,
          privacy: 'after_interest_accepted',
          approved: true,
        },
      ]
    );
    femaleAId = fA.id;
    femaleAToken = fA.token;

    await CommunityPostModel.create({
      userId: femaleAId,
      authorName: 'Ananya Sharma',
      mediaUrl: 'https://res.cloudinary.com/demo/image/upload/v1/ananya_story.jpg',
      caption: 'Festive celebration at home!',
      category: 'festivals',
      moderationStatus: 'approved',
    });

    const fB = await createMember(
      '9700000004',
      'female.b@example.com',
      'Meera',
      'Joshi',
      'female',
      [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/meera.jpg', isMain: true, privacy: 'everyone', approved: true }]
    );
    femaleBId = fB.id;
    femaleBToken = fB.token;

    const fBlocked = await createMember(
      '9700000005',
      'female.blocked@example.com',
      'Kavya',
      'Nair',
      'female',
      [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/kavya.jpg', isMain: true, privacy: 'everyone', approved: true }]
    );
    femaleBlockedId = fBlocked.id;
    femaleBlockedToken = fBlocked.token;

    const panditUser = await UserModel.create({
      mobile: '9700000099',
      email: 'pandit.social@example.com',
      displayName: 'Acharya Dev',
      role: 'member',
      gender: 'male',
      status: 'active',
      approvalStatus: 'approved',
    });
    panditUserId = panditUser._id.toString();
    const panditDoc = await PanditModel.create({
      userId: panditUser._id,
      panditId: 'PND-2026-SOC1',
      name: 'Acharya Dev',
      phone: '9700000099',
      email: 'pandit.social@example.com',
      experienceYears: 10,
      verificationStatus: 'approved',
      isActive: true,
      isChatAvailable: true,
    });
    panditMongoId = panditDoc._id.toString();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  describe('1. Story Feed & Privacy Rules', () => {
    it('returns story-enabled opposite-gender stories without leaking private after_interest_accepted photo URLs', async () => {
      const res = await request(app)
        .get('/api/v1/stories')
        .set('Authorization', `Bearer ${maleUnsubToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const stories = res.body.data as any[];
      expect(stories.length).toBeGreaterThanOrEqual(2);

      const ananyaStory = stories.find((s) => s.userId === femaleAId);
      expect(ananyaStory).toBeDefined();
      expect(ananyaStory.hasStory).toBe(true);
      expect(ananyaStory.slides.some((sl: any) => sl.mediaUrl.includes('ananya_story.jpg'))).toBe(true);
      // Locked/private photo original URL must not be leaked directly
      expect(
        ananyaStory.slides.some((sl: any) => sl.mediaUrl.includes('ananya_private_secret.jpg'))
      ).toBe(false);
    });
  });

  describe('2. One Free Hello Per Sender-Recipient Pair', () => {
    it('allows sending 1 free Hello (even for unsubscribed male) and blocks duplicate attempts server-side (409)', async () => {
      const first = await request(app)
        .post(`/api/v1/hello/${femaleAId}`)
        .set('Authorization', `Bearer ${maleUnsubToken}`)
        .send({ message: 'Namaste Ananya ji!' });

      expect(first.status).toBe(201);
      expect(first.body.success).toBe(true);
      expect(first.body.data.senderId).toBe(maleUnsubId);
      expect(first.body.data.recipientId).toBe(femaleAId);

      // Duplicate attempt must be blocked with 409 HELLO_ALREADY_SENT
      const duplicate = await request(app)
        .post(`/api/v1/hello/${femaleAId}`)
        .set('Authorization', `Bearer ${maleUnsubToken}`)
        .send({ message: 'Trying a second free hello' });

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('HELLO_ALREADY_SENT');

      // Recipient sees the received Hello
      const received = await request(app)
        .get('/api/v1/hello/received')
        .set('Authorization', `Bearer ${femaleAToken}`);
      expect(received.status).toBe(200);
      expect(received.body.data.some((h: any) => h.senderId === maleUnsubId)).toBe(true);

      // Reverse pair (femaleA -> maleUnsub) is a distinct sender-recipient pair and works once
      const reverse = await request(app)
        .post(`/api/v1/hello/${maleUnsubId}`)
        .set('Authorization', `Bearer ${femaleAToken}`)
        .send({ message: 'Namaste Aarav!' });
      expect(reverse.status).toBe(201);

      const reverseDup = await request(app)
        .post(`/api/v1/hello/${maleUnsubId}`)
        .set('Authorization', `Bearer ${femaleAToken}`)
        .send({ message: 'Second hello back' });
      expect(reverseDup.status).toBe(409);
    });

    it('blocks concurrent parallel duplicate free Hello attempts atomically', async () => {
      const [r1, r2] = await Promise.all([
        request(app)
          .post(`/api/v1/hello/${femaleBId}`)
          .set('Authorization', `Bearer ${maleUnsubToken}`)
          .send({ message: 'Concurrent hello 1' }),
        request(app)
          .post(`/api/v1/hello/${femaleBId}`)
          .set('Authorization', `Bearer ${maleUnsubToken}`)
          .send({ message: 'Concurrent hello 2' }),
      ]);

      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);
      const countInDb = await HelloModel.countDocuments({
        senderId: maleUnsubId,
        recipientId: femaleBId,
      });
      expect(countInDb).toBe(1);
    });
  });

  describe('3. Friend Requests, Two-Way Chat Activation, & Unauthorized Access Blocking', () => {
    let pendingReqId: string;
    let rejectedReqId: string;
    let activeConversationId: string;

    it('sends a Friend Request and blocks chat while status is pending (403 FRIEND_REQUEST_PENDING)', async () => {
      const sendRes = await request(app)
        .post(`/api/v1/friend-requests/${femaleAId}`)
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({ note: 'Would love to connect with your family.' });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.data.status).toBe('pending');
      pendingReqId = sendRes.body.data.id;

      // Received list shows the request for femaleA
      const recRes = await request(app)
        .get('/api/v1/friend-requests/received')
        .set('Authorization', `Bearer ${femaleAToken}`);
      expect(recRes.status).toBe(200);
      expect(recRes.body.data.some((r: any) => r.id === pendingReqId)).toBe(true);

      // Sender cannot self-accept their own request
      const selfAccept = await request(app)
        .patch(`/api/v1/friend-requests/${pendingReqId}`)
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({ action: 'accept' });
      expect(selfAccept.status).toBe(403);

      // While pending, neither user can open unauthorized chat
      const pendingChatSender = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({ participantId: femaleAId });
      expect(pendingChatSender.status).toBe(403);
      expect(pendingChatSender.body.error.code).toBe('FRIEND_REQUEST_PENDING');

      const pendingChatRecipient = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${femaleAToken}`)
        .send({ participantId: malePaidId });
      expect(pendingChatRecipient.status).toBe(403);
      expect(pendingChatRecipient.body.error.code).toBe('FRIEND_REQUEST_PENDING');
    });

    it('rejecting a Friend Request keeps chat blocked (403 FRIEND_REQUEST_REJECTED)', async () => {
      const sendRes = await request(app)
        .post(`/api/v1/friend-requests/${femaleBId}`)
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({ note: 'Hi Meera' });
      expect(sendRes.status).toBe(201);
      rejectedReqId = sendRes.body.data.id;

      const rejectRes = await request(app)
        .patch(`/api/v1/friend-requests/${rejectedReqId}`)
        .set('Authorization', `Bearer ${femaleBToken}`)
        .send({ action: 'reject' });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('rejected');

      const rejectedChatMale = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({ participantId: femaleBId });
      expect(rejectedChatMale.status).toBe(403);
      expect(rejectedChatMale.body.error.code).toBe('FRIEND_REQUEST_REJECTED');

      const rejectedChatFemale = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${femaleBToken}`)
        .send({ participantId: malePaidId });
      expect(rejectedChatFemale.status).toBe(403);
      expect(rejectedChatFemale.body.error.code).toBe('FRIEND_REQUEST_REJECTED');
    });

    it('accepting a Friend Request activates working two-way persistent & real-time chat', async () => {
      const acceptRes = await request(app)
        .patch(`/api/v1/friend-requests/${pendingReqId}`)
        .set('Authorization', `Bearer ${femaleAToken}`)
        .send({ action: 'accept' });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('accepted');
      expect(acceptRes.body.data.conversationId).toBeTruthy();
      activeConversationId = acceptRes.body.data.conversationId;

      // Both sockets join and exchange real-time + persistent messages
      const socketMale: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: malePaidToken },
        transports: ['websocket'],
      });
      const socketFemale: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: femaleAToken },
        transports: ['websocket'],
      });

      await Promise.all([
        new Promise<void>((res) => socketMale.on('connect', res)),
        new Promise<void>((res) => socketFemale.on('connect', res)),
      ]);

      await Promise.all([
        new Promise<void>((res, rej) =>
          socketMale.emit('join_conversation', { conversationId: activeConversationId }, (r: any) =>
            r?.success ? res() : rej(new Error(r?.error))
          )
        ),
        new Promise<void>((res, rej) =>
          socketFemale.emit('join_conversation', { conversationId: activeConversationId }, (r: any) =>
            r?.success ? res() : rej(new Error(r?.error))
          )
        ),
      ]);

      const receivedByFemale = new Promise<any>((resolve) => {
        socketFemale.on('new_message', (msg) => {
          if (msg.senderId === malePaidId) resolve(msg);
        });
      });

      // Male sends message via REST
      const m1 = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({ text: 'Namaste Ananya, glad we are friends now!' });
      expect(m1.status).toBe(201);

      const rtMsg = await receivedByFemale;
      expect(rtMsg.text).toBe('Namaste Ananya, glad we are friends now!');

      // Female replies via REST
      const m2 = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${femaleAToken}`)
        .send({ text: 'Namaste Vikram! Great to connect.' });
      expect(m2.status).toBe(201);

      // Both retrieve persistent message history
      const histMale = await request(app)
        .get(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${malePaidToken}`);
      const histFemale = await request(app)
        .get(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${femaleAToken}`);

      expect(histMale.status).toBe(200);
      expect(histFemale.status).toBe(200);
      expect(histMale.body.data.items.length).toBeGreaterThanOrEqual(2);
      expect(histFemale.body.data.items.length).toBeGreaterThanOrEqual(2);

      // 3rd party cannot access conversation
      const strangerRead = await request(app)
        .get(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${femaleBToken}`);
      expect(strangerRead.status).toBe(403);

      socketMale.close();
      socketFemale.close();
    });

    it('blocked users cannot access chats (REST or Socket.IO) or send friend requests', async () => {
      const blockRes = await request(app)
        .post(`/api/v1/blocks/${malePaidId}`)
        .set('Authorization', `Bearer ${femaleAToken}`)
        .send({ reason: 'User chose to block' });
      expect(blockRes.status).toBe(200);

      // Existing conversation is now inaccessible for both REST endpoints
      const blockedSend = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({ text: 'Can I still message?' });
      expect(blockedSend.status).toBe(403);
      expect(blockedSend.body.error.code).toBe('USER_BLOCKED');

      const blockedRead = await request(app)
        .get(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${malePaidToken}`);
      expect(blockedRead.status).toBe(403);
      expect(blockedRead.body.error.code).toBe('USER_BLOCKED');

      // Socket join is also rejected
      const socketBlocked: ClientSocket = Client(`http://localhost:${serverPort}`, {
        auth: { token: malePaidToken },
        transports: ['websocket'],
      });
      await new Promise<void>((res) => socketBlocked.on('connect', res));
      const joinAck: any = await new Promise((resolve) =>
        socketBlocked.emit('join_conversation', { conversationId: activeConversationId }, resolve)
      );
      expect(joinAck.success).toBe(false);
      socketBlocked.close();

      // Also verify blocking femaleBlocked user prevents friend requests & chat
      await UserBlockModel.create({ blockerId: femaleBlockedId, blockedUserId: malePaidId });
      const reqToBlocked = await request(app)
        .post(`/api/v1/friend-requests/${femaleBlockedId}`)
        .set('Authorization', `Bearer ${malePaidToken}`)
        .send({});
      expect(reqToBlocked.status).toBe(403);
      expect(reqToBlocked.body.error.code).toBe('USER_BLOCKED');
    });
  });

  describe('4. Subscription Enforcement, Frontend Bypass Prevention & Pandit Exemptions', () => {
    it('frontend spoofed flags cannot bypass backend 402 subscription check for unsubscribed male', async () => {
      // Female B initiates free chat with unsubscribed male
      const convRes = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${femaleBToken}`)
        .send({ participantId: maleUnsubId, isFreeChat: true });
      expect([200, 201]).toContain(convRes.status);
      const convId = convRes.body.data.id;

      // Female B sends free message
      const fMsg = await request(app)
        .post(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${femaleBToken}`)
        .send({ text: 'Hi Aarav!' });
      expect(fMsg.status).toBe(201);
      expect(fMsg.body.data.isFreeChat).toBe(true);

      // Unsubscribed male sends message WITH spoofed client flags -> MUST still be 402!
      const spoofedMsg = await request(app)
        .post(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${maleUnsubToken}`)
        .set('x-is-free-chat', 'true')
        .send({
          text: 'Trying spoofed flags',
          isFreeChat: true,
          isFree: true,
          bypassPaywall: true,
          planTier: 'premium',
          senderGender: 'female',
        });

      expect(spoofedMsg.status).toBe(402);
      expect(spoofedMsg.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('preserves Pandit 1-free-intro exemption independent of matrimonial subscription', async () => {
      const pConv = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${maleUnsubToken}`)
        .send({ participantId: panditUserId, category: 'pandit_consultation', panditId: panditMongoId });
      expect([200, 201]).toContain(pConv.status);

      const pMsg = await request(app)
        .post(`/api/v1/conversations/${pConv.body.data.id}/messages`)
        .set('Authorization', `Bearer ${maleUnsubToken}`)
        .send({ text: 'Pandit ji pranam, muhurat query.' });
      expect(pMsg.status).toBe(201);
      expect(pMsg.body.data.isFreeChat).toBe(true);
    });
  });
});
