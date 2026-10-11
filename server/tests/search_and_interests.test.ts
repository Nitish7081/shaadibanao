import request from 'supertest';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import { ProfileService } from '../src/services/profile.service';
import { PreferenceService } from '../src/services/preference.service';
import { UpsertProfileInput, PartnerPreferencesInput } from '@bandhansetu/shared';

describe('Search, Shortlist & Interest Workflow Suite (/api/v1/search, /shortlists, /interests)', () => {
  const app = createApp();

  // Test User 1 (Male - Searcher & Sender)
  const user1Id = 'usr_test_searcher_1';
  const user1Token = TokenService.generateTokens({
    userId: user1Id,
    mobile: '9811100001',
    role: 'member',
  }).accessToken;

  // Test User 2 (Female - Candidate Profile & Receiver)
  const user2Id = 'usr_test_candidate_2';
  const user2Token = TokenService.generateTokens({
    userId: user2Id,
    mobile: '9811100002',
    role: 'member',
  }).accessToken;

  // Test User 3 (Unauthorized Third Party)
  const user3Id = 'usr_test_thirdparty_3';
  const user3Token = TokenService.generateTokens({
    userId: user3Id,
    mobile: '9811100003',
    role: 'member',
  }).accessToken;

  const candidateProfileInput: UpsertProfileInput = {
    firstName: 'Ananya',
    lastName: 'Kashyap',
    gender: 'female',
    dateOfBirth: '1998-08-20', // ~28 yrs
    maritalStatus: 'never_married',
    heightCm: 165,
    motherTongue: 'Hindi',
    religion: 'Hindu',
    caste: 'Brahmin',
    gotra: 'Kashyap',
    manglik: 'no',
    country: 'India',
    state: 'Delhi',
    city: 'Delhi NCR',
    familyValues: 'moderate',
    familyType: 'nuclear',
    education: 'B.Tech Computer Science',
    employedIn: 'private',
    occupation: 'Software Engineer',
    annualIncomeBand: '₹20L - ₹30L',
    showIncomeBand: true,
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        isMain: true,
        privacy: 'everyone',
        approved: true,
      },
    ],
    photoPrivacy: 'everyone',
    aboutMe: 'Software engineer living in Delhi, loves travel and music.',
  };

  const user1PreferencesInput: PartnerPreferencesInput = {
    minAge: 24,
    maxAge: 30,
    minHeightCm: 160,
    maxHeightCm: 175,
    maritalStatuses: ['never_married'],
    religions: ['Hindu'],
    motherTongues: ['Hindi'],
    educations: ['B.Tech', 'Engineering'],
    occupations: ['Software Engineer'],
    cities: ['Delhi NCR'],
    manglikPreference: 'no',
  };

  let candidateProfileId: string;
  let activeInterestId: string;

  beforeAll(async () => {
    // Seed candidate profile
    const candidateProfile = await ProfileService.upsertMyProfile(user2Id, candidateProfileInput);
    candidateProfileId = candidateProfile.id;

    // Seed User 1 preferences for factual alignment tests
    await PreferenceService.upsertMyPreferences(user1Id, user1PreferencesInput);
  });

  describe('1. Profile Search API (GET /api/v1/search)', () => {
    it('should reject unauthenticated search requests with 401', async () => {
      const res = await request(app).get('/api/v1/search');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return matching profiles with factual preference-alignment details (no arbitrary %)', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${user1Token}`)
        .query({
          minAge: 25,
          maxAge: 30,
          city: 'Delhi',
          gender: 'female',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      const profile = res.body.data.items[0];
      // Privacy redaction verification
      expect(profile.displayName).toBe('Ananya K.'); // First name + Last initial
      expect(profile.isContactLocked).toBe(true);
      expect(profile.contactNumber).toBeUndefined();
      expect(profile.lastName).toBeUndefined(); // private field never returned

      // Factual Match explanation verification
      expect(profile.matchAlignment).toBeDefined();
      expect(profile.matchAlignment.scoreText).toMatch(/\d+ of \d+ preferences match/);
      expect(profile.matchAlignment.matchedCount).toBeGreaterThanOrEqual(1);
      expect(profile.matchAlignment.matchedCriteria).toBeInstanceOf(Array);
      // Ensure NO arbitrary compatibility percentages exist
      expect(profile.compatibilityPercent).toBeUndefined();
    });

    it('should exclude the current user from their own search results', async () => {
      // Seed user 1 profile
      await ProfileService.upsertMyProfile(user1Id, {
        ...candidateProfileInput,
        firstName: 'Rohit',
        gender: 'male',
      });

      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ gender: 'male' });

      expect(res.status).toBe(200);
      const matches = res.body.data.items;
      const selfFound = matches.some((p: any) => p.userId === user1Id || p.id === user1Id);
      expect(selfFound).toBe(false);
    });

    it('should support pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ page: 1, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
      expect(typeof res.body.data.pagination.totalCount).toBe('number');
      expect(typeof res.body.data.pagination.totalPages).toBe('number');
    });

    it('should reject invalid query filters with 400', async () => {
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ minAge: 12 }); // Under 18 minimum age

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Shortlist API (/api/v1/shortlists)', () => {
    it('should reject self-shortlisting with 400 SELF_SHORTLIST_PROHIBITED', async () => {
      const res = await request(app)
        .post(`/api/v1/shortlists/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_SHORTLIST_PROHIBITED');
    });

    it('should successfully shortlist candidate profile', async () => {
      const res = await request(app)
        .post(`/api/v1/shortlists/${candidateProfileId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject duplicate shortlist with 409 ALREADY_SHORTLISTED', async () => {
      const res = await request(app)
        .post(`/api/v1/shortlists/${candidateProfileId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_SHORTLISTED');
    });

    it('should retrieve shortlisted profiles with redacted public details', async () => {
      const res = await request(app)
        .get('/api/v1/shortlists')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].profile.displayName).toBe('Ananya K.');
    });

    it('should successfully remove profile from shortlist', async () => {
      const res = await request(app)
        .delete(`/api/v1/shortlists/${candidateProfileId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Interest Workflow API (/api/v1/interests)', () => {
    it('should reject self-interest with 400 SELF_INTEREST_PROHIBITED', async () => {
      const res = await request(app)
        .post(`/api/v1/interests/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_INTEREST_PROHIBITED');
    });

    it('should successfully express interest in candidate profile', async () => {
      const res = await request(app)
        .post(`/api/v1/interests/${candidateProfileId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.senderId).toBe(user1Id);

      activeInterestId = res.body.data.id;
    });

    it('should reject duplicate interest with 409 DUPLICATE_INTEREST', async () => {
      const res = await request(app)
        .post(`/api/v1/interests/${candidateProfileId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_INTEREST');
    });

    it('should allow sender to view outgoing interest in sent list', async () => {
      const res = await request(app)
        .get('/api/v1/interests/sent')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      const item = res.body.data.find((i: any) => i.id === activeInterestId);
      expect(item).toBeDefined();
      expect(item.status).toBe('pending');
      expect(item.profile.displayName).toBe('Ananya K.');
    });

    it('should allow receiver to view incoming interest in received list', async () => {
      const res = await request(app)
        .get('/api/v1/interests/received')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      const item = res.body.data.find((i: any) => i.id === activeInterestId);
      expect(item).toBeDefined();
      expect(item.status).toBe('pending');
    });

    it('should reject unauthorized third-party from accepting or declining (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .patch(`/api/v1/interests/${activeInterestId}`)
        .set('Authorization', `Bearer ${user3Token}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject the original sender from accepting their own interest (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .patch(`/api/v1/interests/${activeInterestId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject non-sender from withdrawing an interest (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .delete(`/api/v1/interests/${activeInterestId}`)
        .set('Authorization', `Bearer ${user2Token}`); // Receiver cannot withdraw

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow recipient to accept interest and create mutual match', async () => {
      const res = await request(app)
        .patch(`/api/v1/interests/${activeInterestId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('accepted');
    });

    it('should reject invalid status transitions once accepted (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/interests/${activeInterestId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'declined' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('should reject withdrawal of an already accepted interest (400)', async () => {
      const res = await request(app)
        .delete(`/api/v1/interests/${activeInterestId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('should allow sender to withdraw a pending interest', async () => {
      // Create a fresh pending interest between user3 and user2
      const freshRes = await request(app)
        .post(`/api/v1/interests/${candidateProfileId}`)
        .set('Authorization', `Bearer ${user3Token}`);

      expect(freshRes.status).toBe(201);
      const freshInterestId = freshRes.body.data.id;

      // Sender withdraws
      const withdrawRes = await request(app)
        .delete(`/api/v1/interests/${freshInterestId}`)
        .set('Authorization', `Bearer ${user3Token}`);

      expect(withdrawRes.status).toBe(200);
      expect(withdrawRes.body.success).toBe(true);
    });
  });
});
