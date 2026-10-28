import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { MembershipModel } from '../src/models/membership.model';
import { PanditModel } from '../src/models/pandit.model';
import { BookingModel } from '../src/models/booking.model';
import { CommunityPostModel } from '../src/models/community-post.model';
import { VerificationRequestModel } from '../src/models/verification-request.model';
import { ReportModel } from '../src/models/report.model';
import { BannerModel } from '../src/models/banner.model';
import { AuditLogModel } from '../src/models/audit-log.model';
import { PartnerPreferenceModel } from '../src/models/preference.model';
import { KundliModel } from '../src/models/kundli.model';
import { TokenService } from '../src/services/token.service';

describe('Admin Panel 12-Section Comprehensive Smoke Test', () => {
  let mongod: MongoMemoryServer;
  let app: any;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    app = createApp();

    adminUserId = new mongoose.Types.ObjectId().toString();
    adminToken = TokenService.generateTokens({
      userId: adminUserId,
      email: 'superadmin@shaadibanao.com',
      mobile: '9876543210',
      role: 'admin',
    }).accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  describe('PHASE A: Empty Collections (Clean State)', () => {
    it('1. Dashboard Overview should return 200 with zero metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBe(0);
      expect(res.body.data.pendingApprovals).toBe(0);
    });

    it('2. Pending Approvals should return 200 with empty items', async () => {
      const res = await request(app)
        .get('/api/v1/admin/approvals')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('3. Pandit Services should return 200 with empty items', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pandits')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('4. Identity & Aadhaar should return 200 with empty requests', async () => {
      const res = await request(app)
        .get('/api/v1/admin/verifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('5. Ceremony Bookings should return 200 with empty items', async () => {
      const res = await request(app)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('6. Community Feed should return 200 with empty items', async () => {
      const res = await request(app)
        .get('/api/v1/admin/community')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('7. User Accounts should return 200 with empty users list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toEqual([]);
    });

    it('8. Profile Moderation should return 200 with empty profiles and pending photos', async () => {
      const res1 = await request(app)
        .get('/api/v1/admin/profiles')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.profiles).toEqual([]);

      const res2 = await request(app)
        .get('/api/v1/admin/photos/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.items).toEqual([]);
    });

    it('9. Memberships & Plans metrics should return 200 with tier counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.membershipPlans).toMatchObject({ free: 0, silver: 0, gold: 0, platinum: 0 });
    });

    it('10. Trust & Safety should return 200 with empty reports', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reports).toEqual([]);
    });

    it('11. Public Banners should return 200 with empty banners', async () => {
      const res = await request(app)
        .get('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('12. Admin Audit should return 200 with empty audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toEqual([]);
    });
  });

  describe('PHASE B: Populated Records with Cross-Model Relations', () => {
    let seededUserId: string;

    beforeAll(async () => {
      const user = await UserModel.create({
        mobile: '9123456780',
        email: 'priya.sharma@example.com',
        displayName: 'Priya Sharma',
        role: 'member',
        status: 'active',
        approvalStatus: 'pending',
        photoApprovalStatus: 'pending',
      });
      seededUserId = user._id.toString();

      await ProfileModel.create({
        userId: user._id,
        firstName: 'Priya',
        lastName: 'Sharma',
        gender: 'female',
        dateOfBirth: new Date('1998-05-15'),
        heightCm: 165,
        maritalStatus: 'never_married',
        religion: 'Hindu',
        motherTongue: 'Hindi',
        education: 'B.Tech Computer Science',
        employedIn: 'private',
        occupation: 'Software Engineer',
        annualIncomeBand: '10_to_15_lakh',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        completenessPercent: 90,
        isVerified: true,
        photos: [
          {
            url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/priya.jpg',
            publicId: 'shaadibanao/profiles/priya',
            isMain: true,
            approved: false,
          },
        ],
      });

      await MembershipModel.create({
        userId: user._id,
        planId: 'premium',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 86400000),
      });

      await PartnerPreferenceModel.create({
        userId: user._id,
        minAge: 25,
        maxAge: 32,
      });

      await KundliModel.create({
        userId: user._id,
        dateOfBirth: new Date('1998-05-15'),
        timeOfBirth: '10:30',
        birthPlace: { name: 'Jaipur', state: 'Rajasthan', country: 'India' },
        rashi: 'Mesh',
        nakshatra: 'Ashwini',
      });

      const pandit = await PanditModel.create({
        userId: user._id,
        name: 'Pandit Rajesh Shastri',
        phone: '9876543299',
        email: 'rajesh.shastri@example.com',
        experienceYears: 15,
        religiousTradition: 'Vedic Sanatan',
        verificationStatus: 'verified',
        rating: 4.9,
      });

      await BookingModel.create({
        bookingReference: 'BK-1001',
        userId: user._id,
        userName: 'Priya Sharma',
        userMobile: '9123456780',
        panditId: pandit._id,
        panditName: 'Pandit Rajesh Shastri',
        serviceId: 'srv_kundli',
        serviceName: 'Kundli Milan',
        ceremonyType: 'kundli_milan',
        mode: 'online',
        bookingDate: '2026-11-01',
        timeSlot: '10:00 AM',
        priceInr: 1100,
        status: 'accepted',
      });

      await VerificationRequestModel.create({
        userId: user._id,
        userDisplayName: 'Priya Sharma',
        userMobile: '9123456780',
        userEmail: 'priya.sharma@example.com',
        documentType: 'aadhaar_card',
        documentReferenceMasked: 'XXXX-XXXX-1234',
        documentStorageKey: 'private/docs/aadhaar_123.jpg',
        consentGranted: true,
        consentTimestamp: new Date(),
        status: 'pending',
      });

      await CommunityPostModel.create({
        userId: user._id,
        authorName: 'Priya Sharma',
        mediaUrl: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/community/sample.jpg',
        publicId: 'shaadibanao/community/sample',
        caption: 'Happy Karwa Chauth celebrations!',
        category: 'wedding_story',
        moderationStatus: 'pending',
      });

      await ReportModel.create({
        reporterId: user._id,
        reportedUserId: user._id,
        reason: 'fake_photos',
        status: 'pending',
      });

      await BannerModel.create({
        title: 'Special Diwali Matrimonial Offer',
        imageUrl: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/banners/diwali.jpg',
        publicId: 'shaadibanao/banners/diwali',
        linkUrl: '/membership',
        isActive: true,
        priority: 10,
      });

      await AuditLogModel.create({
        adminId: adminUserId,
        action: 'UPDATE_MEMBERSHIP',
        targetUserId: seededUserId,
        details: { planId: 'gold' },
      });
    });

    it('1. Dashboard Overview should return 200 with populated counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(1);
      expect(res.body.data.activeMemberships).toBeGreaterThanOrEqual(1);
      expect(res.body.data.membershipPlans.premium).toBe(1);
    });

    it('2. Pending Approvals should return 200 with populated user and profile data', async () => {
      const res = await request(app)
        .get('/api/v1/admin/approvals')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const item = res.body.data.items.find((i: any) => i.id === seededUserId);
      expect(item).toBeDefined();
      expect(item.profile).toBeDefined();
      expect(item.profile.firstName).toBe('Priya');
      expect(item.preferences).toBeDefined();
      expect(item.kundli).toBeDefined();
    });

    it('3. Pandit Services should return 200 with populated pandits', async () => {
      const res = await request(app)
        .get('/api/v1/admin/pandits')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].name).toBe('Pandit Rajesh Shastri');
    });

    it('4. Identity & Aadhaar should return 200 with populated requests', async () => {
      const res = await request(app)
        .get('/api/v1/admin/verifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].documentType).toBe('aadhaar_card');
    });

    it('5. Ceremony Bookings should return 200 with populated bookings', async () => {
      const res = await request(app)
        .get('/api/v1/admin/bookings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].bookingReference).toBe('BK-1001');
    });

    it('6. Community Feed should return 200 with populated posts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/community')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].authorName).toBe('Priya Sharma');
    });

    it('7. User Accounts should return 200 with populated user and attached profile/membership', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      const user = res.body.data.users.find((u: any) => u._id === seededUserId);
      expect(user).toBeDefined();
      expect(user.profile).toBeDefined();
      expect(user.profile.firstName).toBe('Priya');
      expect(user.membership).toBeDefined();
      expect(user.membership.planId).toBe('premium');
    });

    it('8. Profile Moderation should return 200 with profiles and pending photos', async () => {
      const res1 = await request(app)
        .get('/api/v1/admin/profiles')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);
      expect(res1.body.data.profiles.length).toBeGreaterThanOrEqual(1);
      expect(res1.body.data.profiles[0].firstName).toBe('Priya');

      const res2 = await request(app)
        .get('/api/v1/admin/photos/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('9. Memberships & Plans modification should return 200', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/memberships/${seededUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ planId: 'platinum', days: 60 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.membership.planId).toBe('premium');
    });

    it('10. Trust & Safety should return 200 with reports', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.reports.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.reports[0].reason).toBe('fake_photos');
    });

    it('11. Public Banners should return 200 with banners', async () => {
      const res = await request(app)
        .get('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].title).toBe('Special Diwali Matrimonial Offer');
    });

    it('12. Admin Audit should return 200 with audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.logs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
