import request from 'supertest';
import { createApp } from '../src/app';
import { config } from '../src/config/env';

describe('Authentication & Security Suite (/api/v1/auth)', () => {
  const app = createApp();
  const testMobile = '9876543210';
  let verificationToken = '';
  let accessToken = '';
  let refreshToken = '';

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
      refreshToken = response.body.data.tokens.refreshToken;
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

  describe('Token Validation & Refresh Suite (/api/v1/auth/refresh)', () => {
    it('should reject mock placeholder token with 401 INVALID_TOKEN', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock_dev_session_token');

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'INVALID_TOKEN');
      expect(response.body.message).toContain('Invalid authentication token');
    });

    it('should reject request without refresh token with 400', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject unknown or invalid refresh token with 401', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid_nonexistent_refresh_token_64chars_random_hex_string' });

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'INVALID_REFRESH_TOKEN');
    });

    it('should successfully refresh session and rotate refresh token with valid refreshToken', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');

      // Verify the new access token works
      const newAccessToken = response.body.data.tokens.accessToken;
      const meResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.mobile).toBe(testMobile);

      // Update active tokens
      accessToken = newAccessToken;
      refreshToken = response.body.data.tokens.refreshToken;
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
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Production OTP Security Guard', () => {
    it('should strictly reject mock OTP in production mode with 503 SMS_GATEWAY_UNCONFIGURED', async () => {
      const originalIsProd = config.isProduction;
      try {
        config.isProduction = true;
        const response = await request(app)
          .post('/api/v1/auth/request-otp')
          .send({ mobile: '9988776655' });

        expect(response.status).toBe(503);
        expect(response.body.error).toHaveProperty('code', 'SMS_GATEWAY_UNCONFIGURED');
        expect(response.body.message).toContain('Real SMS delivery is required');
      } finally {
        config.isProduction = originalIsProd;
      }
    });
  });
});
