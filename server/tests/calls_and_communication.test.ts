import request from 'supertest';
import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { SocketService } from '../src/socket/socket.service';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/user.model';
import { PanditModel } from '../src/models/pandit.model';
import { MembershipModel } from '../src/models/membership.model';
import { ConversationModel } from '../src/models/conversation.model';
import { MessageModel } from '../src/models/message.model';
import { CallSessionModel } from '../src/models/call-session.model';
import { SystemSettingsModel } from '../src/models/system-settings.model';
import { TokenService } from '../src/services/token.service';
import { inMemoryProfileStore } from '../src/services/profile.service';
import { inMemoryMembershipStore } from '../src/services/membership.service';
import { registerMockUserApprovalForTesting } from '../src/middleware/approval.middleware';
import { ChatService } from '../src/services/chat.service';

const app = createApp();

describe('SHAADIBANAO – COMMUNICATION SYSTEM (FREE CHAT, PAID CHAT, PANDIT MESSAGING & CALLING) SUITE', () => {
  // Test User Object IDs
  const adminId = new mongoose.Types.ObjectId().toString();
  const femaleDevoteeId = new mongoose.Types.ObjectId().toString();
  const maleCandidateId = new mongoose.Types.ObjectId().toString();
  const malePaidCandidateId = new mongoose.Types.ObjectId().toString();
  const panditUserId = new mongoose.Types.ObjectId().toString();

  let adminToken: string;
  let femaleToken: string;
  let maleToken: string;
  let malePaidToken: string;
  let panditToken: string;
  let panditDocId: string;
  let sharedConvId: string;
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    await connectDatabase();

    // 1. Setup Mock User Approvals
    [femaleDevoteeId, maleCandidateId, malePaidCandidateId].forEach((id) =>
      registerMockUserApprovalForTesting(id, { status: 'active', approvalStatus: 'approved', role: 'member' })
    );
    registerMockUserApprovalForTesting(panditUserId, { status: 'active', approvalStatus: 'approved', role: 'pandit' });
    registerMockUserApprovalForTesting(adminId, { status: 'active', approvalStatus: 'approved', role: 'admin' });

    // 2. Setup User Tokens
    adminToken = TokenService.generateTokens({ userId: adminId, role: 'admin' }).accessToken;
    femaleToken = TokenService.generateTokens({ userId: femaleDevoteeId, role: 'member' }).accessToken;
    maleToken = TokenService.generateTokens({ userId: maleCandidateId, role: 'member' }).accessToken;
    malePaidToken = TokenService.generateTokens({ userId: malePaidCandidateId, role: 'member' }).accessToken;
    panditToken = TokenService.generateTokens({ userId: panditUserId, role: 'pandit' }).accessToken;

    // 3. Setup Users in MongoDB UserModel
    await UserModel.findOneAndUpdate(
      { _id: adminId },
      { _id: adminId, email: 'admin.comm@shaadibanao.com', role: 'admin', status: 'active', approvalStatus: 'approved' },
      { upsert: true }
    );
    await UserModel.findOneAndUpdate(
      { _id: femaleDevoteeId },
      { _id: femaleDevoteeId, mobile: '9870000001', gender: 'female', role: 'member', status: 'active', approvalStatus: 'approved', displayName: 'Priya Sharma' },
      { upsert: true }
    );
    await UserModel.findOneAndUpdate(
      { _id: maleCandidateId },
      { _id: maleCandidateId, mobile: '9870000002', gender: 'male', role: 'member', status: 'active', approvalStatus: 'approved', displayName: 'Rohit Verma' },
      { upsert: true }
    );
    await UserModel.findOneAndUpdate(
      { _id: malePaidCandidateId },
      { _id: malePaidCandidateId, mobile: '9870000003', gender: 'male', role: 'member', status: 'active', approvalStatus: 'approved', displayName: 'Vikram Singh' },
      { upsert: true }
    );
    await UserModel.findOneAndUpdate(
      { _id: panditUserId },
      { _id: panditUserId, mobile: '9811998877', role: 'pandit', status: 'active', approvalStatus: 'approved', displayName: 'Acharya Ramanand Shastri' },
      { upsert: true }
    );

    // 4. Setup Profiles in inMemoryProfileStore
    inMemoryProfileStore.set(femaleDevoteeId, {
      id: femaleDevoteeId,
      userId: femaleDevoteeId,
      firstName: 'Priya',
      lastName: 'Sharma',
      gender: 'female',
      dateOfBirth: new Date('1997-04-12'),
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Delhi',
      education: 'M.Sc',
      occupation: 'Teacher',
      photos: [],
      completenessPercent: 85,
    } as any);

    inMemoryProfileStore.set(maleCandidateId, {
      id: maleCandidateId,
      userId: maleCandidateId,
      firstName: 'Rohit',
      lastName: 'Verma',
      gender: 'male',
      dateOfBirth: new Date('1994-08-20'),
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Delhi',
      education: 'B.Tech',
      occupation: 'Software Engineer',
      photos: [],
      completenessPercent: 85,
    } as any);

    inMemoryProfileStore.set(malePaidCandidateId, {
      id: malePaidCandidateId,
      userId: malePaidCandidateId,
      firstName: 'Vikram',
      lastName: 'Singh',
      gender: 'male',
      dateOfBirth: new Date('1993-02-10'),
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Mumbai',
      education: 'MBA',
      occupation: 'Consultant',
      photos: [],
      completenessPercent: 90,
    } as any);

    // 5. Setup Active Paid Membership in MongoDB & In-Memory for Vikram
    await MembershipModel.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(malePaidCandidateId) },
      {
        userId: new mongoose.Types.ObjectId(malePaidCandidateId),
        planId: 'premium',
        status: 'active',
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    );

    inMemoryMembershipStore.set(malePaidCandidateId, {
      userId: malePaidCandidateId,
      tier: 'premium',
      planId: 'premium',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      status: 'active',
      features: ['unlimited_chat', 'audio_calling', 'video_calling'],
    } as any);

    // 6. Setup Verified Pandit Document in MongoDB
    const panditDoc = await PanditModel.findOneAndUpdate(
      { userId: panditUserId },
      {
        userId: panditUserId,
        name: 'Acharya Ramanand Shastri',
        phone: '9811998877',
        isAvailable: true,
        isAudioCallAvailable: true,
        isVideoCallAvailable: true,
        isChatAvailable: true,
        audioCallChargePerMin: 25,
        videoCallChargePerMin: 55,
        rating: 4.9,
        status: 'approved',
        approvalStatus: 'approved',
        verificationStatus: 'approved',
      },
      { upsert: true, new: true }
    );
    panditDocId = panditDoc._id.toString();

    // 7. Ensure Global System Settings in MongoDB
    await SystemSettingsModel.findOneAndUpdate(
      { key: 'global_settings' },
      {
        key: 'global_settings',
        femaleFreeChatEnabled: true,
        malePaidChatRequired: true,
        maleFreeReplyToFemale: true,
        audioConsultationPriceInr: 501,
        videoConsultationPriceInr: 1100,
        callCommissionRate: 15,
      },
      { upsert: true }
    );

    // Clean any prior test call sessions and conversations
    await CallSessionModel.deleteMany({ callerId: { $in: [femaleDevoteeId, maleCandidateId, malePaidCandidateId] } });
    await ConversationModel.deleteMany({
      $or: [
        { user1Id: { $in: [femaleDevoteeId, maleCandidateId, malePaidCandidateId] } },
        { user2Id: { $in: [femaleDevoteeId, maleCandidateId, malePaidCandidateId] } },
      ],
    });

    // 8. Start HTTP Server with Socket.IO
    server = http.createServer(app);
    SocketService.init(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await CallSessionModel.deleteMany({ callerId: { $in: [femaleDevoteeId, maleCandidateId, malePaidCandidateId] } });
    await ConversationModel.deleteMany({
      $or: [
        { user1Id: { $in: [femaleDevoteeId, maleCandidateId, malePaidCandidateId] } },
        { user2Id: { $in: [femaleDevoteeId, maleCandidateId, malePaidCandidateId] } },
      ],
    });
    await PanditModel.deleteMany({ userId: panditUserId });
    await UserModel.deleteMany({ _id: { $in: [adminId, femaleDevoteeId, maleCandidateId, malePaidCandidateId, panditUserId] } });
    await disconnectDatabase();
  });

  // =========================================================================
  // SECTION 1: FEMALE TO MALE FREE CHAT ELIGIBILITY & RULES
  // =========================================================================
  describe('1. Female to Male Free Chat Rules', () => {
    it('1.1 Female user has 100% free chat eligibility without purchasing any subscription', async () => {
      const eligibility = await ChatService.checkChatEligibility(femaleDevoteeId, maleCandidateId);
      expect(eligibility.allowed).toBe(true);
      expect(eligibility.isFree).toBe(true);
      expect(eligibility.reason).toBe('FEMALE_FREE_CHAT');
    });

    it('1.2 Female user can initialize conversation with male candidate', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({ participantId: maleCandidateId });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      sharedConvId = res.body.data.id || res.body.data._id;
      expect(sharedConvId).toBeDefined();
    });

    it('1.3 Female user sends message in conversation', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${sharedConvId}/messages`)
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({ text: 'Namaste Rohit Ji, I liked your profile.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.text).toBe('Namaste Rohit Ji, I liked your profile.');
      expect(res.body.data.isFreeChat).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 2: MALE SUBSCRIPTION CHAT RULES & MALE REPLY EXEMPTION
  // =========================================================================
  describe('2. Male Subscription Chat Rules', () => {
    const freshFemaleId = new mongoose.Types.ObjectId().toString();

    beforeAll(async () => {
      await UserModel.create({ _id: freshFemaleId, gender: 'female', status: 'active', approvalStatus: 'approved' });
      inMemoryProfileStore.set(freshFemaleId, { id: freshFemaleId, userId: freshFemaleId, gender: 'female' } as any);
      registerMockUserApprovalForTesting(freshFemaleId, { status: 'active', approvalStatus: 'approved', role: 'member' });
    });

    it('2.1 Unsubscribed male candidate CANNOT initiate new conversation (requires subscription)', async () => {
      const eligibility = await ChatService.checkChatEligibility(maleCandidateId, freshFemaleId);
      expect(eligibility.allowed).toBe(false);
      expect(eligibility.reason).toBe('MALE_PLAN_REQUIRED');
    });

    it('2.2 Unsubscribed male trying to send message to uninitiated female receives 402 Payment Required', async () => {
      // Create a direct conversation stub
      const conv = await ConversationModel.create({
        user1Id: maleCandidateId,
        user2Id: freshFemaleId,
        contactExchange: { status: 'none' },
        isFreeChat: false,
      });

      const res = await request(app)
        .post(`/api/v1/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${maleToken}`)
        .send({ text: 'Hello Priya, are you free?' });

      expect(res.status).toBe(402);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('2.3 Paid male candidate (Vikram) is allowed full messaging access', async () => {
      const eligibility = await ChatService.checkChatEligibility(malePaidCandidateId, femaleDevoteeId);
      expect(eligibility.allowed).toBe(true);
      expect(eligibility.planId).toBe('premium');
    });

    it('2.4 Male candidate can reply for free when female initiated the conversation', async () => {
      // In sharedConvId, Priya (female) sent a message to Rohit (male) in test 1.3
      const eligibility = await ChatService.checkChatEligibility(maleCandidateId, femaleDevoteeId, sharedConvId);
      expect(eligibility.allowed).toBe(true);
      expect(eligibility.isFree).toBe(true);
      expect(eligibility.reason).toBe('MALE_REPLY_TO_FEMALE_ALLOWED');

      // Male sends free reply
      const res = await request(app)
        .post(`/api/v1/conversations/${sharedConvId}/messages`)
        .set('Authorization', `Bearer ${maleToken}`)
        .send({ text: 'Namaste Priya Ji, thank you! I would love to connect with your family.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFreeChat).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 3: PANDIT TO DEVOTEE CONSULTATION CHAT (NO SUBSCRIPTION PAYWALL)
  // =========================================================================
  describe('3. Pandit Consultation Chat Rules', () => {
    it('3.1 Devotee communicating with Pandit is exempted from matrimonial subscription paywall', async () => {
      const eligibility = await ChatService.checkChatEligibility(maleCandidateId, panditUserId);
      expect(eligibility.allowed).toBe(true);
      expect(eligibility.isFree).toBe(true);
      expect(eligibility.reason).toBe('PANDIT_CONSULTATION_CHAT');
    });

    it('3.2 Pandit communicating with Devotee is exempted from matrimonial subscription paywall', async () => {
      const eligibility = await ChatService.checkChatEligibility(panditUserId, maleCandidateId);
      expect(eligibility.allowed).toBe(true);
      expect(eligibility.isFree).toBe(true);
      expect(eligibility.reason).toBe('PANDIT_CONSULTATION_CHAT');
    });
  });

  // =========================================================================
  // SECTION 4: AUDIO & VIDEO CALLING WORKFLOW (INITIATE, ACCEPT, END, EARNINGS)
  // =========================================================================
  describe('4. Audio & Video Calling Flow', () => {
    let testAudioSessionId: string;
    let testVideoSessionId: string;

    it('4.1 WebRTC configuration endpoint returns Google STUN servers', async () => {
      const res = await request(app)
        .get('/api/v1/calls/webrtc/config')
        .set('Authorization', `Bearer ${femaleToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.iceServers).toBeDefined();
      expect(res.body.data.iceServers.length).toBeGreaterThan(0);
      expect(res.body.data.iceServers[0].urls).toContain('stun:stun.l.google.com:19302');
    });

    it('4.2 Initiates an Audio Call consultation with Pandit', async () => {
      const res = await request(app)
        .post('/api/v1/calls/initiate')
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({
          receiverId: panditUserId,
          callType: 'audio',
          panditId: panditDocId,
          amountPaid: 501,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.callType).toBe('audio');
      expect(res.body.data.status).toBe('ringing');

      testAudioSessionId = res.body.data.sessionId;
    });

    it('4.3 Pandit accepts the incoming Audio Call', async () => {
      const res = await request(app)
        .post(`/api/v1/calls/${testAudioSessionId}/accept`)
        .set('Authorization', `Bearer ${panditToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('accepted');
    });

    it('4.4 Terminates Audio Call after 600s: calculates Pandit earnings (85%) & platform commission (15%)', async () => {
      const res = await request(app)
        .post(`/api/v1/calls/${testAudioSessionId}/end`)
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({ durationSeconds: 600 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ended');
      expect(res.body.data.durationSeconds).toBe(600);

      // Verify financial split in MongoDB: 501 INR total -> 15% platform commission = 75 INR, 85% pandit earnings = 426 INR
      const sessionDoc = await CallSessionModel.findOne({ sessionId: testAudioSessionId });
      expect(sessionDoc).not.toBeNull();
      expect(sessionDoc?.amountPaid).toBe(501);
      expect(sessionDoc?.panditEarnings).toBe(426);
      expect(sessionDoc?.commissionAmount).toBe(75);
    });

    it('4.5 Initiates and terminates a Video Call consultation', async () => {
      const initRes = await request(app)
        .post('/api/v1/calls/initiate')
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({
          receiverId: panditUserId,
          callType: 'video',
          panditId: panditDocId,
          amountPaid: 1100,
        });

      expect(initRes.status).toBe(201);
      testVideoSessionId = initRes.body.data.sessionId;

      const acceptRes = await request(app)
        .post(`/api/v1/calls/${testVideoSessionId}/accept`)
        .set('Authorization', `Bearer ${panditToken}`);
      expect(acceptRes.status).toBe(200);

      const endRes = await request(app)
        .post(`/api/v1/calls/${testVideoSessionId}/end`)
        .set('Authorization', `Bearer ${panditToken}`)
        .send({ durationSeconds: 1200 });

      expect(endRes.status).toBe(200);
      expect(endRes.body.data.status).toBe('ended');
      expect(endRes.body.data.durationSeconds).toBe(1200);

      const sessionDoc = await CallSessionModel.findOne({ sessionId: testVideoSessionId });
      expect(sessionDoc?.amountPaid).toBe(1100);
      expect(sessionDoc?.panditEarnings).toBeCloseTo(935, 1); // 85% of 1100
      expect(sessionDoc?.commissionAmount).toBeCloseTo(165, 1); // 15% of 1100
    });

    it('4.6 User fetches call history via GET /api/v1/calls/history', async () => {
      const res = await request(app)
        .get('/api/v1/calls/history')
        .set('Authorization', `Bearer ${femaleToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    });

    it('4.7 Pandit fetches consultation call history via GET /api/v1/calls/pandit/history', async () => {
      const res = await request(app)
        .get('/api/v1/calls/pandit/history')
        .set('Authorization', `Bearer ${panditToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // SECTION 5: ADMIN PANEL CALLS MANAGEMENT & REAL-TIME OVERSIGHT
  // =========================================================================
  describe('5. Admin Panel Calls Management', () => {
    it('5.1 Admin fetches calls list with metrics via GET /api/v1/admin/calls', async () => {
      const res = await request(app)
        .get('/api/v1/admin/calls?filter=all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.stats).toBeDefined();

      const { stats } = res.body.data;
      expect(stats.totalCalls).toBeGreaterThanOrEqual(2);
      expect(stats.totalDuration).toBeGreaterThanOrEqual(1800);
      expect(stats.totalRevenue).toBeGreaterThanOrEqual(1601);
      expect(stats.totalPanditEarnings).toBeGreaterThanOrEqual(1360);
    });

    it('5.2 Admin filters calls by video only via GET /api/v1/admin/calls?filter=video', async () => {
      const res = await request(app)
        .get('/api/v1/admin/calls?filter=video')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.items.forEach((item: any) => {
        expect(item.callType).toBe('video');
      });
    });

    it('5.3 Admin updates call consultation pricing and rules in System Settings', async () => {
      const res = await request(app)
        .put('/api/v1/admin/system/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          audioConsultationPriceInr: 551,
          videoConsultationPriceInr: 1250,
          callCommissionRate: 20,
          maleFreeReplyToFemale: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in MongoDB
      const updatedSettings = await SystemSettingsModel.findOne({ key: 'global_settings' });
      expect(updatedSettings?.audioConsultationPriceInr).toBe(551);
      expect(updatedSettings?.videoConsultationPriceInr).toBe(1250);
      expect(updatedSettings?.callCommissionRate).toBe(20);
      expect(updatedSettings?.maleFreeReplyToFemale).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 6: PANDIT AVAILABILITY CONTROLS (AUDIO & VIDEO TOGGLES)
  // =========================================================================
  describe('6. Pandit Dashboard Call Availability Toggles', () => {
    it('6.1 Pandit toggles audio and video call availability', async () => {
      const res = await request(app)
        .patch('/api/v1/pandits/availability')
        .set('Authorization', `Bearer ${panditToken}`)
        .send({
          isAvailable: true,
          isAudioCallAvailable: false,
          isVideoCallAvailable: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const pandit = await PanditModel.findOne({ userId: panditUserId });
      expect(pandit?.isOnline).toBe(true);
      expect(pandit?.isAudioCallAvailable).toBe(false);
      expect(pandit?.isVideoCallAvailable).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 7: TWO-DEVICE REAL-TIME WEBRTC CALLING & SIGNALING TEST
  // =========================================================================
  describe('7. Two-Device Real-Time WebRTC Calling & Signaling Test', () => {
    let clientSocketA: ClientSocket;
    let clientSocketB: ClientSocket;
    let liveSessionId: string;

    beforeAll((done) => {
      let connectedCount = 0;
      const onConnect = () => {
        connectedCount++;
        if (connectedCount === 2) done();
      };

      // Device A (Female Devotee) connects to Socket.IO
      clientSocketA = Client(`http://localhost:${serverPort}`, {
        auth: { token: femaleToken },
        transports: ['websocket'],
      });
      clientSocketA.on('connect', onConnect);

      // Device B (Pandit) connects to Socket.IO
      clientSocketB = Client(`http://localhost:${serverPort}`, {
        auth: { token: panditToken },
        transports: ['websocket'],
      });
      clientSocketB.on('connect', onConnect);
    });

    afterAll(() => {
      clientSocketA?.disconnect();
      clientSocketB?.disconnect();
    });

    it('7.1 Both devices connect simultaneously to their private user rooms', () => {
      expect(clientSocketA.connected).toBe(true);
      expect(clientSocketB.connected).toBe(true);
    });

    it('7.2 Device A initiates call and Device B receives WebRTC Offer SDP', (done) => {
      liveSessionId = 'sess_live_' + Date.now();

      // Device B listens for WebRTC Offer
      clientSocketB.once('webrtc_offer', (data: any) => {
        expect(data.sessionId).toBe(liveSessionId);
        expect(data.fromUserId).toBe(femaleDevoteeId);
        expect(data.sdp).toBeDefined();
        expect(data.sdp.type).toBe('offer');
        expect(data.sdp.sdp).toBe('v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n');
        done();
      });

      // Device A emits WebRTC Offer targeted to Pandit
      clientSocketA.emit('webrtc_offer', {
        sessionId: liveSessionId,
        targetUserId: panditUserId,
        sdp: {
          type: 'offer',
          sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
        },
      });
    });

    it('7.3 Device B answers call and Device A receives WebRTC Answer SDP', (done) => {
      // Device A listens for WebRTC Answer
      clientSocketA.once('webrtc_answer', (data: any) => {
        expect(data.sessionId).toBe(liveSessionId);
        expect(data.fromUserId).toBe(panditUserId);
        expect(data.sdp).toBeDefined();
        expect(data.sdp.type).toBe('answer');
        expect(data.sdp.sdp).toBe('v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n');
        done();
      });

      // Device B emits WebRTC Answer targeted to Devotee
      clientSocketB.emit('webrtc_answer', {
        sessionId: liveSessionId,
        targetUserId: femaleDevoteeId,
        sdp: {
          type: 'answer',
          sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
        },
      });
    });

    it('7.4 WebRTC ICE Candidates are successfully exchanged between devices', (done) => {
      // Device B listens for ICE candidate
      clientSocketB.once('webrtc_ice_candidate', (data: any) => {
        expect(data.sessionId).toBe(liveSessionId);
        expect(data.fromUserId).toBe(femaleDevoteeId);
        expect(data.candidate.candidate).toBe('candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host');
        done();
      });

      // Device A emits ICE candidate
      clientSocketA.emit('webrtc_ice_candidate', {
        sessionId: liveSessionId,
        targetUserId: panditUserId,
        candidate: {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0,
        },
      });
    });

    it('7.5 Audio mute & video toggles are relayed in real time between devices', (done) => {
      // Device A listens for mute state changes from Device B
      clientSocketA.once('webrtc_mute_toggle', (data: any) => {
        expect(data.sessionId).toBe(liveSessionId);
        expect(data.fromUserId).toBe(panditUserId);
        expect(data.isMuted).toBe(true);
        expect(data.isVideoOff).toBe(false);
        done();
      });

      // Device B mutes microphone
      clientSocketB.emit('webrtc_mute_toggle', {
        sessionId: liveSessionId,
        targetUserId: femaleDevoteeId,
        isMuted: true,
        isVideoOff: false,
      });
    });
  });
});
