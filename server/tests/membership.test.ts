import request from 'supertest';
import { createApp } from '../src/app';
import { TokenService } from '../src/services/token.service';
import {
  MembershipService,
  inMemoryMembershipStore,
} from '../src/services/membership.service';
import { config } from '../src/config/env';

describe('Membership Plans & Entitlements Suite (/api/v1/membership)', () => {
  const app = createApp();

  const testUserId = 'usr_member_test_1';
  const testUserToken = TokenService.generateTokens({
    userId: testUserId,
    mobile: '9811199999',
    role: 'member',
  }).accessToken;

  const upgradedUserId = 'usr_member_test_plus';
  const upgradedUserToken = TokenService.generateTokens({
    userId: upgradedUserId,
    mobile: '9811188888',
    role: 'member',
  }).accessToken;

  beforeAll(() => {
    // Seed an upgraded membership in the in-memory fallback store
    inMemoryMembershipStore.set(upgradedUserId, {
      id: 'mem_seed_1',
      userId: upgradedUserId,
      planId: 'plus',
      status: 'active',
      contactDisclosuresUsed: 5,
      startDate: new Date(),
    });
  });

  describe('1. Membership Plans Catalog (GET /api/v1/membership/plans)', () => {
    it('should return available membership plans without requiring authentication', async () => {
      const res = await request(app).get('/api/v1/membership/plans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      const planIds = res.body.data.map((p: any) => p.id);
      expect(planIds).toContain('free');
      expect(planIds).toContain('plus');
      expect(planIds).toContain('premium');
    });

    it('should enforce distinct entitlements between Free, Plus, and Premium plans', async () => {
      const res = await request(app).get('/api/v1/membership/plans');
      const plans = res.body.data;

      const freePlan = plans.find((p: any) => p.id === 'free');
      const plusPlan = plans.find((p: any) => p.id === 'plus');
      const premiumPlan = plans.find((p: any) => p.id === 'premium');

      // Free tier assertions
      expect(freePlan.priceInr).toBe(0);
      expect(freePlan.entitlements.canInitiateChat).toBe(false);
      expect(freePlan.entitlements.contactDisclosuresLimit).toBe(0);

      // Plus tier assertions
      expect(plusPlan.priceInr).toBeGreaterThan(0);
      expect(plusPlan.entitlements.canInitiateChat).toBe(true);
      expect(plusPlan.entitlements.contactDisclosuresLimit).toBe(25);
      expect(plusPlan.entitlements.relationshipAdvisorConsult).toBe(false);

      // Premium tier assertions
      expect(premiumPlan.priceInr).toBeGreaterThan(plusPlan.priceInr);
      expect(premiumPlan.entitlements.canInitiateChat).toBe(true);
      expect(premiumPlan.entitlements.contactDisclosuresLimit).toBe(75);
      expect(premiumPlan.entitlements.relationshipAdvisorConsult).toBe(true);
    });
  });

  describe('2. User Active Membership & Entitlements (GET /api/v1/membership/me)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/membership/me');
      expect(res.status).toBe(401);
    });

    it('should default a new user to active Free plan with 0 contacts', async () => {
      const res = await request(app)
        .get('/api/v1/membership/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.planId).toBe('free');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.entitlements.canInitiateChat).toBe(false);
      expect(res.body.data.entitlements.contactDisclosuresLimit).toBe(0);
      expect(res.body.data.entitlements.contactDisclosuresRemaining).toBe(0);
    });

    it('should accurately calculate remaining contact disclosures for an upgraded user', async () => {
      const res = await request(app)
        .get('/api/v1/membership/me')
        .set('Authorization', `Bearer ${upgradedUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.planId).toBe('plus');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.entitlements.canInitiateChat).toBe(true);
      expect(res.body.data.entitlements.contactDisclosuresLimit).toBe(25);
      expect(res.body.data.entitlements.contactDisclosuresUsed).toBe(5);
      expect(res.body.data.entitlements.contactDisclosuresRemaining).toBe(20); // 25 - 5 = 20
    });
  });

  describe('3. Checkout Restrictions & Security (POST /api/v1/membership/checkout)', () => {
    it('should reject unauthenticated checkout with 401', async () => {
      const res = await request(app)
        .post('/api/v1/membership/checkout')
        .send({ planId: 'plus' });

      expect(res.status).toBe(401);
    });

    it('should reject checkout request for free plan with 400', async () => {
      const res = await request(app)
        .post('/api/v1/membership/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ planId: 'free' });

      expect(res.status).toBe(400);
    });

    it('should reject checkout request with invalid plan tier with 400', async () => {
      const res = await request(app)
        .post('/api/v1/membership/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ planId: 'ultra_vip_unlimited' });

      expect(res.status).toBe(400);
    });

    it('should return a structured unconfigured advisory and NEVER activate subscription from client request', async () => {
      const res = await request(app)
        .post('/api/v1/membership/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ planId: 'premium' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkoutAvailable).toBe(false);
      expect(res.body.data.paymentGatewayStatus).toBe('unconfigured');
      expect(res.body.data.planId).toBe('premium');
      expect(res.body.data.amountInr).toBe(4999);
      expect(res.body.data.currency).toBe('INR');

      // CRITICAL SECURITY ASSERTION: User's membership must NOT be upgraded to premium
      const checkRes = await request(app)
        .get('/api/v1/membership/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(checkRes.body.data.planId).toBe('free');
      expect(checkRes.body.data.entitlements.canInitiateChat).toBe(false);
    });
  });

  describe('4. Production Database Fallback Guard', () => {
    it('should throw 503 DATABASE_UNAVAILABLE when running in production without MongoDB', async () => {
      const originalIsProd = config.isProduction;
      try {
        config.isProduction = true;
        await expect(MembershipService.getUserMembership('usr_prod_test')).rejects.toThrow(
          /Database connection required in production mode/
        );
      } finally {
        config.isProduction = originalIsProd;
      }
    });
  });
});
