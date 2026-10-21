import request from 'supertest';
import { createApp } from '../src/app';
import { setFirebaseTokenVerifierForTesting, DecodedFirebaseToken } from '../src/config/firebase';
import { AppError } from '../src/middleware/errorHandler';

describe('Firebase Authentication & Account Linking Suite (/api/v1/auth/firebase-login)', () => {
  const app = createApp();

  afterAll(() => {
    // Reset test verifier override
    setFirebaseTokenVerifierForTesting(null);
  });

  describe('Validation & Security Checks', () => {
    it('should reject request missing idToken with 400 VALIDATION_ERROR', async () => {
      const response = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject invalid or expired Firebase ID tokens with 401 INVALID_FIREBASE_TOKEN', async () => {
      setFirebaseTokenVerifierForTesting(async () => {
        throw new AppError('Invalid Firebase authentication token: decoding failed', 401, 'INVALID_FIREBASE_TOKEN');
      });

      const response = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ idToken: 'invalid_raw_token' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'INVALID_FIREBASE_TOKEN');
    });

    it('should strictly reject Google accounts with unverified email (Rule 5)', async () => {
      setFirebaseTokenVerifierForTesting(async () => ({
        uid: 'fb_unverified_user',
        email: 'unverified@example.com',
        email_verified: false,
        signInProvider: 'google.com',
      }));

      const response = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ idToken: 'token_with_unverified_email' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'UNVERIFIED_EMAIL');
    });
  });

  describe('New User Registration via Firebase', () => {
    let phoneUserToken = '';

    it('should successfully register a new user via Firebase Phone OTP', async () => {
      const mockPhone = '9811223344';
      const mockUid = 'fb_phone_uid_101';

      setFirebaseTokenVerifierForTesting(async () => ({
        uid: mockUid,
        phone_number: `+91${mockPhone}`,
        signInProvider: 'phone',
      }));

      const response = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ idToken: 'valid_phone_token', profileFor: 'myself' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('isNewUser', true);
      expect(response.body.data.user).toHaveProperty('mobile', mockPhone);
      expect(response.body.data.user).toHaveProperty('firebaseUid', mockUid);
      expect(response.body.data.user).toHaveProperty('authProvider', 'phone');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');

      phoneUserToken = response.body.data.tokens.accessToken;
    });

    it('should allow newly created Firebase Phone user to access protected /api/v1/auth/me', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${phoneUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user).toHaveProperty('mobile', '9811223344');
      expect(response.body.data.user).toHaveProperty('firebaseUid', 'fb_phone_uid_101');
    });

    it('should successfully register a new user via Google Sign-In with verified email', async () => {
      const mockEmail = 'priya.sharma@example.com';
      const mockUid = 'fb_google_uid_202';

      setFirebaseTokenVerifierForTesting(async () => ({
        uid: mockUid,
        email: mockEmail,
        email_verified: true,
        name: 'Priya Sharma',
        picture: 'https://lh3.googleusercontent.com/a/photo123',
        signInProvider: 'google.com',
      }));

      const response = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ idToken: 'valid_google_token' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('isNewUser', true);
      expect(response.body.data.user).toHaveProperty('email', mockEmail);
      expect(response.body.data.user).toHaveProperty('firebaseUid', mockUid);
      expect(response.body.data.user).toHaveProperty('authProvider', 'google');
      expect(response.body.data.user).toHaveProperty('displayName', 'Priya Sharma');
    });
  });

  describe('Account Linking & Existing User Login', () => {
    it('should log in existing user by firebaseUid and report isNewUser: false', async () => {
      setFirebaseTokenVerifierForTesting(async () => ({
        uid: 'fb_phone_uid_101',
        phone_number: '+919811223344',
        signInProvider: 'phone',
      }));

      const response = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ idToken: 'returning_phone_token' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('isNewUser', false);
      expect(response.body.data.user).toHaveProperty('mobile', '9811223344');
      expect(response.body.data.user).toHaveProperty('firebaseUid', 'fb_phone_uid_101');
    });

    it('should safely link firebaseUid to an existing pre-registered mobile user without duplicating records', async () => {
      const preExistingPhone = '9777888999';
      // Register existing account via standard route
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          mobile: preExistingPhone,
          verificationToken: 'valid_mock_token.test',
          profileFor: 'myself',
          consentToTerms: true,
        });

      const existingUserId = regRes.body.data.user.id;
      expect(existingUserId).toBeDefined();

      // Now authenticate that same mobile number via Firebase Phone Auth with a new UID
      const newFirebaseUid = 'fb_linked_uid_999';
      setFirebaseTokenVerifierForTesting(async () => ({
        uid: newFirebaseUid,
        phone_number: `+91${preExistingPhone}`,
        signInProvider: 'phone',
      }));

      const linkResponse = await request(app)
        .post('/api/v1/auth/firebase-login')
        .send({ idToken: 'phone_token_to_link' });

      expect(linkResponse.status).toBe(200);
      expect(linkResponse.body.data).toHaveProperty('isNewUser', false);
      expect(linkResponse.body.data.user).toHaveProperty('id', existingUserId);
      expect(linkResponse.body.data.user).toHaveProperty('mobile', preExistingPhone);
      expect(linkResponse.body.data.user).toHaveProperty('firebaseUid', newFirebaseUid);
    });
  });
});
