import request from 'supertest';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import { inMemoryProfileStore } from '../src/services/profile.service';
import { inMemoryMembershipStore } from '../src/services/membership.service';
import { registerMockUserApprovalForTesting } from '../src/middleware/approval.middleware';
import { config } from '../src/config/env';

describe('Subscription Gate Suite (Male/Female Access & Paywall Rules)', () => {
  const app = createApp();

  // Test Users
  const maleFreeId = 'usr_male_free_1';
  const malePaidId = 'usr_male_paid_1';
  const maleExpiredId = 'usr_male_expired_1';
  const femaleViewerId = 'usr_female_viewer_1';
  const adminViewerId = 'usr_admin_gate_1';
  const exemptUserId = 'usr_exempt_tester_1';

  // Target Profiles
  const femaleTargetUserId = 'usr_target_female_1';
  const maleTargetUserId = 'usr_target_male_1';

  let maleFreeToken: string;
  let malePaidToken: string;
  let maleExpiredToken: string;
  let femaleViewerToken: string;
  let adminToken: string;
  let exemptUserToken: string;

  beforeAll(() => {
    // 1. Setup mock approved users
    const mockApproved = {
      status: 'active',
      approvalStatus: 'approved',
      role: 'member',
    };

    [
      maleFreeId,
      malePaidId,
      maleExpiredId,
      femaleViewerId,
      exemptUserId,
      femaleTargetUserId,
      maleTargetUserId,
    ].forEach((id) => registerMockUserApprovalForTesting(id, mockApproved));

    registerMockUserApprovalForTesting(adminViewerId, {
      ...mockApproved,
      role: 'admin',
    });

    // 2. Setup profiles in inMemoryProfileStore
    inMemoryProfileStore.set(maleFreeId, {
      id: maleFreeId,
      userId: maleFreeId,
      firstName: 'Rahul',
      lastName: 'Sharma',
      gender: 'male',
      dateOfBirth: new Date('1995-05-15'),
      maritalStatus: 'never_married',
      heightCm: 175,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Delhi',
      education: 'B.Tech',
      occupation: 'Software Engineer',
      photos: [],
      completenessPercent: 80,
    });

    inMemoryProfileStore.set(malePaidId, {
      id: malePaidId,
      userId: malePaidId,
      firstName: 'Vikram',
      lastName: 'Verma',
      gender: 'male',
      dateOfBirth: new Date('1994-08-20'),
      maritalStatus: 'never_married',
      heightCm: 180,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Mumbai',
      education: 'MBA',
      occupation: 'Consultant',
      photos: [],
      completenessPercent: 85,
    });

    inMemoryProfileStore.set(maleExpiredId, {
      id: maleExpiredId,
      userId: maleExpiredId,
      firstName: 'Amit',
      lastName: 'Kumar',
      gender: 'male',
      dateOfBirth: new Date('1993-02-10'),
      maritalStatus: 'never_married',
      heightCm: 172,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Jaipur',
      education: 'B.Com',
      occupation: 'Banking',
      photos: [],
      completenessPercent: 75,
    });

    inMemoryProfileStore.set(femaleViewerId, {
      id: femaleViewerId,
      userId: femaleViewerId,
      firstName: 'Pooja',
      lastName: 'Gupta',
      gender: 'female',
      dateOfBirth: new Date('1997-03-25'),
      maritalStatus: 'never_married',
      heightCm: 162,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Delhi',
      education: 'MA',
      occupation: 'Teacher',
      photos: [],
      completenessPercent: 90,
    });

    inMemoryProfileStore.set(exemptUserId, {
      id: exemptUserId,
      userId: exemptUserId,
      firstName: 'TestExempt',
      lastName: 'User',
      gender: 'male',
      dateOfBirth: new Date('1996-01-01'),
      maritalStatus: 'never_married',
      heightCm: 170,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Noida',
      education: 'B.Sc',
      occupation: 'Developer',
      photos: [],
      completenessPercent: 70,
    });

    // Target profiles
    inMemoryProfileStore.set(femaleTargetUserId, {
      id: femaleTargetUserId,
      userId: femaleTargetUserId,
      firstName: 'Ananya',
      lastName: 'Singh',
      gender: 'female',
      dateOfBirth: new Date('1998-07-12'),
      maritalStatus: 'never_married',
      heightCm: 165,
      motherTongue: 'Hindi',
      religion: 'Hindu',
      city: 'Lucknow',
      education: 'M.Tech',
      occupation: 'Architect',
      photos: [],
      completenessPercent: 95,
    });

    inMemoryProfileStore.set(maleTargetUserId, {
      id: maleTargetUserId,
      userId: maleTargetUserId,
      firstName: 'Rohan',
      lastName: 'Malhotra',
      gender: 'male',
      dateOfBirth: new Date('1992-11-05'),
      maritalStatus: 'never_married',
      heightCm: 178,
      motherTongue: 'Punjabi',
      religion: 'Hindu',
      city: 'Chandigarh',
      education: 'B.Tech',
      occupation: 'Product Manager',
      photos: [],
      completenessPercent: 85,
    });

    // 3. Setup memberships in inMemoryMembershipStore
    // Male Free: free plan
    inMemoryMembershipStore.set(maleFreeId, {
      id: 'mem_free_1',
      userId: maleFreeId,
      planId: 'free',
      status: 'active',
      contactDisclosuresUsed: 0,
      startDate: new Date(),
    });

    // Male Paid: plus plan, active, expires in future
    inMemoryMembershipStore.set(malePaidId, {
      id: 'mem_plus_1',
      userId: malePaidId,
      planId: 'plus',
      status: 'active',
      contactDisclosuresUsed: 2,
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
    });

    // Male Expired: plus plan, expired yesterday
    inMemoryMembershipStore.set(maleExpiredId, {
      id: 'mem_expired_1',
      userId: maleExpiredId,
      planId: 'plus',
      status: 'active',
      contactDisclosuresUsed: 10,
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired 1 day ago
    });

    // 4. Generate Auth Tokens
    maleFreeToken = TokenService.generateTokens({
      userId: maleFreeId,
      role: 'member',
    }).accessToken;

    malePaidToken = TokenService.generateTokens({
      userId: malePaidId,
      role: 'member',
    }).accessToken;

    maleExpiredToken = TokenService.generateTokens({
      userId: maleExpiredId,
      role: 'member',
    }).accessToken;

    femaleViewerToken = TokenService.generateTokens({
      userId: femaleViewerId,
      role: 'member',
    }).accessToken;

    adminToken = TokenService.generateTokens({
      userId: adminViewerId,
      role: 'admin',
    }).accessToken;

    exemptUserToken = TokenService.generateTokens({
      userId: exemptUserId,
      email: 'exempt@shaadibanao.com',
      role: 'member',
    }).accessToken;
  });

  describe('When PAYWALL_ENABLED = true', () => {
    beforeAll(() => {
      config.paywall.enabled = true;
      config.paywall.exemptUsers = [exemptUserId.toLowerCase()];
    });

    afterAll(() => {
      config.paywall.enabled = false;
      config.paywall.exemptUsers = [];
    });

    it('1. Male Free user -> blocked on female profile with HTTP 402 SUBSCRIPTION_REQUIRED', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${femaleTargetUserId}`)
        .set('Authorization', `Bearer ${maleFreeToken}`);

      expect(res.status).toBe(402);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
      expect(res.body.error.details.requiredPlanTiers).toContain('plus');
    });

    it('2. Male Paid user (Plus active) -> allowed (200 OK) on female profile', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${femaleTargetUserId}`)
        .set('Authorization', `Bearer ${malePaidToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBeDefined();
    });

    it('3. Male Expired user -> blocked on female profile with HTTP 402', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${femaleTargetUserId}`)
        .set('Authorization', `Bearer ${maleExpiredToken}`);

      expect(res.status).toBe(402);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('4. Female viewer -> ALWAYS ALLOWED (200 OK) on any profile', async () => {
      // Female viewer viewing male profile
      const resMale = await request(app)
        .get(`/api/v1/profiles/${maleTargetUserId}`)
        .set('Authorization', `Bearer ${femaleViewerToken}`);

      expect(resMale.status).toBe(200);
      expect(resMale.body.success).toBe(true);

      // Female viewer viewing female profile
      const resFemale = await request(app)
        .get(`/api/v1/profiles/${femaleTargetUserId}`)
        .set('Authorization', `Bearer ${femaleViewerToken}`);

      expect(resFemale.status).toBe(200);
      expect(resFemale.body.success).toBe(true);
    });

    it('5. Male viewer viewing Male profile -> ALLOWED (200 OK) because target is not female', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${maleTargetUserId}`)
        .set('Authorization', `Bearer ${maleFreeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('6. Admin viewer -> EXEMPT and ALLOWED (200 OK) on female profile', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${femaleTargetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('7. User can ALWAYS view their OWN profile (200 OK)', async () => {
      // Free male viewing own profile
      const res = await request(app)
        .get(`/api/v1/profiles/${maleFreeId}`)
        .set('Authorization', `Bearer ${maleFreeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('8. Whitelisted test user in PAYWALL_EXEMPT_USERS -> ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${femaleTargetUserId}`)
        .set('Authorization', `Bearer ${exemptUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('9. List / Search endpoints are NEVER blocked by paywall', async () => {
      const res = await request(app)
        .get('/api/v1/search?gender=female')
        .set('Authorization', `Bearer ${maleFreeToken}`);

      // Search endpoint returns 200 list data, not 402
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('When PAYWALL_ENABLED = false (Default State)', () => {
    beforeAll(() => {
      config.paywall.enabled = false;
    });

    it('10. PAYWALL_ENABLED=false disables everything -> male free user gets 200 OK', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${femaleTargetUserId}`)
        .set('Authorization', `Bearer ${maleFreeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

