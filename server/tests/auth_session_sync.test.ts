import request from 'supertest';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import { AuthService } from '../src/services/auth.service';
import {
  registerMockUserApprovalForTesting,
  clearMockUserApprovalForTesting,
} from '../src/middleware/approval.middleware';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env';

describe('Session Expiry & Token Refresh Verification Suite', () => {
  const app = createApp();
  const testUserId = `usr_test_${Date.now()}`;
  const testMobile = '9876500001';
  let validAccessToken: string;
  let expiredAccessToken: string;
  let validRefreshToken: string;

  beforeAll(async () => {
    // Generate valid tokens
    const tokens = TokenService.generateTokens({
      userId: testUserId,
      mobile: testMobile,
      role: 'member',
    });
    validAccessToken = tokens.accessToken;
    validRefreshToken = tokens.refreshToken;

    // Register user in memory or DB
    const tokenHash = TokenService.hashToken(validRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const testUser = {
      _id: testUserId,
      id: testUserId,
      mobile: testMobile,
      role: 'member',
      status: 'active',
      approvalStatus: 'approved',
      hasProfile: true,
      phoneVerified: true,
      refreshTokens: [{ tokenHash, expiresAt, createdAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    AuthService.registerInMemoryUserForTesting(testUser);

    // Generate an expired access token (-10 seconds)
    expiredAccessToken = jwt.sign(
      { userId: testUserId, mobile: testMobile, role: 'member' },
      config.jwt.accessSecret,
      { expiresIn: '-10s' }
    );
  });

  describe('1. Access Token Expiry Contract (/api/v1/auth/me)', () => {
    it('should allow access with valid access token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(testUserId);
    });

    it('should strictly reject expired access token with 401 TOKEN_EXPIRED', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredAccessToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
      expect(res.body.message).toContain('Access token has expired. Please refresh your session.');
    });
  });

  describe('2. Backend Token Refresh & Rotation (/api/v1/auth/refresh)', () => {
    it('should refresh session and issue new access & refresh tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');

      // Update tokens for subsequent tests
      const rotatedAccessToken = res.body.data.tokens.accessToken;
      const rotatedRefreshToken = res.body.data.tokens.refreshToken;

      // Verify the rotated access token immediately works
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rotatedAccessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.id).toBe(testUserId);

      // Verify that old refresh token has been invalidated (rotation security)
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');

      // Save new refresh token
      validRefreshToken = rotatedRefreshToken;
      validAccessToken = rotatedAccessToken;
    });

    it('should reject refresh when refresh token is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'completely_invalid_token' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('3. Concurrency & Mutex Simulation (Single In-Flight Refresh)', () => {
    it('should successfully synchronize multiple concurrent refresh requests using in-flight promise deduplication', async () => {
      // Simulate client-side mutex:
      let activeRefreshPromise: Promise<string | null> | null = null;
      let networkCallsCount = 0;

      const clientRefreshSession = async (token: string): Promise<string | null> => {
        if (activeRefreshPromise) {
          return activeRefreshPromise;
        }

        activeRefreshPromise = (async () => {
          try {
            networkCallsCount++;
            const res = await request(app)
              .post('/api/v1/auth/refresh')
              .send({ refreshToken: token });

            if (res.status === 200 && res.body.data?.tokens) {
              validRefreshToken = res.body.data.tokens.refreshToken;
              return res.body.data.tokens.accessToken;
            }
            return null;
          } finally {
            activeRefreshPromise = null;
          }
        })();

        return activeRefreshPromise;
      };

      // Launch 5 concurrent refresh requests with the same refresh token
      const results = await Promise.all([
        clientRefreshSession(validRefreshToken),
        clientRefreshSession(validRefreshToken),
        clientRefreshSession(validRefreshToken),
        clientRefreshSession(validRefreshToken),
        clientRefreshSession(validRefreshToken),
      ]);

      // All 5 requests must succeed and receive the EXACT SAME access token
      expect(results.length).toBe(5);
      const firstToken = results[0];
      expect(firstToken).toBeTruthy();
      results.forEach((token) => expect(token).toBe(firstToken));

      // Network call was executed EXACTLY ONCE (no race condition / rotation conflict)
      expect(networkCallsCount).toBe(1);
    });
  });

  describe('4. Error Classification (401 vs 403 vs Network)', () => {
    afterAll(() => {
      clearMockUserApprovalForTesting();
    });

    it('should NOT treat 403 FORBIDDEN or SUSPENDED as an expired token', async () => {
      // Register a suspended user
      const suspendedId = `usr_suspended_${Date.now()}`;
      const suspendedTokens = TokenService.generateTokens({
        userId: suspendedId,
        mobile: '9876500002',
        role: 'member',
      });
      const suspendedUser = {
        _id: suspendedId,
        id: suspendedId,
        mobile: '9876500002',
        role: 'member',
        status: 'suspended',
        approvalStatus: 'approved',
        refreshTokens: [],
      };
      AuthService.registerInMemoryUserForTesting(suspendedUser);
      registerMockUserApprovalForTesting(suspendedId, suspendedUser);

      // Calling search or protected APIs
      const res = await request(app)
        .get('/api/v1/search')
        .set('Authorization', `Bearer ${suspendedTokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
      // Status is 403, NOT 401 TOKEN_EXPIRED
      expect(res.status).not.toBe(401);
    });
  });
});
