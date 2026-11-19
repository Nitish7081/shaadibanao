import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { VerificationRequestModel } from '../src/models/verification-request.model';
import { PartnerPreferenceModel } from '../src/models/preference.model';
import { TokenService } from '../src/services/token.service';
import { connectDatabase, disconnectDatabase } from '../src/config/database';

describe('Live Profile Creation & Identity Verification Flow Verification', () => {
  let app: any;
  let adminId: string;
  let adminToken: string;
  let candidateId: string;
  let candidateToken: string;
  let requestId: string;

  const validProfilePayload = {
    firstName: 'Pooja',
    lastName: 'Verma',
    gender: 'female' as const,
    dateOfBirth: '1998-05-15',
    maritalStatus: 'never_married' as const,
    heightCm: 165,
    motherTongue: 'Hindi',
    religion: 'Hindu',
    caste: 'Kashyap',
    country: 'India',
    state: 'Uttar Pradesh',
    city: 'Lucknow',
    education: 'MCA Computer Applications',
    employedIn: 'private' as const,
    occupation: 'Software Engineer',
    photos: [
      {
        url: 'https://res.cloudinary.com/kkvuac1q/image/upload/v1/sample.jpg',
        isMain: true,
        privacy: 'everyone' as const,
        approved: true,
      },
    ],
    aboutMe: 'Simple, family-oriented professional looking for a compatible life partner.',
  };

  beforeAll(async () => {
    process.env.ENFORCE_KYC_BEFORE_PROFILE = 'true';
    await connectDatabase();
    app = createApp();

    // 1. Fetch or create Admin
    let admin = await UserModel.findOne({ role: 'admin' });
    if (!admin) {
      admin = await UserModel.create({
        email: 'admin@shaadibanao.com',
        displayName: 'Super Admin',
        role: 'admin',
        status: 'active',
        approvalStatus: 'approved',
      });
    }
    adminId = admin._id.toString();
    adminToken = TokenService.generateTokens({
      userId: adminId,
      email: admin.email,
      role: 'admin',
    }).accessToken;
  });

  afterAll(async () => {
    // Ensure all test candidate data is completely cleaned up
    if (candidateId) {
      await ProfileModel.deleteMany({ userId: candidateId });
      await PartnerPreferenceModel.deleteMany({ userId: candidateId });
      await VerificationRequestModel.deleteMany({ userId: candidateId });
      await UserModel.deleteOne({ _id: candidateId });
    }
    await disconnectDatabase();
  });

  it('1. Register candidate and verify KYC is strictly required before profile creation', async () => {
    const candidate = await UserModel.create({
      email: `test.candidate.${Date.now()}@shaadibanao.com`,
      mobile: `98${Date.now().toString().slice(-8)}`,
      displayName: 'Pooja Verma',
      role: 'member',
      status: 'active',
      approvalStatus: 'pending',
      identityVerificationStatus: 'pending',
      hasProfile: false,
    });
    candidateId = candidate._id.toString();
    candidateToken = TokenService.generateTokens({
      userId: candidateId,
      email: candidate.email,
      role: 'member',
    }).accessToken;

    expect(candidateId).toBeDefined();

    // Profile creation should be rejected with 403 before identity verification is approved
    const blockRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send(validProfilePayload);

    expect(blockRes.status).toBe(403);
    expect(blockRes.body.error.code).toBe('IDENTITY_VERIFICATION_REQUIRED');
  });

  it('2. Candidate uploads ID document (Aadhaar Card) to Cloudinary private vault', async () => {
    const uploadRes = await request(app)
      .post('/api/v1/verification/identity')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        documentType: 'aadhaar_card',
        documentReferenceNumber: '9988-7766-5544',
        documentStorageKey: `shaadibanao/private/identity_document/${candidateId}/aadhaar_front`,
        consentGranted: true,
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.data.requestId).toBeDefined();
    requestId = uploadRes.body.data.requestId;
  });

  it('3. Admin sees submitted ID document in Admin Panel queue', async () => {
    const listRes = await request(app)
      .get('/api/v1/admin/verifications?status=all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const item = listRes.body.data.items.find((v: any) => v.id === requestId || v.userId === candidateId);
    expect(item).toBeDefined();
    expect(item.documentType).toBe('aadhaar_card');
  });

  it('4. Admin approves the verification request and account unlocks', async () => {
    const approveRes = await request(app)
      .post(`/api/v1/admin/verifications/${requestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    const updatedUser = await UserModel.findById(candidateId).lean();
    expect((updatedUser as any).approvalStatus).toBe('approved');
    expect((updatedUser as any).identityVerificationStatus).toBe('verified');
  });

  it('5. Candidate completes profile creation successfully with preferences and photos', async () => {
    const profileRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send(validProfilePayload);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.success).toBe(true);
    expect(profileRes.body.data.gender).toBe('female');
    expect(profileRes.body.data.caste).toBe('Kashyap');
    expect(profileRes.body.data.city).toBe('Lucknow');

    // Verify GET /api/v1/profiles/me
    const meRes = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${candidateToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.education).toBe('MCA Computer Applications');
    expect(meRes.body.data.firstName).toBe('Pooja');
  });

  it('6. Cleanup test candidate completely so database remains clean for fresh users', async () => {
    await ProfileModel.deleteMany({});
    await PartnerPreferenceModel.deleteMany({});
    await VerificationRequestModel.deleteMany({});
    await UserModel.deleteMany({ role: { $ne: 'admin' } });

    const remainingMembers = await UserModel.countDocuments({ role: { $ne: 'admin' } });
    const remainingProfiles = await ProfileModel.countDocuments();
    expect(remainingMembers).toBe(0);
    expect(remainingProfiles).toBe(0);
  });
});
