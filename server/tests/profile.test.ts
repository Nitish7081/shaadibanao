import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { config } from '../src/config/env';
import { TokenService } from '../src/services/token.service';
import { UpsertProfileInput, PartnerPreferencesInput } from '@bandhansetu/shared';

describe('Profile & Partner Preferences Suite (/api/v1/profiles & /preferences)', () => {
  const app = createApp();

  // Generate test user auth token
  const testUserId = 'usr_test_12345';
  const testMobile = '9811122233';
  const authToken = TokenService.generateTokens({
    userId: testUserId,
    mobile: testMobile,
    role: 'member',
  }).accessToken;

  const validProfile: UpsertProfileInput = {
    firstName: 'Priya',
    lastName: 'Sharma',
    gender: 'female',
    dateOfBirth: '1998-05-14',
    maritalStatus: 'never_married',
    heightCm: 163,
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
    fatherOccupation: 'Engineer',
    motherOccupation: 'Homemaker',
    education: 'MBA in Marketing',
    employedIn: 'private',
    occupation: 'Product Manager',
    annualIncomeBand: '₹15L - ₹25L',
    showIncomeBand: true,
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
        isMain: true,
        privacy: 'blurred',
        approved: true,
      },
    ],
    photoPrivacy: 'blurred',
    aboutMe: 'Passionate product builder who enjoys travel, art, and spending time with family.',
  };

  const validPreferences: PartnerPreferencesInput = {
    minAge: 25,
    maxAge: 32,
    minHeightCm: 168,
    maxHeightCm: 188,
    maritalStatuses: ['never_married'],
    religions: ['Hindu'],
    motherTongues: ['Hindi', 'Punjabi'],
    educations: ['MBA', 'B.Tech'],
    occupations: ['Software Engineer', 'Product Manager'],
    cities: ['Delhi NCR', 'Gurgaon', 'Noida'],
    manglikPreference: 'any',
  };

  describe('Unauthenticated Access Control', () => {
    it('should reject GET /api/v1/profiles/me with 401', async () => {
      const res = await request(app).get('/api/v1/profiles/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject PUT /api/v1/profiles/me with 401', async () => {
      const res = await request(app).put('/api/v1/profiles/me').send(validProfile);
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject GET /api/v1/preferences/me with 401', async () => {
      const res = await request(app).get('/api/v1/preferences/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject PUT /api/v1/profiles/me with 401 INVALID_TOKEN when mock placeholder token is used', async () => {
      const res = await request(app)
        .put('/api/v1/profiles/me')
        .set('Authorization', 'Bearer mock_dev_session_token')
        .send(validProfile);

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_TOKEN');
      expect(res.body.message).toContain('Invalid authentication token');
    });

    it('should reject PUT /api/v1/preferences/me with 401 INVALID_TOKEN when mock placeholder token is used', async () => {
      const res = await request(app)
        .put('/api/v1/preferences/me')
        .set('Authorization', 'Bearer mock_dev_session_token')
        .send(validPreferences);

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_TOKEN');
      expect(res.body.message).toContain('Invalid authentication token');
    });

    it('should reject PUT /api/v1/preferences/me with 401 TOKEN_EXPIRED when access token has expired', async () => {
      const expiredToken = jwt.sign(
        { userId: testUserId, mobile: testMobile, role: 'member' },
        config.jwt.accessSecret,
        { expiresIn: '0s' }
      );

      const res = await request(app)
        .put('/api/v1/preferences/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(validPreferences);

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'TOKEN_EXPIRED');
      expect(res.body.message).toContain('Access token has expired');
    });
  });

  describe('Input Validation & Error Handling', () => {
    it('should reject profile with invalid height (out of bounds) with 400', async () => {
      const invalidData = {
        ...validProfile,
        heightCm: 50, // Below 120cm minimum
      };

      const res = await request(app)
        .put('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject profile with missing required fields with 400', async () => {
      const res = await request(app)
        .put('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Priya' });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Profile Creation & Updates', () => {
    it('should create profile, calculate age, and calculate completeness score', async () => {
      const res = await request(app)
        .put('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validProfile);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('firstName', 'Priya');
      expect(res.body.data).toHaveProperty('lastName', 'Sharma');
      expect(res.body.data).toHaveProperty('age');
      expect(res.body.data.age).toBeGreaterThanOrEqual(18);
      expect(res.body.data).toHaveProperty('completenessPercent');
      expect(res.body.data.completenessPercent).toBeGreaterThan(50);
      expect(res.body.data).toHaveProperty('photoPrivacy', 'blurred');
    });

    it('should retrieve my profile via GET /api/v1/profiles/me', async () => {
      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('firstName', 'Priya');
      expect(res.body.data).toHaveProperty('city', 'Delhi NCR');
      expect(res.body.data).toHaveProperty('occupation', 'Product Manager');
    });
  });

  describe('Privacy Display Rules Enforcement on Public View', () => {
    it('should return redacted public profile with First Name + Last Initial (Priya S.)', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('displayName', 'Priya S.');
      expect(res.body.data).not.toHaveProperty('lastName'); // Full last name is hidden!
      expect(res.body.data).not.toHaveProperty('mobile'); // Contact info is hidden!
      expect(res.body.data).not.toHaveProperty('email');
      expect(res.body.data).toHaveProperty('isContactLocked', true);
    });

    it('should apply photo privacy blurring when photoPrivacy is blurred', async () => {
      const res = await request(app)
        .get(`/api/v1/profiles/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('photos');
      expect(res.body.data.photos[0]).toHaveProperty('isBlurred', true);
    });
  });

  describe('Partner Preferences', () => {
    it('should save and update partner preferences via PUT /api/v1/preferences/me', async () => {
      const res = await request(app)
        .put('/api/v1/preferences/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPreferences);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('minAge', 25);
      expect(res.body.data).toHaveProperty('maxAge', 32);
      expect(res.body.data.cities).toContain('Delhi NCR');
    });

    it('should retrieve saved partner preferences via GET /api/v1/preferences/me', async () => {
      const res = await request(app)
        .get('/api/v1/preferences/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('minAge', 25);
      expect(res.body.data.occupations).toContain('Product Manager');
    });
  });
});
