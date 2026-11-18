import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { PartnerPreferenceModel } from '../src/models/preference.model';
import { KundliModel } from '../src/models/kundli.model';
import { MembershipModel } from '../src/models/membership.model';
import { VerificationRequestModel } from '../src/models/verification-request.model';
import { ReportModel } from '../src/models/report.model';
import { TokenService } from '../src/services/token.service';

describe('Admin Always-Available Data, Photos & Rejection Suite', () => {
  let mongod: MongoMemoryServer;
  let app: any;
  let adminToken: string;
  let adminUserId: string;
  let memberUserId: string;
  let photo1Id: string;
  let photo2Id: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    const adminDoc = await UserModel.create({
      email: 'ops.admin@shaadibanao.com',
      mobile: '9999888877',
      displayName: 'Ops Admin',
      role: 'admin',
      status: 'active',
      approvalStatus: 'approved',
      passwordHash: bcrypt.hashSync('SuperSecretAdmin123!', 10),
    });
    adminUserId = adminDoc._id.toString();

    adminToken = TokenService.generateTokens({
      userId: adminUserId,
      email: adminDoc.email,
      mobile: adminDoc.mobile,
      role: 'admin',
    }).accessToken;

    const memberDoc = await UserModel.create({
      email: 'rohan.verma@example.com',
      mobile: '9876501234',
      displayName: 'Rohan Verma',
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
      approvedAt: new Date(),
      approvedBy: adminUserId,
      photoApprovalStatus: 'approved',
      hasProfile: true,
    });
    memberUserId = memberDoc._id.toString();

    const profileDoc = await ProfileModel.create({
      userId: memberDoc._id,
      firstName: 'Rohan',
      lastName: 'Verma',
      gender: 'male',
      dateOfBirth: new Date('1996-04-12'),
      heightCm: 175,
      maritalStatus: 'never_married',
      religion: 'Hindu',
      motherTongue: 'Hindi',
      education: 'MBA Finance',
      employedIn: 'private',
      occupation: 'Product Manager',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      completenessPercent: 95,
      isVerified: true,
      photoChecked: true,
      photos: [
        {
          url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/rohan1.jpg',
          publicId: 'shaadibanao/profiles/rohan1',
          isMain: true,
          approved: true,
        },
        {
          url: 'https://res.cloudinary.com/shaadibanao/image/upload/v1/profiles/rohan2.jpg',
          publicId: 'shaadibanao/profiles/rohan2',
          isMain: false,
          approved: true,
        },
      ],
    });
    photo1Id = profileDoc.photos[0]._id.toString();
    photo2Id = profileDoc.photos[1]._id.toString();

    await PartnerPreferenceModel.create({
      userId: memberDoc._id,
      minAge: 23,
      maxAge: 30,
    });

    await KundliModel.create({
      userId: memberDoc._id,
      dateOfBirth: new Date('1996-04-12'),
      timeOfBirth: '08:15',
      birthPlace: { name: 'Pune', state: 'Maharashtra', country: 'India' },
      rashi: 'Makar',
      nakshatra: 'Shravana',
    });

    await MembershipModel.create({
      userId: memberDoc._id,
      planId: 'plus',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });

    await VerificationRequestModel.create({
      userId: memberDoc._id,
      userDisplayName: 'Rohan Verma',
      userMobile: '9876501234',
      userEmail: 'rohan.verma@example.com',
      documentType: 'aadhaar_card',
      documentReferenceMasked: 'XXXX-XXXX-4321',
      documentStorageKey: 'shaadibanao/private/identity_document/test/doc1',
      consentGranted: true,
      consentTimestamp: new Date(),
      status: 'verified',
    });

    await ReportModel.create({
      reporterId: adminDoc._id,
      reportedUserId: memberDoc._id,
      reason: 'fake_photos',
      status: 'pending',
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('should enrich GET /api/v1/admin/users and /profiles with photos and age', async () => {
    const usersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(usersRes.status).toBe(200);
    const member = usersRes.body.data.users.find((u: any) => u._id === memberUserId);
    expect(member).toBeDefined();
    expect(member.photosCount).toBe(2);
    expect(member.mainPhotoUrl).toContain('rohan1.jpg');
    expect(member.profile.photos).toHaveLength(2);

    const profilesRes = await request(app)
      .get('/api/v1/admin/profiles')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(profilesRes.status).toBe(200);
    const prof = profilesRes.body.data.profiles.find((p: any) => p.firstName === 'Rohan');
    expect(prof).toBeDefined();
    expect(prof.photosCount).toBe(2);
    expect(prof.mainPhotoUrl).toContain('rohan1.jpg');
    expect(prof.age).toBeGreaterThanOrEqual(25);
  });

  it('should return complete user details, all images, preferences, kundli, verifications, and reports via GET /api/v1/admin/users/:id/details', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users/${memberUserId}/details`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(memberUserId);
    expect(res.body.data.profile.photos).toHaveLength(2);
    expect(res.body.data.preferences.minAge).toBe(23);
    expect(res.body.data.kundli.rashi).toBe('Makar');
    expect(res.body.data.membership.planId).toBe('plus');
    expect(res.body.data.verifications).toHaveLength(1);
    expect(res.body.data.reports).toHaveLength(1);
  });

  it('should allow rejecting an individual photo while keeping all photos visible to admin', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/photos/${memberUserId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'reject', photoId: photo2Id, remarks: 'Blurry secondary photo' });

    expect(res.status).toBe(200);
    expect(res.body.data.photoApprovalStatus).toBe('approved'); // photo1 still approved

    const detailsRes = await request(app)
      .get(`/api/v1/admin/users/${memberUserId}/details`)
      .set('Authorization', `Bearer ${adminToken}`);

    const photos = detailsRes.body.data.profile.photos;
    expect(photos).toHaveLength(2);
    const p1 = photos.find((p: any) => p.id === photo1Id);
    const p2 = photos.find((p: any) => p.id === photo2Id);
    expect(p1.approved).toBe(true);
    expect(p2.approved).toBe(false);
  });

  it('should allow rejecting an ALREADY-APPROVED user at any time while keeping their data & images available to admin', async () => {
    const rejectRes = await request(app)
      .post(`/api/v1/admin/approvals/${memberUserId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Suspicious or fake profile details',
        remarks: 'Incorrect details found during post-approval audit',
      });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.user.approvalStatus).toBe('rejected');
    expect(rejectRes.body.data.user.approvedAt).toBeUndefined();

    // User's data & photos must STILL be fully available in /details and /approvals?approvalStatus=all
    const detailsRes = await request(app)
      .get(`/api/v1/admin/users/${memberUserId}/details`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.approvalStatus).toBe('rejected');
    expect(detailsRes.body.data.rejectionReason).toBe('Suspicious or fake profile details');
    expect(detailsRes.body.data.approvedAt).toBeUndefined();
    expect(detailsRes.body.data.profile.isVerified).toBe(false);
    expect(detailsRes.body.data.profile.photos).toHaveLength(2);

    const allApprovalsRes = await request(app)
      .get('/api/v1/admin/approvals?approvalStatus=all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allApprovalsRes.status).toBe(200);
    expect(allApprovalsRes.body.data.items.some((i: any) => i.id === memberUserId)).toBe(true);
  });

  it('should persist admin refresh token on login so admin sessions refresh cleanly without forced logout', async () => {
    const loginRes = await request(app)
      .post('/api/v1/admin/login')
      .send({
        emailOrMobile: 'ops.admin@shaadibanao.com',
        password: 'SuperSecretAdmin123!',
      });

    expect(loginRes.status).toBe(200);
    const { refreshToken } = loginRes.body.data.tokens;
    expect(refreshToken).toBeTruthy();

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.tokens.accessToken).toBeTruthy();
    expect(refreshRes.body.data.user.role).toBe('admin');
  });

  it('should serve valid admin.js without broken window binding', async () => {
    const res = await request(app).get('/admin/admin.js');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('handleBannerUploadSubmit');
    expect(res.text).toContain('window.submitBannerUpload = submitBannerUpload');
    expect(res.text).toContain('window.openPhotoLightbox = openPhotoLightbox');
  });
});
