import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { VerificationRequestModel } from '../src/models/verification-request.model';
import { TokenService } from '../src/services/token.service';

describe('Stories Visibility, Compulsory Opposite-Gender & 5-Document Verification Suite', () => {
  let mongod: MongoMemoryServer;
  let app: any;
  let adminToken: string;
  let boyId: string;
  let boyToken: string;
  let girlId: string;
  let girlToken: string;
  let boy2Id: string;
  let pendingUserId: string;
  let pendingUserToken: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    const admin = await UserModel.create({
      email: 'verify.admin@shaadibanao.com',
      mobile: '9000000001',
      displayName: 'Verify Admin',
      role: 'admin',
      status: 'active',
      approvalStatus: 'approved',
    });
    adminToken = TokenService.generateTokens({
      userId: admin._id.toString(),
      email: admin.email,
      role: 'admin',
    }).accessToken;

    const boy = await UserModel.create({
      email: 'boy1@example.com',
      mobile: '9111111111',
      displayName: 'Aarav Boy',
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
    });
    boyId = boy._id.toString();
    boyToken = TokenService.generateTokens({ userId: boyId, email: boy.email, role: 'member' }).accessToken;

    const boy2 = await UserModel.create({
      email: 'boy2@example.com',
      mobile: '9111111112',
      displayName: 'Vikram Boy',
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
    });
    boy2Id = boy2._id.toString();

    const girl = await UserModel.create({
      email: 'girl1@example.com',
      mobile: '9222222221',
      displayName: 'Meera Girl',
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
    });
    girlId = girl._id.toString();
    girlToken = TokenService.generateTokens({ userId: girlId, email: girl.email, role: 'member' }).accessToken;

    const pendingUser = await UserModel.create({
      email: 'pending.kyc@example.com',
      mobile: '9333333333',
      displayName: 'Karan Pending',
      role: 'member',
      status: 'active',
      approvalStatus: 'pending',
    });
    pendingUserId = pendingUser._id.toString();
    pendingUserToken = TokenService.generateTokens({
      userId: pendingUserId,
      email: pendingUser.email,
      role: 'member',
    }).accessToken;

    await ProfileModel.insertMany([
      {
        userId: boy._id,
        firstName: 'Aarav',
        lastName: 'Sharma',
        gender: 'male',
        dateOfBirth: new Date('1996-01-10'),
        heightCm: 176,
        motherTongue: 'Hindi',
        religion: 'Hindu',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        education: 'B.Tech',
        employedIn: 'private',
        occupation: 'Engineer',
        maritalStatus: 'never_married',
        photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/aarav.jpg', isMain: true, approved: true }],
      },
      {
        userId: boy2._id,
        firstName: 'Vikram',
        lastName: 'Singh',
        gender: 'male',
        dateOfBirth: new Date('1995-03-15'),
        heightCm: 178,
        motherTongue: 'Hindi',
        religion: 'Hindu',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        education: 'MBA',
        employedIn: 'private',
        occupation: 'Analyst',
        maritalStatus: 'never_married',
        photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/vikram.jpg', isMain: true, approved: true }],
      },
      {
        userId: girl._id,
        firstName: 'Meera',
        lastName: 'Verma',
        gender: 'female',
        dateOfBirth: new Date('1998-06-20'),
        heightCm: 164,
        motherTongue: 'Hindi',
        religion: 'Hindu',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        education: 'M.Tech',
        employedIn: 'private',
        occupation: 'Designer',
        maritalStatus: 'never_married',
        photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/meera.jpg', isMain: true, approved: true }],
      },
      {
        userId: pendingUser._id,
        firstName: 'Karan',
        lastName: 'Mehta',
        gender: 'male',
        dateOfBirth: new Date('1997-02-12'),
        heightCm: 174,
        motherTongue: 'Hindi',
        religion: 'Hindu',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        education: 'B.Com',
        employedIn: 'business',
        occupation: 'Business',
        maritalStatus: 'never_married',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('1. Story posted by user immediately appears in /api/v1/community/feed', async () => {
    const postRes = await request(app)
      .post('/api/v1/community/posts')
      .set('Authorization', `Bearer ${boyToken}`)
      .send({
        mediaUrl: 'https://res.cloudinary.com/demo/image/upload/v1/wedding_story_1.jpg',
        publicId: 'shaadibanao/community/wedding_story_1',
        caption: 'Humari sagai ki khushi!',
        category: 'wedding_story',
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);
    expect(postRes.body.data.moderationStatus).toBe('approved');

    const feedRes = await request(app)
      .get('/api/v1/community/feed')
      .set('Authorization', `Bearer ${girlToken}`);

    expect(feedRes.status).toBe(200);
    const found = feedRes.body.data.items.find((p: any) => p.caption === 'Humari sagai ki khushi!');
    expect(found).toBeDefined();
    expect(found.mediaUrl).toContain('wedding_story_1.jpg');
  });

  it('2. Compulsory opposite-gender search: Boy sees ONLY Girls, Girl sees ONLY Boys', async () => {
    const boySearch = await request(app)
      .get('/api/v1/search?gender=male') // tries to pass male, must be overridden to female
      .set('Authorization', `Bearer ${boyToken}`);

    expect(boySearch.status).toBe(200);
    expect(boySearch.body.data.items.length).toBeGreaterThan(0);
    expect(boySearch.body.data.items.every((p: any) => p.gender === 'female')).toBe(true);

    const girlSearch = await request(app)
      .get('/api/v1/search?gender=female') // tries to pass female, must be overridden to male
      .set('Authorization', `Bearer ${girlToken}`);

    expect(girlSearch.status).toBe(200);
    expect(girlSearch.body.data.items.length).toBeGreaterThan(0);
    expect(girlSearch.body.data.items.every((p: any) => p.gender === 'male')).toBe(true);
  });

  it('3. Blocks same-gender interest expression', async () => {
    const res = await request(app)
      .post(`/api/v1/interests/${boy2Id}`)
      .set('Authorization', `Bearer ${boyToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OPPOSITE_GENDER_REQUIRED');
  });

  it('4. Accepts all 5 identity documents (Aadhaar, PAN, Voter ID, Passport, Bank Passbook) and unlocks user login when verified by Admin', async () => {
    const docTypes = ['aadhaar_card', 'pan_card', 'voter_id', 'passport', 'bank_passbook'] as const;
    let lastRequestId = '';

    for (const docType of docTypes) {
      const res = await request(app)
        .post('/api/v1/verification/identity')
        .set('Authorization', `Bearer ${pendingUserToken}`)
        .send({
          documentType: docType,
          documentReferenceNumber: 'ABCDE1234F',
          documentStorageKey: `shaadibanao/private/identity_document/${pendingUserId}/${docType}_1`,
          consentGranted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      lastRequestId = res.body.data.requestId;
    }

    // Verify all 5 appear in Admin Panel verifications queue
    const adminList = await request(app)
      .get('/api/v1/admin/verifications?status=all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    const submittedTypes = adminList.body.data.items.map((i: any) => i.documentType);
    for (const docType of docTypes) {
      expect(submittedTypes).toContain(docType);
    }

    // Verify latestVerification also shows in Approvals queue
    const approvalsRes = await request(app)
      .get('/api/v1/admin/approvals?approvalStatus=all')
      .set('Authorization', `Bearer ${adminToken}`);
    const pendingApplicant = approvalsRes.body.data.items.find((i: any) => i.id === pendingUserId);
    expect(pendingApplicant.latestVerification).toBeDefined();
    expect(pendingApplicant.latestVerification.documentType).toBe('bank_passbook');

    // Before admin verification, pending user is blocked from /api/v1/search
    const blockedRes = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${pendingUserToken}`);
    expect(blockedRes.status).toBe(403);

    // Admin verifies identity document -> unlocks user account for ShaadiBanao login!
    const approveRes = await request(app)
      .post(`/api/v1/admin/verifications/${lastRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);

    // Now the verified user can immediately access ShaadiBanao!
    const unlockedSearch = await request(app)
      .get('/api/v1/search')
      .set('Authorization', `Bearer ${pendingUserToken}`);
    expect(unlockedSearch.status).toBe(200);
    expect(unlockedSearch.body.data.items.every((p: any) => p.gender === 'female')).toBe(true);

    const updatedUser = await UserModel.findById(pendingUserId).lean();
    expect((updatedUser as any).approvalStatus).toBe('approved');
    expect((updatedUser as any).identityVerificationStatus).toBe('verified');
  });

  it('5. Compulsory KYC before profile creation: blocks new profile until ID uploaded & Admin verified', async () => {
    const prevFlag = process.env.ENFORCE_KYC_BEFORE_PROFILE;
    process.env.ENFORCE_KYC_BEFORE_PROFILE = 'true';

    try {
      const freshUser = await UserModel.create({
        email: 'fresh.kyc@example.com',
        mobile: '9444444444',
        displayName: 'Fresh Member',
        role: 'member',
        status: 'active',
        approvalStatus: 'pending',
        identityVerificationStatus: 'none',
        hasProfile: false,
      });
      const freshUserId = freshUser._id.toString();
      const freshToken = TokenService.generateTokens({
        userId: freshUserId,
        email: freshUser.email,
        role: 'member',
      }).accessToken;

      const sampleProfile = {
        firstName: 'Rohan',
        lastName: 'Gupta',
        gender: 'male',
        dateOfBirth: '1996-05-15',
        maritalStatus: 'never_married',
        heightCm: 175,
        motherTongue: 'Hindi',
        religion: 'Hindu',
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Lucknow',
        familyValues: 'moderate',
        familyType: 'nuclear',
        education: 'B.Tech',
        employedIn: 'private',
        occupation: 'Software Engineer',
        photoPrivacy: 'everyone',
        photos: [],
        aboutMe: 'Looking for a genuine and caring life partner.',
      };

      // Step A: Before uploading any ID document, profile creation MUST be rejected with 403
      const blockedBeforeUpload = await request(app)
        .put('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .send(sampleProfile);
      expect(blockedBeforeUpload.status).toBe(403);
      expect(blockedBeforeUpload.body.error.code).toBe('IDENTITY_VERIFICATION_REQUIRED');

      // Step B: User uploads mandatory Aadhaar Card document
      const uploadRes = await request(app)
        .post('/api/v1/verification/identity')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          documentType: 'aadhaar_card',
          documentReferenceNumber: '1234 5678 9012',
          documentStorageKey: `shaadibanao/private/identity_document/${freshUserId}/aadhaar_front`,
          consentGranted: true,
        });
      expect(uploadRes.status).toBe(201);
      const reqId = uploadRes.body.data.requestId;

      // Step C: Even after upload, profile creation MUST stay blocked until Admin verifies
      const blockedWhilePending = await request(app)
        .put('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .send(sampleProfile);
      expect(blockedWhilePending.status).toBe(403);
      expect(blockedWhilePending.body.error.code).toBe('IDENTITY_VERIFICATION_REQUIRED');

      // Step D: Admin verifies the uploaded document from Admin Panel
      const adminApprove = await request(app)
        .post(`/api/v1/admin/verifications/${reqId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminApprove.status).toBe(200);

      // Step E: Now user CAN create their matrimonial profile, and it is automatically marked verified!
      const allowedCreate = await request(app)
        .put('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${freshToken}`)
        .send(sampleProfile);
      expect(allowedCreate.status).toBe(200);
      expect(allowedCreate.body.success).toBe(true);
      expect(allowedCreate.body.data.isVerified).toBe(true);
    } finally {
      if (prevFlag === undefined) delete process.env.ENFORCE_KYC_BEFORE_PROFILE;
      else process.env.ENFORCE_KYC_BEFORE_PROFILE = prevFlag;
    }
  });
});
