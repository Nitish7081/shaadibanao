import crypto from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { PanditModel } from '../src/models/pandit.model';
import { BookingModel } from '../src/models/booking.model';
import { MembershipModel } from '../src/models/membership.model';
import { ConversationModel } from '../src/models/conversation.model';
import { MessageModel } from '../src/models/message.model';
import { NotificationModel } from '../src/models/notification.model';
import { SystemSettingsModel } from '../src/models/system-settings.model';
import { TokenService } from '../src/services/token.service';

describe('MASTER TEST SUITE: Pandit Registration, Admin Management, Astrology & Free/Paid Chat', () => {
  let mongod: MongoMemoryServer;
  let app: any;

  // Tokens & User IDs
  let adminUserId: string;
  let adminToken: string;

  let panditUserId: string;
  let panditUserToken: string;

  let femaleUserId: string;
  let femaleToken: string;

  let maleUserId: string;
  let maleToken: string;

  let devoteeUserId: string;
  let devoteeToken: string;

  let createdPanditMongoId: string;
  let createdPanditUniqueId: string;
  let approvedPanditMongoId: string;

  let bookingId: string;
  let conversationId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    app = createApp();

    // 1. Admin Account
    adminUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(adminUserId),
      mobile: '9876543210',
      role: 'admin',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
    });
    adminToken = TokenService.generateTokens({
      userId: adminUserId,
      email: 'admin@shaadibanao.com',
      mobile: '9876543210',
      role: 'admin',
    }).accessToken;

    // 2. Pandit Registrant User Account
    panditUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(panditUserId),
      mobile: '9876500001',
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
      displayName: 'Pandit Ramesh Shastri',
    });
    panditUserToken = TokenService.generateTokens({
      userId: panditUserId,
      mobile: '9876500001',
      role: 'member',
    }).accessToken;

    // 3. Female Member Account
    femaleUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(femaleUserId),
      mobile: '9811122233',
      role: 'member',
      gender: 'female',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
      displayName: 'Pooja Sharma',
    });
    await ProfileModel.create({
      userId: new mongoose.Types.ObjectId(femaleUserId),
      firstName: 'Pooja',
      lastName: 'Sharma',
      gender: 'female',
      dateOfBirth: new Date('1998-05-15'),
      maritalStatus: 'never_married',
      heightCm: 162,
      motherTongue: 'Hindi',
      religion: 'hindu',
      caste: 'Brahmin',
      country: 'India',
      state: 'Delhi',
      city: 'New Delhi',
      education: 'B.Tech',
      employedIn: 'private',
      occupation: 'Software Engineer',
      aboutMe: 'Looking for a cultured partner.',
      completenessPercent: 90,
      isVerified: true,
      photos: [],
    });
    femaleToken = TokenService.generateTokens({
      userId: femaleUserId,
      mobile: '9811122233',
      role: 'member',
    }).accessToken;

    // 4. Male Member Account
    maleUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(maleUserId),
      mobile: '9822233344',
      role: 'member',
      gender: 'male',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
      displayName: 'Rahul Verma',
    });
    await ProfileModel.create({
      userId: new mongoose.Types.ObjectId(maleUserId),
      firstName: 'Rahul',
      lastName: 'Verma',
      gender: 'male',
      dateOfBirth: new Date('1995-08-20'),
      maritalStatus: 'never_married',
      heightCm: 175,
      motherTongue: 'Hindi',
      religion: 'hindu',
      caste: 'Kayastha',
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Noida',
      education: 'MBA',
      employedIn: 'private',
      occupation: 'Product Manager',
      aboutMe: 'Simple and family-oriented person.',
      completenessPercent: 90,
      isVerified: true,
      photos: [],
    });
    maleToken = TokenService.generateTokens({
      userId: maleUserId,
      mobile: '9822233344',
      role: 'member',
    }).accessToken;

    // 5. Devotee Account for Pandit & Astrology
    devoteeUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(devoteeUserId),
      mobile: '9833344455',
      role: 'member',
      gender: 'male',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
      displayName: 'Amit Devotee',
    });
    await ProfileModel.create({
      userId: new mongoose.Types.ObjectId(devoteeUserId),
      firstName: 'Amit',
      lastName: 'Devotee',
      gender: 'male',
      dateOfBirth: new Date('1992-03-10'),
      maritalStatus: 'never_married',
      heightCm: 170,
      motherTongue: 'Hindi',
      religion: 'hindu',
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Varanasi',
      education: 'B.Com',
      employedIn: 'business',
      occupation: 'Trader',
      aboutMe: 'Devoted person seeking ceremonies.',
      completenessPercent: 85,
      isVerified: true,
      photos: [],
    });
    devoteeToken = TokenService.generateTokens({
      userId: devoteeUserId,
      mobile: '9833344455',
      role: 'member',
    }).accessToken;

    // 6. Initialize System Settings
    await SystemSettingsModel.create({
      key: 'global_settings',
      femaleFreeChatEnabled: true,
      malePaidChatRequired: true,
      maleFreeMessageLimit: 0,
      plusPlanPriceInr: 2999,
      premiumPlanPriceInr: 4999,
      defaultPanditConsultationFee: 501,
      defaultAstrologyFee: 501,
      maxMessageLength: 1000,
      bannedKeywords: ['abuse', 'fraud', 'scam', 'money transfer'],
      supportPhone: '8076168502',
      supportEmail: 'shaadibanao.urbanpower@gmail.com',
      supportWhatsApp: '8076168502',
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  // ==========================================
  // SECTION 1: PANDIT REGISTRATION SYSTEM
  // ==========================================
  describe('1. Pandit Registration System', () => {
    it('should register a new pandit with complete details, generate unique panditId, and notify admin', async () => {
      const regPayload = {
        name: 'Pandit Ramesh Shastri',
        mobile: '9876500001',
        email: 'ramesh.shastri@shaadibanao.com',
        gender: 'male',
        dateOfBirth: '1980-04-12',
        address: {
          street: '108, Mandir Marg, Sector 12',
          city: 'Varanasi',
          state: 'Uttar Pradesh',
          pincode: '221001',
        },
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        experienceYears: 15,
        specialization: ['Vivah Puja', 'Griha Pravesh', 'Rudrabhishek', 'Kundli Milan'],
        languages: ['Hindi', 'Sanskrit'],
        offersAstrology: true,
        astrologyExpertise: ['Vedic Astrology', 'Kundli Milan', 'Vivah Muhurat'],
        consultationCharges: 501,
        bankDetails: {
          accountNumber: '123456789012',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          upiId: 'shastri@upi',
        },
      };

      const res = await request(app)
        .post('/api/v1/pandits/register')
        .set('Authorization', `Bearer ${panditUserToken}`)
        .send(regPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.panditId).toMatch(/^PND-\d{4}-[A-Z0-9]+$/);
      expect(res.body.data.verificationStatus).toBe('pending');

      createdPanditMongoId = res.body.data._id || res.body.data.id;
      createdPanditUniqueId = res.body.data.panditId;

      // Verify Admin received in-app notification in DB
      const adminNotif = await NotificationModel.findOne({
        type: 'admin_broadcast',
      });
      expect(adminNotif).toBeTruthy();
      expect(adminNotif?.body).toContain('Pandit Ramesh Shastri');
    });

    it('should prevent duplicate pandit registration with same user or mobile', async () => {
      const res = await request(app)
        .post('/api/v1/pandits/register')
        .set('Authorization', `Bearer ${panditUserToken}`)
        .send({
          name: 'Duplicate Pandit',
          mobile: '9876500001',
          city: 'Varanasi',
          state: 'Uttar Pradesh',
        });

      expect(res.status).toBe(409);
      expect(res.body.error?.code || res.body.code).toBe('PANDIT_ALREADY_EXISTS');
    });
  });

  // ==========================================
  // SECTION 2: PANDIT MANAGEMENT IN ADMIN PANEL
  // ==========================================
  describe('2. Pandit Management in Admin Panel', () => {
    it('should list pandits across filter sections: all, pending, new_registrations', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pandits?section=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.items.find(
        (p: any) => (p.id === createdPanditMongoId || p._id === createdPanditMongoId)
      );
      expect(found).toBeTruthy();
      expect(found.panditId).toBe(createdPanditUniqueId);
    });

    it('should support searching pandits by name, phone, city, or unique panditId', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/pandits?search=${createdPanditUniqueId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].panditId).toBe(createdPanditUniqueId);
    });

    it('should allow admin to request additional documents from the pandit', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/pandits/${createdPanditMongoId}/request-docs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ documents: ['Aadhaar Card Front & Back', 'Vedic Certificate'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await PanditModel.findById(createdPanditMongoId);
      expect(updated?.verificationStatus).toBe('under_review');
      expect(updated?.requestedDocuments).toContain('Aadhaar Card Front & Back');
    });

    it('should allow admin to reject a pandit with a reason', async () => {
      const tempPandit = await PanditModel.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Unverified Shastri',
        phone: '9876500002',
        mobile: '9876500002',
        city: 'Haridwar',
        state: 'Uttarakhand',
        experienceYears: 2,
        verificationStatus: 'pending',
      });

      const res = await request(app)
        .post(`/api/v1/admin/pandits/${tempPandit._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Invalid identity documents provided.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await PanditModel.findById(tempPandit._id);
      expect(check?.verificationStatus).toBe('rejected');
      expect(check?.rejectionReason).toBe('Invalid identity documents provided.');
    });

    it('should allow admin to approve a pandit, activating their status', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/pandits/${createdPanditMongoId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await PanditModel.findById(createdPanditMongoId);
      expect(check?.verificationStatus).toBe('approved');
      expect(check?.isActive).toBe(true);

      approvedPanditMongoId = createdPanditMongoId;
    });

    it('should allow admin to toggle active status', async () => {
      const toggleRes = await request(app)
        .post(`/api/v1/admin/pandits/${approvedPanditMongoId}/toggle-active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.isActive).toBe(false);

      // Re-activate
      await request(app)
        .post(`/api/v1/admin/pandits/${approvedPanditMongoId}/toggle-active`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });
    });
  });

  // ==========================================
  // SECTION 3: PANDIT APPROVAL & SERVICE ACCESS
  // ==========================================
  describe('3. Pandit Approval and Service Access', () => {
    it('unapproved pandits must NOT appear in public verified pandit listings', async () => {
      await PanditModel.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Hidden Unapproved Pandit',
        phone: '9876500003',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        experienceYears: 3,
        verificationStatus: 'pending',
        isActive: false,
      });

      const res = await request(app).get('/api/v1/pandits');
      expect(res.status).toBe(200);

      const names = res.body.data.items.map((p: any) => p.name);
      expect(names).not.toContain('Hidden Unapproved Pandit');
      expect(names).toContain('Pandit Ramesh Shastri');
    });

    it('approved pandit can update online/offline availability', async () => {
      const res = await request(app)
        .patch(`/api/v1/pandits/me/availability`)
        .set('Authorization', `Bearer ${panditUserToken}`)
        .send({ isOnline: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOnline).toBe(true);
    });
  });

  // ==========================================
  // SECTION 4: BOOK MY PANDIT & ASSIGNMENT
  // ==========================================
  describe('4. Book My Pandit - Booking Creation & Admin Assignment', () => {
    it('devotee creates a booking request which appears in admin panel and notifies admin', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({
          ceremonyType: 'vivah_puja',
          serviceName: 'Vedic Vivah Puja',
          bookingDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
          timeSlot: '10:00 AM',
          venueAddress: 'Grand Vivah Mandap, Civil Lines',
          city: 'Varanasi',
          state: 'Uttar Pradesh',
          notes: 'Vedic Vivah ceremony with Hawan',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('requested');

      bookingId = res.body.data.id || res.body.data._id;

      // Verify booking appears in Admin Bookings list
      const adminBookingsRes = await request(app)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminBookingsRes.status).toBe(200);
      const found = adminBookingsRes.body.data.items.find(
        (b: any) => b.id === bookingId || b._id === bookingId
      );
      expect(found).toBeTruthy();
      expect(found.ceremonyType).toBe('vivah_puja');
    });

    it('admin assigns an approved pandit to the booking, updating status to accepted', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/bookings/${bookingId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ panditId: approvedPanditMongoId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('accepted');
      expect(res.body.data.panditId.toString()).toBe(approvedPanditMongoId);

      // Verify Pandit marked as assigned
      const assignedPandit = await PanditModel.findById(approvedPanditMongoId);
      expect(assignedPandit?.isAssigned).toBe(true);

      // Verify Devotee received assignment in-app notification
      const devoteeNotif = await NotificationModel.findOne({
        userId: new mongoose.Types.ObjectId(devoteeUserId),
        type: 'pandit_assigned',
      });
      expect(devoteeNotif).toBeTruthy();
    });

    it('prevent assigning unapproved, rejected, or inactive pandit to booking', async () => {
      const bRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({
          ceremonyType: 'griha_pravesh',
          serviceName: 'Griha Pravesh Puja',
          bookingDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
          timeSlot: '09:00 AM',
          venueAddress: 'House 42, Varanasi',
          city: 'Varanasi',
        });

      const newBookingId = bRes.body.data.id || bRes.body.data._id;

      const unapprovedPandit = await PanditModel.create({
        userId: new mongoose.Types.ObjectId(),
        name: 'Rejected Pandit',
        phone: '9876500004',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        verificationStatus: 'rejected',
        isActive: false,
      });

      const assignRes = await request(app)
        .post(`/api/v1/admin/bookings/${newBookingId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ panditId: unapprovedPandit._id.toString() });

      expect(assignRes.status).toBe(400);
      expect(assignRes.body.error?.code || assignRes.body.code).toBe('PANDIT_NOT_ELIGIBLE');
    });
  });

  // ==========================================
  // SECTION 5: ASTROLOGY CONSULTATION SYSTEM
  // ==========================================
  describe('5. Astrology Consultation System', () => {
    it('customer browses approved astrologers via GET /api/v1/astrology/astrologers', async () => {
      const res = await request(app).get('/api/v1/astrology/astrologers');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = res.body.data.items || res.body.data.astrologers;
      expect(list.length).toBeGreaterThanOrEqual(1);

      const astro = list.find((a: any) => a.id === approvedPanditMongoId);
      expect(astro).toBeTruthy();
      expect(astro.offersAstrology).toBe(true);
      expect(astro.astrologyExpertise).toContain('Vedic Astrology');
    });

    it('customer books an astrology consultation via POST /api/v1/astrology/consultations', async () => {
      const res = await request(app)
        .post('/api/v1/astrology/consultations')
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({
          astrologerId: approvedPanditMongoId,
          type: 'astrology',
          topic: 'Kundli Milan & Vivah Muhurat Guidance',
          bookingDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
          timeSlot: '11:00 AM',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('requested');
      expect(res.body.data.ceremonyType).toBe('kundli_milan');
    });
  });

  // ==========================================
  // SECTION 6: FREE FEMALE-TO-MALE CHAT
  // ==========================================
  describe('6. Free Female-to-Male Chat Feature', () => {
    it('female user can initiate conversation and send messages to male user completely free (0 plan / 0 coins)', async () => {
      // Female initiates conversation
      const convRes = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({ participantId: maleUserId });

      expect([200, 201]).toContain(convRes.status);
      expect(convRes.body.success).toBe(true);
      expect(convRes.body.data.isFreeChat).toBe(true);

      conversationId = convRes.body.data.id || convRes.body.data._id;

      // Female sends message
      const msgRes = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({ text: 'नमस्ते Rahul, आपकी शादी बनाओ प्रोफाइल देखी। क्या हम बात कर सकते हैं?' });

      expect(msgRes.status).toBe(201);
      expect(msgRes.body.success).toBe(true);
      expect(msgRes.body.data.isFreeChat).toBe(true);
      expect(msgRes.body.data.text).toContain('नमस्ते Rahul');

      // Verify in DB that isFreeChat flag is stored
      const msgInDb = await MessageModel.findById(msgRes.body.data.id);
      expect(msgInDb?.isFreeChat).toBe(true);
    });
  });

  // ==========================================
  // SECTION 7: MALE USER PAID CHAT & PLAN SYSTEM
  // ==========================================
  describe('7. Male User Paid Chat & Plan Enforcement', () => {
    it('unsubscribed male user is blocked with HTTP 402 SUBSCRIPTION_REQUIRED', async () => {
      const msgRes = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${maleToken}`)
        .send({ text: 'Hello Pooja, I am interested!' });

      expect(msgRes.status).toBe(402);
      expect(msgRes.body.error?.code || msgRes.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('male user can create a payment order for Plus Plan (₹2,999)', async () => {
      const orderRes = await request(app)
        .post('/api/v1/membership/order')
        .set('Authorization', `Bearer ${maleToken}`)
        .send({ planId: 'plus' });

      expect(orderRes.status).toBe(200);
      expect(orderRes.body.success).toBe(true);
      expect(orderRes.body.data.orderId).toBeTruthy();
      expect(orderRes.body.data.amountInr).toBe(2999);
      expect(orderRes.body.data.planId).toBe('plus');
    });

    it('male user completes payment verification, activates Plus plan, and can now chat', async () => {
      const orderId = 'order_test_12345';
      const paymentId = 'pay_test_99999';
      const secret = process.env.RAZORPAY_KEY_SECRET || 'bandhansetu_razorpay_secret_live';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const verifyRes = await request(app)
        .post('/api/v1/membership/verify')
        .set('Authorization', `Bearer ${maleToken}`)
        .send({
          orderId,
          paymentId,
          signature,
          planId: 'plus',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.planId).toBe('plus');
      expect(verifyRes.body.data.status).toBe('active');
      expect(verifyRes.body.data.entitlements.canInitiateChat).toBe(true);

      // Now male user can send messages without 402
      const msgRes = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${maleToken}`)
        .send({ text: 'नमस्ते Pooja, बहुत खुशी हुई आपसे बात करके!' });

      expect(msgRes.status).toBe(201);
      expect(msgRes.body.success).toBe(true);
      expect(msgRes.body.data.planTier).toBe('plus');
    });
  });

  // ==========================================
  // SECTION 8: CHAT MODERATION & READ RECEIPTS
  // ==========================================
  describe('8. Chat Moderation & Message Lifecycle', () => {
    it('should reject messages exceeding maximum character limit (1000 chars)', async () => {
      const longText = 'A'.repeat(1050);
      const res = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({ text: longText });

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBeTruthy();
    });

    it('should reject messages containing prohibited or scam keywords', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${femaleToken}`)
        .send({ text: 'Please send urgent money transfer now.' });

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('CONTENT_POLICY_VIOLATION');
    });

    it('receiver can mark messages as read via PATCH /api/v1/conversations/:id/read', async () => {
      const res = await request(app)
        .patch(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${femaleToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================
  // SECTION 9: ADMIN CHAT MANAGEMENT & USER BLOCK
  // ==========================================
  describe('9. Admin Chat Management & Abusive User Blocking', () => {
    it('admin can list all conversations with metrics via GET /api/v1/admin/chat/conversations', async () => {
      const res = await request(app)
        .get('/api/v1/admin/chat/conversations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversations.length).toBeGreaterThanOrEqual(1);

      const conv = res.body.data.conversations.find((c: any) => c.id === conversationId);
      expect(conv).toBeTruthy();
      expect(conv.messageCount).toBeGreaterThanOrEqual(2);
    });

    it('admin can block an abusive user from chatting, preventing any further messages', async () => {
      const blockRes = await request(app)
        .post(`/api/v1/admin/chat/users/${maleUserId}/block-chat`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isBlocked: true,
          reason: 'Violation of user safety policy and inappropriate behavior.',
        });

      expect(blockRes.status).toBe(200);
      expect(blockRes.body.data.isChatBlocked).toBe(true);

      // Blocked male user attempts to send message -> rejected with 403
      const msgRes = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${maleToken}`)
        .send({ text: 'Trying to send message while blocked.' });

      expect(msgRes.status).toBe(403);
      expect(msgRes.body.error?.code || msgRes.body.code).toBe('ACCOUNT_CHAT_BLOCKED');

      // Admin unblocks user
      await request(app)
        .post(`/api/v1/admin/chat/users/${maleUserId}/block-chat`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isBlocked: false });

      const unblockedUser = await UserModel.findById(maleUserId);
      expect(unblockedUser?.isChatBlocked).toBe(false);
    });
  });

  // ==========================================
  // SECTION 10: DYNAMIC SETTINGS WITHOUT RESTART
  // ==========================================
  describe('10. Admin Dynamic System Settings Control', () => {
    it('admin can update dynamic system settings via PUT /api/v1/admin/system/settings', async () => {
      const newSettings = {
        femaleFreeChatEnabled: true,
        malePaidChatRequired: true,
        plusPlanPriceInr: 3499,
        premiumPlanPriceInr: 5999,
        defaultPanditConsultationFee: 701,
        supportPhone: '8076168502',
        supportEmail: 'shaadibanao.urbanpower@gmail.com',
        supportWhatsApp: '8076168502',
      };

      const putRes = await request(app)
        .put('/api/v1/admin/system/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSettings);

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.plusPlanPriceInr).toBe(3499);
      expect(putRes.body.data.premiumPlanPriceInr).toBe(5999);

      // Verify that membership plans immediately reflect the dynamic prices without server restart!
      const plansRes = await request(app).get('/api/v1/membership/plans');
      expect(plansRes.status).toBe(200);

      const plusPlan = plansRes.body.data.find((p: any) => p.id === 'plus');
      const premiumPlan = plansRes.body.data.find((p: any) => p.id === 'premium');

      expect(plusPlan.priceInr).toBe(3499);
      expect(premiumPlan.priceInr).toBe(5999);
    });
  });
});
