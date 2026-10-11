import request from 'supertest';
import { createApp } from '../src/app';

describe('Authentication & Security Suite (/api/v1/auth)', () => {
  const app = createApp();
  const testMobile = '9876543210';
  let verificationToken = '';
  let accessToken = '';

  describe('POST /api/v1/auth/request-otp', () => {
    it('should reject invalid mobile number formats with 400', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ mobile: '123' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should issue an OTP in development mock mode with explicit test hint', async () => {
      const response = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ mobile: testMobile });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('mobile', testMobile);
      expect(response.body.data).toHaveProperty('deliveryMode', 'development_mock');
      expect(response.body.data).toHaveProperty('expiresInSeconds', 300);
      expect(response.body.data).toHaveProperty('devTestOtpHint');
      expect(response.body.data.devTestOtpHint).toContain('123456');
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('should reject wrong OTP with 400 and report remaining attempts', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ mobile: testMobile, otp: '999999' });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'INVALID_OTP');
      expect(response.body.error.details).toHaveProperty('attemptsLeft');
    });

    it('should verify development test OTP 123456 and issue verificationToken for new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ mobile: testMobile, otp: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('verified', true);
      expect(response.body.data).toHaveProperty('verificationToken');
      verificationToken = response.body.data.verificationToken;
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should reject registration if terms consent is not true', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          mobile: testMobile,
          verificationToken,
          profileFor: 'myself',
          consentToTerms: false,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should successfully register account, enforce unique mobile, and issue JWT tokens', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          mobile: testMobile,
          verificationToken,
          profileFor: 'myself',
          consentToTerms: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('mobile', testMobile);
      expect(response.body.data.user).toHaveProperty('role', 'member');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');

      accessToken = response.body.data.tokens.accessToken;
    });

    it('should reject duplicate registration for existing mobile', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          mobile: testMobile,
          verificationToken,
          profileFor: 'myself',
          consentToTerms: true,
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toHaveProperty('code', 'USER_ALREADY_EXISTS');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject unauthorized request without token', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return current user profile when valid Bearer token is provided', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user).toHaveProperty('mobile', testMobile);
      expect(response.body.data.user).toHaveProperty('role', 'member');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should successfully revoke session on logout', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
});
