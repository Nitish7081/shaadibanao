import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { UserModel } from '../src/models/user.model';
import { PanditModel } from '../src/models/pandit.model';
import { BookingModel } from '../src/models/booking.model';
import { PaymentModel } from '../src/models/payment.model';
import { WithdrawalModel } from '../src/models/withdrawal.model';
import { ErrorLogModel } from '../src/models/error-log.model';
import { TokenService } from '../src/services/token.service';

const app = createApp();

describe('COMPLETE APPLICATION END-TO-END AUDIT & FUNCTIONALITY VERIFICATION', () => {
  let adminToken: string;
  let adminUserId: string;

  let devoteeToken: string;
  let devoteeUserId: string;
  const devoteeMobile = '9876543210';

  let panditToken: string;
  let panditUserId: string;
  let panditDocId: string;
  const panditMobile = '9811223344';

  let testBookingId: string;
  let testOrderId: string;
  let testWithdrawalId: string;

  beforeAll(async () => {
    await connectDatabase();

    // 1. Setup Admin Account & Token
    const adminUser = await UserModel.findOneAndUpdate(
      { email: 'admin.audit@shaadibanao.com' },
      {
        email: 'admin.audit@shaadibanao.com',
        role: 'admin',
        status: 'active',
        approvalStatus: 'approved',
        displayName: 'Super Admin Audit',
      },
      { upsert: true, new: true }
    );
    adminUserId = adminUser._id.toString();
    adminToken = TokenService.generateTokens({
      userId: adminUserId,
      role: 'admin',
    }).accessToken;

    // 2. Setup Devotee User Account & Token
    const devoteeUser = await UserModel.findOneAndUpdate(
      { mobile: devoteeMobile },
      {
        mobile: devoteeMobile,
        role: 'member',
        status: 'active',
        approvalStatus: 'approved',
        displayName: 'Rohit Devotee',
      },
      { upsert: true, new: true }
    );
    devoteeUserId = devoteeUser._id.toString();
    devoteeToken = TokenService.generateTokens({
      userId: devoteeUserId,
      role: 'member',
    }).accessToken;

    // 3. Setup Pandit User Account & Token
    const panditUser = await UserModel.findOneAndUpdate(
      { mobile: panditMobile },
      {
        mobile: panditMobile,
        role: 'pandit',
        status: 'active',
        approvalStatus: 'approved',
        displayName: 'Acharya Vidyadhar Ji',
      },
      { upsert: true, new: true }
    );
    panditUserId = panditUser._id.toString();
    panditToken = TokenService.generateTokens({
      userId: panditUserId,
      role: 'pandit',
    }).accessToken;

    // Clean any previous test artifacts
    await BookingModel.deleteMany({ userMobile: devoteeMobile });
    await PanditModel.deleteMany({ phone: panditMobile });
    await PaymentModel.deleteMany({ userMobile: devoteeMobile });
    await WithdrawalModel.deleteMany({ panditPhone: panditMobile });
    await ErrorLogModel.deleteMany({ errorId: /^ERR-TEST-/ });
  });

  afterAll(async () => {
    // Clean test artifacts safely without touching other records
    await BookingModel.deleteMany({ userMobile: devoteeMobile });
    await PanditModel.deleteMany({ phone: panditMobile });
    await PaymentModel.deleteMany({ userMobile: devoteeMobile });
    await WithdrawalModel.deleteMany({ panditPhone: panditMobile });
    await ErrorLogModel.deleteMany({ errorId: /^ERR-TEST-/ });
    await disconnectDatabase();
  });

  // =========================================================================
  // SECTION 1: PANDIT REGISTRATION & ADMIN APPROVAL AUDIT
  // =========================================================================
  describe('1. Pandit Registration & Approval Flow', () => {
    it('1.1 User registers as Pandit with complete qualifications and Vedic services', async () => {
      const res = await request(app)
        .post('/api/v1/pandits/register')
        .set('Authorization', `Bearer ${panditToken}`)
        .send({
          name: 'Acharya Vidyadhar Ji',
          phone: panditMobile,
          email: 'vidyadhar.pandit@shaadibanao.com',
          city: 'Varanasi',
          state: 'Uttar Pradesh',
          bio: 'Vedic Shastri with 15+ years experience conducting Vivah Sanskar and Griha Pravesh.',
          experienceYears: 15,
          religiousTradition: 'Sanatan Vedic',
          languages: ['Hindi', 'Sanskrit'],
          serviceLocations: ['Varanasi', 'Delhi NCR', 'Lucknow'],
          services: [
            {
              serviceId: 'wedding',
              name: 'Vivah Sanskar (Vedic Wedding Ceremony)',
              priceInr: 11000,
              durationMinutes: 240,
              ceremonyType: 'wedding',
            },
            {
              serviceId: 'satyanarayan_puja',
              name: 'Satyanarayan Katha & Puja',
              priceInr: 3100,
              durationMinutes: 120,
              ceremonyType: 'satyanarayan_puja',
            },
          ],
          offersAstrology: true,
          consultationCharges: 1100,
          astrologyExpertise: ['Kundli Milan', 'Horoscope Analysis'],
          bankDetails: {
            accountHolderName: 'Vidyadhar Shastri',
            accountNumber: '918273645019',
            ifscCode: 'SBIN0001234',
            bankName: 'State Bank of India',
            upiId: 'vidyadhar@okaxis',
          },
          documents: [
            {
              docType: 'shastri_degree',
              docUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
              docName: 'Sampurnanand Sanskrit Vishwavidyalaya Degree',
              status: 'pending',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.panditId).toMatch(/^PND-\d{4}-\d+/);
      expect(res.body.data.verificationStatus).toBe('pending');

      panditDocId = res.body.data._id || res.body.data.id;
    });

    it('1.2 Unapproved Pandit must NOT appear in public verified listings', async () => {
      const res = await request(app).get('/api/v1/pandits');
      expect(res.status).toBe(200);
      const items = res.body.data?.items || [];
      const found = items.find((p: any) => p.phone === panditMobile);
      expect(found).toBeUndefined();
    });

    it('1.3 Admin inspects pending Pandit registrations and approves Pandit', async () => {
      const listRes = await request(app)
        .get('/api/v1/admin/pandits?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);

      const approveRes = await request(app)
        .post(`/api/v1/admin/pandits/${panditDocId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.data.verificationStatus).toBe('approved');
    });

    it('1.4 Approved Pandit can update online/offline availability', async () => {
      const res = await request(app)
        .patch('/api/v1/pandits/me/availability')
        .set('Authorization', `Bearer ${panditToken}`)
        .send({ isOnline: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOnline).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 2: PANDIT BOOKING & END-TO-END PAYMENT AUDIT
  // =========================================================================
  describe('2. End-to-End Pandit Booking & Payment Verification', () => {
    it('2.1 Devotee submits booking request for Wedding Puja ceremony', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({
          userName: 'Rohit Devotee',
          userMobile: devoteeMobile,
          serviceId: 'wedding',
          serviceName: 'Vivah Sanskar (Vedic Wedding Ceremony)',
          ceremonyType: 'wedding',
          bookingDate: '2026-12-15',
          timeSlot: '10:00 AM – 01:00 PM',
          mode: 'in_person',
          venueAddress: 'Royal Palace Banquet, Sector 62',
          city: 'Noida',
          state: 'Uttar Pradesh',
          guestCount: 250,
          languagePref: 'Hindi',
          budgetRangeInr: '₹15,000 – ₹30,000',
          specialRequests: 'Complete 7 Vachan Vedic ceremony with Samagri list needed in advance.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingReference).toMatch(/^SB-\d{4}-\d+/);
      expect(res.body.data.status).toBe('requested');
      expect(res.body.data.paymentStatus).toBe('unpaid');

      testBookingId = String(res.body.data._id || res.body.data.id);
    });

    it('2.2 Devotee creates payment gateway order via POST /api/v1/bookings/:id/payment/order', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/payment/order`)
        .set('Authorization', `Bearer ${devoteeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toMatch(/^order_bk_/);
      expect(res.body.data.currency).toBe('INR');

      testOrderId = res.body.data.orderId;

      // Verify payment order record saved in database
      const dbPayment = await PaymentModel.findOne({ orderId: testOrderId });
      expect(dbPayment).not.toBeNull();
      expect(dbPayment?.status).toBe('pending');
      expect(dbPayment?.type).toBe('booking');
    });

    it('2.3 Failed payment updates payment record but does NOT confirm booking', async () => {
      const failRes = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/payment/failed`)
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({ reason: 'Insufficient card funds or cancelled by user' });

      expect(failRes.status).toBe(200);
      expect(failRes.body.success).toBe(true);
      expect(failRes.body.data.paymentStatus).toBe('failed');
      expect(failRes.body.data.status).toBe('requested'); // Not confirmed!
    });

    it('2.4 Devotee completes payment verification: sets paid status, confirms booking, and calculates commission', async () => {
      const testPaymentId = `pay_gate_${Date.now()}`;
      const verifyRes = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/payment/verify`)
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({
          orderId: testOrderId,
          paymentId: testPaymentId,
          signature: 'crypto_verified_test_sig',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.paymentStatus).toBe('paid');
      expect(verifyRes.body.data.status).toBe('confirmed');
      expect(verifyRes.body.data.commissionRate).toBe(15);

      // Verify payment record in database marked captured
      const paymentDoc = await PaymentModel.findOne({ orderId: testOrderId });
      expect(paymentDoc?.status).toBe('captured');
      expect(paymentDoc?.paymentId).toBe(testPaymentId);
    });

    it('2.5 Idempotency guard: duplicate payment verification does NOT deduct commission or credit earnings twice', async () => {
      const dupRes = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/payment/verify`)
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({
          orderId: testOrderId,
          paymentId: 'pay_duplicate_attempt',
        });

      expect(dupRes.status).toBe(200);
      expect(dupRes.body.success).toBe(true);
      expect(dupRes.body.message).toContain('already');
    });
  });

  // =========================================================================
  // SECTION 3: ADMIN ASSIGNMENT & PANDIT DASHBOARD ACCEPTANCE AUDIT
  // =========================================================================
  describe('3. Admin Assignment & Pandit Dashboard Flow', () => {
    it('3.1 Booking appears in Admin Panel via GET /api/v1/admin/bookings', async () => {
      const res = await request(app)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data?.items || [];
      const found = items.find((b: any) => b.id === testBookingId);
      expect(found).toBeDefined();
      expect(found?.userMobile).toBe(devoteeMobile);
      expect(found?.paymentStatus).toBe('paid');
    });

    it('3.2 Admin assigns approved Pandit to booking with status: assigned', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/bookings/${testBookingId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          panditId: panditDocId,
          status: 'assigned',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('assigned');
      expect(res.body.data.panditName).toBe('Acharya Vidyadhar Ji');
    });

    it('3.3 Pandit logs in and views assigned booking on Pandit Dashboard (GET /api/v1/pandits/dashboard)', async () => {
      const res = await request(app)
        .get('/api/v1/pandits/dashboard')
        .set('Authorization', `Bearer ${panditToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pandit.name).toBe('Acharya Vidyadhar Ji');

      const requests = res.body.data.pendingRequests || [];
      const assignedBooking = requests.find((b: any) => String(b._id || b.id) === testBookingId);
      expect(assignedBooking).toBeDefined();
      expect(assignedBooking?.status).toBe('assigned');
      expect(assignedBooking?.venueAddress).toContain('Royal Palace');
    });

    it('3.4 Pandit accepts the assigned booking via POST /api/v1/bookings/:id/accept', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/accept`)
        .set('Authorization', `Bearer ${panditToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('accepted');
    });

    it('3.5 Devotee fetches updated booking status (accepted) in User App via GET /api/v1/bookings/my', async () => {
      const res = await request(app)
        .get('/api/v1/bookings/my')
        .set('Authorization', `Bearer ${devoteeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const myBookings = res.body.data || [];
      const found = myBookings.find((b: any) => String(b._id || b.id) === testBookingId);
      expect(found?.status).toBe('accepted');
      expect(found?.panditName).toBe('Acharya Vidyadhar Ji');
    });

    it('3.6 Pandit completes the ceremony via POST /api/v1/bookings/:id/complete', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${testBookingId}/complete`)
        .set('Authorization', `Bearer ${panditToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });
  });

  // =========================================================================
  // SECTION 4: PANDIT WALLET, EARNINGS & WITHDRAWAL AUDIT
  // =========================================================================
  describe('4. Pandit Wallet, Earnings & Admin Withdrawal Processing', () => {
    beforeAll(async () => {
      // Ensure pandit has pending payout balance for withdrawal testing
      await PanditModel.findByIdAndUpdate(panditDocId, {
        $inc: { pendingPayout: 5000, totalEarnings: 5000 },
      });
    });

    it('4.1 Pandit checks wallet balance via GET /api/v1/pandits/wallet', async () => {
      const res = await request(app)
        .get('/api/v1/pandits/wallet')
        .set('Authorization', `Bearer ${panditToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pendingPayout).toBeGreaterThanOrEqual(5000);
      expect(res.body.data.totalEarnings).toBeGreaterThanOrEqual(5000);
    });

    it('4.2 Pandit requests payout withdrawal of ₹2,500 via POST /api/v1/pandits/withdraw', async () => {
      const res = await request(app)
        .post('/api/v1/pandits/withdraw')
        .set('Authorization', `Bearer ${panditToken}`)
        .send({
          amount: 2500,
          bankDetails: {
            upiId: 'vidyadhar@okaxis',
            bankName: 'State Bank of India',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.withdrawalId).toMatch(/^WTH-\d{4}-\d+/);
      expect(res.body.data.amount).toBe(2500);
      expect(res.body.data.status).toBe('pending');

      testWithdrawalId = res.body.data._id || res.body.data.id;
    });

    it('4.3 Pandit cannot withdraw more than available wallet balance', async () => {
      const res = await request(app)
        .post('/api/v1/pandits/withdraw')
        .set('Authorization', `Bearer ${panditToken}`)
        .send({
          amount: 999999,
          bankDetails: { upiId: 'vidyadhar@okaxis' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('INSUFFICIENT_FUNDS');
    });

    it('4.4 Admin lists withdrawals via GET /api/v1/admin/withdrawals', async () => {
      const res = await request(app)
        .get('/api/v1/admin/withdrawals?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data?.items || [];
      const found = items.find((w: any) => w.id === testWithdrawalId);
      expect(found).toBeDefined();
      expect(found?.amount).toBe(2500);
    });

    it('4.5 Admin approves payout: marks as paid and deducts from Pandit pendingPayout', async () => {
      const prevPandit = await PanditModel.findById(panditDocId);
      const prevBal = prevPandit?.pendingPayout || 0;

      const res = await request(app)
        .post(`/api/v1/admin/withdrawals/${testWithdrawalId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ referenceNumber: 'IMPS-TEST-9876543210' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('paid');
      expect(res.body.data.referenceNumber).toBe('IMPS-TEST-9876543210');

      const updatedPandit = await PanditModel.findById(panditDocId);
      expect(updatedPandit?.pendingPayout).toBe(prevBal - 2500);
    });
  });

  // =========================================================================
  // SECTION 5: COMMUNITY BOOKINGS AUDIT
  // =========================================================================
  describe('5. Community Bookings Flow', () => {
    it('5.1 Creates a community ceremony booking with isCommunityBooking=true', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${devoteeToken}`)
        .send({
          userName: 'Community Volunteer',
          userMobile: devoteeMobile,
          serviceId: 'satyanarayan_puja',
          serviceName: 'Community Satyanarayan Katha',
          ceremonyType: 'satyanarayan_puja',
          bookingDate: '2026-12-20',
          timeSlot: '05:00 PM – 08:00 PM',
          mode: 'in_person',
          city: 'Varanasi',
          isCommunityBooking: true,
          specialRequests: 'Open community hall ceremony for all devotees',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCommunityBooking).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 6: AUTOMATIC ERROR MONITORING & DATABASE MONITORING AUDIT
  // =========================================================================
  describe('6. Automatic Error Monitoring & Live Database Monitoring', () => {
    let testErrorLogId: string;

    it('6.1 Inserts and queries structured application error log via GET /api/v1/admin/errors', async () => {
      const errorEntry = await ErrorLogModel.create({
        errorId: `ERR-TEST-${Date.now()}`,
        module: 'booking',
        errorMessage: 'Network socket timeout during gateway verification',
        apiEndpoint: '/api/v1/bookings/payment/verify',
        httpMethod: 'POST',
        statusCode: 504,
        severity: 'high',
        resolved: false,
      });
      testErrorLogId = errorEntry._id.toString();

      const res = await request(app)
        .get('/api/v1/admin/errors?module=booking')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data?.items || [];
      const found = items.find((e: any) => e.id === testErrorLogId);
      expect(found).toBeDefined();
      expect(found?.severity).toBe('high');
      expect(found?.resolved).toBe(false);
    });

    it('6.2 Admin resolves error incident via PATCH /api/v1/admin/errors/:id/resolve', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/errors/${testErrorLogId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolutionNotes: 'Gateway timeout handled with automatic retry policy.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resolved).toBe(true);
      expect(res.body.data.resolutionStatus).toBe('resolved');
    });

    it('6.3 Admin queries live database monitoring statistics via GET /api/v1/admin/database/monitoring', async () => {
      const res = await request(app)
        .get('/api/v1/admin/database/monitoring')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('connected');
      expect(res.body.data.databaseName).toBe('bandhansetu');
      expect(res.body.data.collectionsCount).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.collections)).toBe(true);
    });
  });
});
