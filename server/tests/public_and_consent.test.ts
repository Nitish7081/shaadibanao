import request from 'supertest';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_VERSION,
} from '@bandhansetu/shared';
import { createApp } from '../src/app';
import { config } from '../src/config/env';
import { setFirebaseTokenVerifierForTesting } from '../src/config/firebase';
import { AuthService } from '../src/services/auth.service';

describe('Public Website APIs, Consent Audit & Verified Account Deletion Suite', () => {
  const app = createApp();
  const originalOtpMode = config.otp.deliveryMode;

  beforeAll(() => {
    config.otp.deliveryMode = 'development_mock';
  });

  afterAll(() => {
    config.otp.deliveryMode = originalOtpMode;
    setFirebaseTokenVerifierForTesting(null);
  });

  describe('1. Public Legal Endpoints (/api/v1/public/privacy-policy & /terms)', () => {
    it('GET /api/v1/public/privacy-policy opens publicly without login and exposes verified data sections', async () => {
      const res = await request(app).get('/api/v1/public/privacy-policy');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentType).toBe('privacy_policy');
      expect(res.body.data.version).toBe(CURRENT_PRIVACY_POLICY_VERSION);
      expect(res.body.data.tagline).toBe('Rishton ki nayi shuruaat');
      expect(Array.isArray(res.body.data.sections)).toBe(true);
      expect(res.body.data.sections.length).toBeGreaterThanOrEqual(18);
      // Verify placeholder safety when contact env vars are unset
      expect(res.body.data.developerContact.supportEmail).toBeDefined();
    });

    it('GET /api/v1/public/terms opens publicly without login and includes all required sections', async () => {
      const res = await request(app).get('/api/v1/public/terms');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentType).toBe('terms_and_conditions');
      expect(res.body.data.version).toBe(CURRENT_TERMS_VERSION);
      expect(res.body.data.sections.length).toBeGreaterThanOrEqual(11);
    });

    it('GET / serves the official ShaadiBanao website HTML', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/html');
      expect(res.text).toContain('ShaadiBanao');
    });

    it('GET /privacy-policy serves the official Privacy Policy HTML page', async () => {
      const res = await request(app).get('/privacy-policy');
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/html');
      expect(res.text).toContain('ShaadiBanao');
    });
  });

  describe('2. Contact & Grievance Form (/api/v1/public/contact)', () => {
    it('rejects invalid contact form submissions with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/v1/public/contact').send({
        name: 'A',
        email: 'not-an-email',
        subject: 'Hi',
        message: 'Too short',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects honeypot bot spam submissions with 400 SPAM_DETECTED', async () => {
      const res = await request(app).post('/api/v1/public/contact').send({
        name: 'Bot Spammer',
        email: 'bot@example.com',
        category: 'general_support',
        subject: 'Automated inquiry message',
        message: 'This is a bot filling out the hidden website honeypot field.',
        website: 'https://spam-bot.invalid',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SPAM_DETECTED');
    });

    it('accepts valid support inquiries and returns a unique SUP- reference ticket ID', async () => {
      const res = await request(app).post('/api/v1/public/contact').send({
        name: 'Aarav Verma',
        email: 'aarav.verma@example.com',
        phone: '9876501234',
        category: 'privacy_data_request',
        subject: 'Question regarding profile photo visibility',
        message:
          'Namaste team, I would like clarification on how blurred profile photo permissions work after interest acceptance.',
        website: '',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketId).toMatch(/^SUP-\d{8}-[A-Z0-9]{6}$/);
      expect(res.body.data.status).toBe('received');
    });
  });

  describe('3. Registration Consent, Auditable Versioning & Material Re-Consent Flow', () => {
    const consentPhone = '9822334455';
    let userAccessToken = '';
    let registeredUserId = '';

    it('rejects Firebase new-user account creation when consentToTerms is explicitly false', async () => {
      setFirebaseTokenVerifierForTesting(async () => ({
        uid: 'fb_no_consent_uid',
        email: 'noconsent.newuser@example.com',
        email_verified: true,
        name: 'Unconsented User',
        signInProvider: 'google.com',
      }));

      const res = await request(app).post('/api/v1/auth/firebase-login').send({
        idToken: 'valid_token_without_consent',
        profileFor: 'myself',
        consentToTerms: false,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
    });

    it('saves consent version, policy version, timestamp and auditable ConsentLog on registration', async () => {
      await request(app).post('/api/v1/auth/request-otp').send({ mobile: consentPhone });
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ mobile: consentPhone, otp: '123456' });

      const regRes = await request(app).post('/api/v1/auth/register').send({
        mobile: consentPhone,
        verificationToken: verifyRes.body.data.verificationToken,
        profileFor: 'myself',
        consentToTerms: true,
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
      });

      expect(regRes.status).toBe(201);
      const user = regRes.body.data.user;
      registeredUserId = user.id;
      userAccessToken = regRes.body.data.tokens.accessToken;

      expect(user.consent).toBeDefined();
      expect(user.consent.privacyPolicyVersion).toBe(CURRENT_PRIVACY_POLICY_VERSION);
      expect(user.consent.termsVersion).toBe(CURRENT_TERMS_VERSION);
      expect(new Date(user.consent.agreedAt).getTime()).toBeGreaterThan(0);
      expect(user.requiresReconsent).toBe(false);

      const logs = await AuthService.getConsentAuditLogsForUser(registeredUserId);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].privacyPolicyVersion).toBe(CURRENT_PRIVACY_POLICY_VERSION);
      expect(logs[0].termsVersion).toBe(CURRENT_TERMS_VERSION);
      expect(logs[0].consentType).toBe('registration');
    });

    it('flags requiresReconsent when user has an older policy version and clears it after POST /api/v1/auth/consent', async () => {
      const legacyUserId = 'usr_legacy_policy_100';
      AuthService.registerInMemoryUserForTesting({
        id: legacyUserId,
        _id: legacyUserId,
        mobile: '9833445566',
        role: 'member',
        status: 'active',
        approvalStatus: 'approved',
        hasProfile: true,
        profileFor: 'myself',
        consent: {
          agreedAt: new Date('2025-01-01T00:00:00.000Z'),
          termsVersion: 'v1.0',
          privacyPolicyVersion: 'v1.0',
        },
        refreshTokens: [],
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      await request(app).post('/api/v1/auth/request-otp').send({ mobile: '9833445566' });
      const loginRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ mobile: '9833445566', otp: '123456' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.auth.user.requiresReconsent).toBe(true);
      const legacyToken = loginRes.body.data.auth.tokens.accessToken;

      const reconsentRes = await request(app)
        .post('/api/v1/auth/consent')
        .set('Authorization', `Bearer ${legacyToken}`)
        .send({
          consentToTerms: true,
          privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          termsVersion: CURRENT_TERMS_VERSION,
          source: 'mobile_reconsent',
        });

      expect(reconsentRes.status).toBe(200);
      expect(reconsentRes.body.data.user.requiresReconsent).toBe(false);
      expect(reconsentRes.body.data.user.consent.privacyPolicyVersion).toBe(
        CURRENT_PRIVACY_POLICY_VERSION
      );

      const legacyLogs = await AuthService.getConsentAuditLogsForUser(legacyUserId);
      expect(legacyLogs.some((l) => l.consentType === 'reconsent')).toBe(true);
    });
  });

  describe('4. Verified Account Deletion & Unauthorized Deletion Rejection', () => {
    const victimMobile = '9844556677';
    const attackerMobile = '9855667788';
    let victimToken = '';
    let attackerToken = '';

    beforeAll(async () => {
      // Create victim user
      await request(app).post('/api/v1/auth/request-otp').send({ mobile: victimMobile });
      const vOtp = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ mobile: victimMobile, otp: '123456' });
      const vReg = await request(app).post('/api/v1/auth/register').send({
        mobile: victimMobile,
        verificationToken: vOtp.body.data.verificationToken,
        profileFor: 'myself',
        consentToTerms: true,
      });
      victimToken = vReg.body.data.tokens.accessToken;

      // Create attacker user
      await request(app).post('/api/v1/auth/request-otp').send({ mobile: attackerMobile });
      const aOtp = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ mobile: attackerMobile, otp: '123456' });
      const aReg = await request(app).post('/api/v1/auth/register').send({
        mobile: attackerMobile,
        verificationToken: aOtp.body.data.verificationToken,
        profileFor: 'myself',
        consentToTerms: true,
      });
      attackerToken = aReg.body.data.tokens.accessToken;
    });

    it('rejects unauthenticated deletion attempts without OTP or token (401 VERIFICATION_REQUIRED)', async () => {
      const res = await request(app).post('/api/v1/public/account-deletion').send({
        identifier: victimMobile,
        reason: 'privacy_concerns',
        confirmPermanentDeletion: true,
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('VERIFICATION_REQUIRED');
    });

    it('rejects unauthorized cross-account deletion when User B tries to delete User A (403 IDENTITY_MISMATCH)', async () => {
      const res = await request(app)
        .post('/api/v1/public/account-deletion')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          identifier: victimMobile,
          reason: 'other',
          confirmPermanentDeletion: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('IDENTITY_MISMATCH');
    });

    it('rejects deletion with wrong OTP code (401 INVALID_VERIFICATION_CODE)', async () => {
      const challengeRes = await request(app)
        .post('/api/v1/public/account-deletion/request-otp')
        .send({ identifier: victimMobile });
      expect(challengeRes.status).toBe(200);

      const wrongRes = await request(app).post('/api/v1/public/account-deletion').send({
        identifier: victimMobile,
        otp: '000000',
        reason: 'taking_a_break',
        confirmPermanentDeletion: true,
      });
      expect(wrongRes.status).toBe(401);
      expect(wrongRes.body.error.code).toBe('INVALID_VERIFICATION_CODE');
    });

    it('completes verified OTP deletion on web, returns DEL- reference ID, invalidates account, and exposes safe status', async () => {
      const delRes = await request(app).post('/api/v1/public/account-deletion').send({
        identifier: victimMobile,
        otp: '123456',
        reason: 'found_match_on_shaadibanao',
        additionalFeedback: 'Thank you ShaadiBanao!',
        confirmPermanentDeletion: true,
      });

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      const refId = delRes.body.data.requestId;
      expect(refId).toMatch(/^DEL-\d{8}-[A-Z0-9]{6}$/);
      expect(delRes.body.data.status).toBe('completed');
      expect(delRes.body.data.maskedIdentifier).toBe('+91 ******6677');
      // Must never leak raw mobile number in response
      expect(JSON.stringify(delRes.body.data)).not.toContain(victimMobile);

      // Deleted user's old JWT access token must no longer resolve an active account
      const meAfterDelete = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${victimToken}`);
      expect(meAfterDelete.status).toBe(404);

      // Public status lookup works with Reference ID and hides private info
      const statusRes = await request(app).get(`/api/v1/public/account-deletion/${refId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.requestId).toBe(refId);
      expect(statusRes.body.data.status).toBe('completed');
      expect(statusRes.body.data.maskedIdentifier).toBe('+91 ******6677');
      expect(JSON.stringify(statusRes.body.data)).not.toContain(victimMobile);
    });

    it('completes verified In-App Bearer JWT account deletion cleanly', async () => {
      const inAppRes = await request(app)
        .post('/api/v1/public/account-deletion')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          reason: 'taking_a_break',
          confirmPermanentDeletion: true,
        });

      expect(inAppRes.status).toBe(200);
      expect(inAppRes.body.data.verificationMethod).toBe('jwt_session');
      expect(inAppRes.body.data.requestId).toMatch(/^DEL-\d{8}-[A-Z0-9]{6}$/);
    });
  });
});
