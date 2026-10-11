import request from 'supertest';
import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import { SocketService } from '../src/socket/socket.service';
import { TokenService } from '../src/services/token.service';
import { ProfileService } from '../src/services/profile.service';
import { inMemoryMatchStore } from '../src/services/interest.service';
import { UpsertProfileInput } from '@bandhansetu/shared';

describe('Secure Chat & Mutual Match Messaging Suite (/api/v1/conversations & Socket.IO)', () => {
  const app = createApp();
  let server: http.Server;
  let serverPort: number;

  // Test User 1 (Rohan - Matched Participant)
  const user1Id = 'usr_chat_user_1';
  const user1Token = TokenService.generateTokens({
    userId: user1Id,
    mobile: '9811100111',
    role: 'member',
  }).accessToken;

  // Test User 2 (Priya - Matched Participant)
  const user2Id = 'usr_chat_user_2';
  const user2Token = TokenService.generateTokens({
    userId: user2Id,
    mobile: '9811100222',
    role: 'member',
  }).accessToken;

  // Test User 3 (Unauthorized Stranger - No Match)
  const user3Id = 'usr_chat_stranger_3';
  const user3Token = TokenService.generateTokens({
    userId: user3Id,
    mobile: '9811100333',
    role: 'member',
  }).accessToken;

  let activeConversationId: string;

  beforeAll((done) => {
    server = http.createServer(app);
    SocketService.init(server);

    server.listen(0, () => {
      const addr = server.address() as any;
      serverPort = addr.port;
      done();
    });

    // Seed test profiles
    const rohanProfile: UpsertProfileInput = {
      firstName: 'Rohan',
      lastName: 'Mehra',
      gender: 'male',
      dateOfBirth: '1996-04-12',
      maritalStatus: 'never_married',
      heightCm: 178,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      caste: 'Khatri',
      gotra: 'Kashyap',
      manglik: 'no',
      country: 'India',
      state: 'Delhi',
      city: 'Delhi NCR',
      familyValues: 'moderate',
      familyType: 'nuclear',
      education: 'B.Tech',
      employedIn: 'private',
      occupation: 'Software Architect',
      annualIncomeBand: '₹25L - ₹35L',
      showIncomeBand: true,
      photoPrivacy: 'everyone',
      aboutMe: 'Software architect looking for a life partner with shared values.',
      photos: [],
    };

    const priyaProfile: UpsertProfileInput = {
      firstName: 'Priya',
      lastName: 'Sharma',
      gender: 'female',
      dateOfBirth: '1998-05-14',
      maritalStatus: 'never_married',
      heightCm: 165,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      caste: 'Brahmin',
      gotra: 'Bharadwaj',
      manglik: 'no',
      country: 'India',
      state: 'Delhi',
      city: 'Delhi NCR',
      familyValues: 'moderate',
      familyType: 'nuclear',
      education: 'MBA',
      employedIn: 'private',
      occupation: 'Product Manager',
      annualIncomeBand: '₹15L - ₹25L',
      showIncomeBand: true,
      photoPrivacy: 'everyone',
      aboutMe: 'Product manager in Delhi NCR looking for a family oriented partner.',
      photos: [],
    };

    ProfileService.upsertMyProfile(user1Id, rohanProfile);
    ProfileService.upsertMyProfile(user2Id, priyaProfile);

    // Seed mutual match ONLY between User 1 and User 2 (User 3 has NO match)
    inMemoryMatchStore.push({
      id: 'match_rohan_priya_101',
      user1Id,
      user2Id,
      interestId: 'interest_101',
      createdAt: new Date(),
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('1. Mutual Match Access Control (/api/v1/conversations)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/conversations');
      expect(res.status).toBe(401);
    });

    it('should reject conversation creation if NO mutual match exists (403 NO_MUTUAL_MATCH)', async () => {
      // User 3 tries to start conversation with User 2 without a mutual match
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user3Token}`)
        .send({ participantId: user2Id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NO_MUTUAL_MATCH');
    });

    it('should reject self-conversation with 400', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user1Id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_CONVERSATION_PROHIBITED');
    });

    it('should allow conversation creation between verified mutual matches (201)', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.participant.displayName).toBe('Priya S.');
      expect(res.body.data.contactExchange.status).toBe('none');

      activeConversationId = res.body.data.id;
    });

    it('should retrieve existing conversation idempotently without duplicates', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ participantId: user1Id });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(activeConversationId);
    });

    it('should list conversations for authenticated user with contact info masked', async () => {
      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const conv = res.body.data.find((c: any) => c.id === activeConversationId);
      expect(conv).toBeDefined();
      expect(conv.participant.displayName).toBe('Priya S.');
      // Ensure phone & email are strictly NOT disclosed yet
      expect(conv.contactExchange.phone).toBeUndefined();
      expect(conv.contactExchange.email).toBeUndefined();
    });
  });

  describe('2. Message Sending, Ownership & Pagination', () => {
    it('should reject non-participant from viewing messages (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${user3Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject non-participant from sending a message (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${user3Token}`)
        .send({ text: 'Hello, this is a stranger' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject empty or whitespace-only messages with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ text: '    ' });

      expect(res.status).toBe(400);
    });

    it('should allow participant to send message with status sent (201)', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ text: 'Namaste Priya! Glad to connect on BandhanSetu.' });

      expect(res.status).toBe(201);
      expect(res.body.data.text).toBe('Namaste Priya! Glad to connect on BandhanSetu.');
      expect(res.body.data.status).toBe('sent');
      expect(res.body.data.senderId).toBe(user1Id);
    });

    it('should return paginated message history with pagination metadata', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${activeConversationId}/messages?page=1&limit=10`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. Read Receipts (PATCH /api/v1/conversations/:id/read)', () => {
    it('should mark unread messages as read for the receiver', async () => {
      const res = await request(app)
        .patch(`/api/v1/conversations/${activeConversationId}/read`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify message status is updated to read
      const checkRes = await request(app)
        .get(`/api/v1/conversations/${activeConversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`);

      const latestMsg = checkRes.body.data.items[0];
      expect(latestMsg.status).toBe('read');
    });
  });

  describe('4. Verified Contact Exchange & Privacy Workflow', () => {
    it('should allow user 1 to request contact sharing', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/contact-request`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ action: 'request' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('requested');
      expect(res.body.data.phone).toBeUndefined(); // Still locked!
    });

    it('should reject user 1 from accepting their own contact request (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/contact-request`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ action: 'accept' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_ACCEPT_OWN_REQUEST');
    });

    it('should reject third party from accepting contact request (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/contact-request`)
        .set('Authorization', `Bearer ${user3Token}`)
        .send({ action: 'accept' });

      expect(res.status).toBe(403);
    });

    it('should allow recipient (user 2) to accept contact share and unlock numbers', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${activeConversationId}/contact-request`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ action: 'accept' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('accepted');
      expect(res.body.data.phone).toBeDefined(); // Verified contact details unlocked!
    });
  });

  describe('5. Real-Time Socket.IO Handshake & Authorization', () => {
    it('should reject socket connection without authentication token', (done) => {
      const client = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/Authentication/i);
        client.close();
        done();
      });

      client.on('connect', () => {
        client.close();
        done(new Error('Should not have connected without token'));
      });
    });

    it('should successfully authenticate socket connection with valid JWT token', (done) => {
      const client = Client(`http://localhost:${serverPort}`, {
        auth: { token: user1Token },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.close();
        done();
      });

      client.on('connect_error', (err) => {
        done(err);
      });
    });

    it('should reject socket from joining unauthorized conversation room', (done) => {
      const client = Client(`http://localhost:${serverPort}`, {
        auth: { token: user3Token }, // user3 has NO membership in activeConversationId
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('connect', () => {
        client.emit(
          'join_conversation',
          { conversationId: activeConversationId },
          (response: any) => {
            expect(response.success).toBe(false);
            client.close();
            done();
          }
        );
      });

      client.on('error_event', (err) => {
        expect(err.code).toBe('FORBIDDEN');
      });
    });

    it('should allow authorized participant to join conversation room', (done) => {
      const client = Client(`http://localhost:${serverPort}`, {
        auth: { token: user1Token },
        transports: ['websocket'],
        reconnection: false,
      });

      client.on('connect', () => {
        client.emit(
          'join_conversation',
          { conversationId: activeConversationId },
          (response: any) => {
            expect(response.success).toBe(true);
            client.close();
            done();
          }
        );
      });
    });
  });
});
