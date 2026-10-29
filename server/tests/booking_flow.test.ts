import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { PanditModel } from '../src/models/pandit.model';
import { BookingModel } from '../src/models/booking.model';
import { TokenService } from '../src/services/token.service';

describe('Pandit Booking End-to-End Flow & Admin Actions', () => {
  let mongod: MongoMemoryServer;
  let app: any;
  let userToken: string;
  let userId: string;
  let panditToken: string;
  let panditUserId: string;
  let panditDocId: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    // 1. Devotee User (Approved member)
    const devotee = await UserModel.create({
      mobile: '+919876543210',
      displayName: 'Rahul Sharma',
      approvalStatus: 'approved',
      role: 'member',
    });
    userId = devotee._id.toString();
    userToken = TokenService.generateTokens({
      userId,
      mobile: '+919876543210',
      role: 'member',
    }).accessToken;

    // 2. Pandit User & Pandit Profile
    const panditUser = await UserModel.create({
      mobile: '+919876543211',
      displayName: 'Acharya Shastri',
      approvalStatus: 'approved',
      role: 'pandit',
    });
    panditUserId = panditUser._id.toString();
    panditToken = TokenService.generateTokens({
      userId: panditUserId,
      mobile: '+919876543211',
      role: 'pandit',
    }).accessToken;

    const panditDoc = await PanditModel.create({
      userId: panditUser._id,
      name: 'Acharya Shastri Ji',
      phone: '+919876543211',
      religiousTradition: 'Vedic Sanatan',
      experienceYears: 15,
      city: 'Delhi',
      state: 'Delhi',
      verificationStatus: 'verified',
      services: [
        {
          serviceId: 'srv_vivah',
          name: 'Vivah Sanskar Puja',
          ceremonyType: 'wedding',
          priceInr: 11000,
          durationMinutes: 240,
        },
        {
          serviceId: 'srv_griha',
          name: 'Griha Pravesh Puja',
          ceremonyType: 'griha_pravesh',
          priceInr: 5100,
          durationMinutes: 120,
        },
      ],
    });
    panditDocId = panditDoc._id.toString();

    // 3. Admin User
    adminUserId = new mongoose.Types.ObjectId().toString();
    adminToken = TokenService.generateTokens({
      userId: adminUserId,
      email: 'admin@shaadibanao.com',
      mobile: '+919876543219',
      role: 'admin',
    }).accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('1. Devotee can submit a direct booking request without specifying a pandit', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        serviceId: 'satyanarayan_puja',
        bookingDate: '2026-11-20',
        timeSlot: '10:00 AM - 01:00 PM',
        mode: 'in_person',
        venueAddress: 'Flat 402, Lotus Towers, Delhi',
        city: 'Delhi',
        guestCount: 25,
        languagePref: 'Hindi',
        budgetRangeInr: '₹7,000 – ₹15,000',
        kundliSharedConsent: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.bookingReference).toMatch(/^SB-2026-/);
    expect(res.body.data.panditId).toBeUndefined();
  });

  it('2. Devotee can submit a booking request for a specific verified Pandit', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        panditId: panditDocId,
        serviceId: 'srv_vivah',
        bookingDate: '2026-12-10',
        timeSlot: '10:00 AM - 01:00 PM',
        mode: 'in_person',
        venueAddress: 'Royal Palace Banquet, Delhi',
        city: 'Delhi',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('requested');
    expect(res.body.data.panditName).toBe('Acharya Shastri Ji');
    expect(res.body.data.priceInr).toBe(11000);
  });

  it('3. Conflict prevention: prevents booking the same Pandit on the same date and slot', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        panditId: panditDocId,
        serviceId: 'srv_vivah',
        bookingDate: '2026-12-10',
        timeSlot: '10:00 AM - 01:00 PM',
        mode: 'in_person',
      });

    expect(res.status).toBe(500);
    expect(res.body.message || res.body.error?.message).toContain('already booked or has a pending request');
  });

  it('4. Devotee can fetch their own bookings via GET /api/v1/bookings/my', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/my')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('5. Pandit can view their received booking requests via GET /api/v1/bookings/pandit', async () => {
    const res = await request(app)
      .get('/api/v1/bookings/pandit')
      .set('Authorization', `Bearer ${panditToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].serviceName).toBe('Vivah Sanskar Puja');
  });

  it('6. Pandit can accept the booking: status changes to accepted', async () => {
    const panditBookings = await request(app)
      .get('/api/v1/bookings/pandit')
      .set('Authorization', `Bearer ${panditToken}`);
    const bookingId = panditBookings.body.data[0]._id;

    const res = await request(app)
      .post(`/api/v1/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${panditToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('accepted');
  });

  it('7. Pandit can mark accepted booking as completed', async () => {
    const panditBookings = await request(app)
      .get('/api/v1/bookings/pandit')
      .set('Authorization', `Bearer ${panditToken}`);
    const bookingId = panditBookings.body.data[0]._id;

    const res = await request(app)
      .post(`/api/v1/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${panditToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
  });

  it('8. Devotee can cancel an open booking request', async () => {
    const userBookings = await request(app)
      .get('/api/v1/bookings/my')
      .set('Authorization', `Bearer ${userToken}`);
    const pendingBooking = userBookings.body.data.find((b: any) => b.status === 'requested');

    const res = await request(app)
      .post(`/api/v1/bookings/${pendingBooking._id}/cancel`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'Family changed wedding dates' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.cancellationReason).toBe('Family changed wedding dates');
  });

  describe('Admin Panel Booking Management', () => {
    let unassignedBookingId: string;

    beforeEach(async () => {
      // Create a fresh unassigned booking for admin tests
      const b = await BookingModel.create({
        bookingReference: `SB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: new mongoose.Types.ObjectId(userId),
        userName: 'Rahul Sharma',
        userMobile: '+919876543210',
        serviceId: 'griha_pravesh',
        serviceName: 'Griha Pravesh Puja',
        ceremonyType: 'griha_pravesh',
        bookingDate: '2026-11-25',
        timeSlot: '08:00 AM – 11:00 AM',
        mode: 'in_person',
        city: 'Delhi',
        priceInr: 5100,
        status: 'requested',
        statusHistory: [{ status: 'requested', changedBy: new mongoose.Types.ObjectId(userId), timestamp: new Date() }],
        kundliSharedConsent: true,
      });
      unassignedBookingId = b._id.toString();
    });

    it('9. Admin can list all bookings with status filter via GET /api/v1/admin/bookings', async () => {
      const res = await request(app)
        .get('/api/v1/admin/bookings?status=all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
    });

    it('10. Admin can assign a Pandit to an unassigned booking and confirm it (status=accepted)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/bookings/${unassignedBookingId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ panditId: panditDocId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('accepted');
      expect(res.body.data.panditName).toBe('Acharya Shastri Ji');
    });

    it('11. Admin can update booking status via PATCH /api/v1/admin/bookings/:id/status (accepted/completed/cancelled)', async () => {
      // Mark as completed
      const resComplete = await request(app)
        .patch(`/api/v1/admin/bookings/${unassignedBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'completed' });

      expect(resComplete.status).toBe(200);
      expect(resComplete.body.success).toBe(true);
      expect(resComplete.body.data.status).toBe('completed');

      // Admin accepts "confirmed" alias gracefully mapping to "accepted"
      const resConfirm = await request(app)
        .patch(`/api/v1/admin/bookings/${unassignedBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      expect(resConfirm.status).toBe(200);
      expect(resConfirm.body.data.status).toBe('accepted');
    });
  });
});
