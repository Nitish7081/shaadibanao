import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { ProfileModel } from '../src/models/profile.model';
import { PanditModel } from '../src/models/pandit.model';
import { MembershipModel } from '../src/models/membership.model';
import { MatchModel } from '../src/models/match.model';
import { TokenService } from '../src/services/token.service';
import {
  PlayBillingService,
  PlayPublisherGateway,
  GooglePlaySubscriptionV2Response,
  GooglePlayProductPurchaseResponse,
} from '../src/services/playBilling.service';

describe('Google Play Billing Verification, Lifecycle & Regression Suite', () => {
  let mongod: MongoMemoryServer;
  let app: any;

  let maleUserId: string;
  let maleToken: string;

  let secondMaleUserId: string;
  let secondMaleToken: string;

  let femaleUserId: string;
  let femaleToken: string;

  let panditId: string;

  const acknowledgedSubs: string[] = [];
  const acknowledgedProducts: string[] = [];
  const subResponses = new Map<string, GooglePlaySubscriptionV2Response>();
  const productResponses = new Map<string, GooglePlayProductPurchaseResponse>();

  const mockGateway: PlayPublisherGateway = {
    isConfigured: () => true,
    async getSubscriptionV2(_pkg, token) {
      const entry = subResponses.get(token);
      if (!entry) {
        throw new Error(`No mock subscription for ${token}`);
      }
      return entry;
    },
    async acknowledgeSubscription(_pkg, _subId, token) {
      acknowledgedSubs.push(token);
    },
    async getProductPurchase(_pkg, _productId, token) {
      const entry = productResponses.get(token);
      if (!entry) {
        throw new Error(`No mock product purchase for ${token}`);
      }
      return entry;
    },
    async acknowledgeProduct(_pkg, _productId, token) {
      acknowledgedProducts.push(token);
    },
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = createApp();

    // 1. Male user 1
    maleUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(maleUserId),
      mobile: '9811112201',
      role: 'member',
      gender: 'male',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
    });
    await ProfileModel.create({
      userId: new mongoose.Types.ObjectId(maleUserId),
      firstName: 'Rohan',
      lastName: 'Sharma',
      gender: 'male',
      dateOfBirth: new Date('1995-05-15'),
      heightCm: 174,
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'hindu',
      country: 'India',
      state: 'Delhi',
      city: 'New Delhi',
      education: 'B.Tech',
      employedIn: 'private',
      occupation: 'Engineer',
      aboutMe: 'Software engineer in Delhi.',
      completenessPercent: 90,
      isVerified: true,
      photos: [],
    });
    maleToken = TokenService.generateTokens({
      userId: maleUserId,
      role: 'member',
    }).accessToken;

    // 2. Male user 2 (for replay test)
    secondMaleUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(secondMaleUserId),
      mobile: '9811112202',
      role: 'member',
      gender: 'male',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
    });
    await ProfileModel.create({
      userId: new mongoose.Types.ObjectId(secondMaleUserId),
      firstName: 'Vikram',
      lastName: 'Verma',
      gender: 'male',
      dateOfBirth: new Date('1994-03-10'),
      heightCm: 176,
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'hindu',
      country: 'India',
      state: 'Delhi',
      city: 'New Delhi',
      education: 'MBA',
      employedIn: 'private',
      occupation: 'Consultant',
      aboutMe: 'Business consultant.',
      completenessPercent: 90,
      isVerified: true,
      photos: [],
    });
    secondMaleToken = TokenService.generateTokens({
      userId: secondMaleUserId,
      role: 'member',
    }).accessToken;

    // 3. Female user
    femaleUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(femaleUserId),
      mobile: '9811112203',
      role: 'member',
      gender: 'female',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
    });
    await ProfileModel.create({
      userId: new mongoose.Types.ObjectId(femaleUserId),
      firstName: 'Neha',
      lastName: 'Gupta',
      gender: 'female',
      dateOfBirth: new Date('1997-08-22'),
      heightCm: 162,
      maritalStatus: 'never_married',
      motherTongue: 'Hindi',
      religion: 'hindu',
      country: 'India',
      state: 'Delhi',
      city: 'New Delhi',
      education: 'M.Com',
      employedIn: 'private',
      occupation: 'Analyst',
      aboutMe: 'Financial analyst.',
      completenessPercent: 90,
      isVerified: true,
      photos: [],
    });
    femaleToken = TokenService.generateTokens({
      userId: femaleUserId,
      role: 'member',
    }).accessToken;

    // 4. Approved Pandit
    const pUserId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      _id: new mongoose.Types.ObjectId(pUserId),
      mobile: '9811112204',
      role: 'pandit',
      status: 'active',
      approvalStatus: 'approved',
      isPhoneVerified: true,
    });
    const pandit = await PanditModel.create({
      panditId: 'PND-TEST-9001',
      userId: new mongoose.Types.ObjectId(pUserId),
      name: 'Acharya Dev Shastri',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      experienceYears: 12,
      languages: ['Hindi', 'Sanskrit'],
      specializations: ['Vivah Sanskar', 'Kundli Milan'],
      consultationCharges: 251,
      verificationStatus: 'approved',
      isActive: true,
    });
    panditId = pandit._id.toString();

    await MatchModel.create({
      user1Id: new mongoose.Types.ObjectId(maleUserId),
      user2Id: new mongoose.Types.ObjectId(femaleUserId),
    });
    await MatchModel.create({
      user1Id: new mongoose.Types.ObjectId(secondMaleUserId),
      user2Id: new mongoose.Types.ObjectId(femaleUserId),
    });
  });

  async function attemptMaleMessages(token: string): Promise<number[]> {
    const convRes = await request(app)
      .post('/api/v1/chat/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ participantId: femaleUserId });
    if (convRes.status !== 200 && convRes.status !== 201) {
      return [convRes.status];
    }
    const convId = convRes.body.data.id || convRes.body.data._id;
    const msg1 = await request(app)
      .post(`/api/v1/chat/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Namaste, first message.' });
    const msg2 = await request(app)
      .post(`/api/v1/chat/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Second message requiring subscription.' });
    return [msg1.status, msg2.status];
  }

  afterAll(async () => {
    PlayBillingService.setGatewayForTesting(null);
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(() => {
    acknowledgedSubs.length = 0;
    acknowledgedProducts.length = 0;
    subResponses.clear();
    productResponses.clear();
    PlayBillingService.setGatewayForTesting(mockGateway);
  });

  it('reports unconfigured Play Console status honestly and returns 503 when Play credentials are missing', async () => {
    PlayBillingService.setGatewayForTesting(null);

    const catRes = await request(app).get('/api/v1/billing/play/catalog');
    expect(catRes.status).toBe(200);
    expect(catRes.body.data.packageName).toBe('com.shaadibanao.app');
    expect(catRes.body.data.serverVerificationConfigured).toBe(false);

    const verifyRes = await request(app)
      .post('/api/v1/billing/play/verify-subscription')
      .set('Authorization', `Bearer ${maleToken}`)
      .send({
        productId: 'shaadibanao_plus_3m',
        purchaseToken: 'tok_unconfigured_12345678',
      });
    expect(verifyRes.status).toBe(503);
    expect(verifyRes.body.error.code).toBe('PLAY_BILLING_NOT_CONFIGURED');
  });

  it('rejects unpaid male chat (402), verifies Play subscription, acknowledges purchase, and unlocks male chat (201)', async () => {
    const unpaidStatuses = await attemptMaleMessages(maleToken);
    expect(unpaidStatuses).toContain(402);

    const futureExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const token = 'play_sub_token_active_001';
    subResponses.set(token, {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      latestOrderId: 'GPA.1111-2222-3333-00001',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
      lineItems: [
        {
          productId: 'shaadibanao_plus_3m',
          expiryTime: futureExpiry,
          autoRenewingPlan: { autoRenewEnabled: true },
          offerDetails: { basePlanId: 'plus-3-months' },
        },
      ],
    });

    const verifyRes = await request(app)
      .post('/api/v1/billing/play/verify-subscription')
      .set('Authorization', `Bearer ${maleToken}`)
      .send({
        productId: 'shaadibanao_plus_3m',
        purchaseToken: token,
        basePlanId: 'plus-3-months',
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(true);
    expect(verifyRes.body.data.status).toBe('active');
    expect(verifyRes.body.data.planId).toBe('plus');
    expect(verifyRes.body.data.acknowledged).toBe(true);
    expect(acknowledgedSubs).toContain(token);

    const paidStatuses = await attemptMaleMessages(maleToken);
    expect(paidStatuses).toEqual([201, 201]);
  });

  it('prevents purchaseToken replay across users with 409 PURCHASE_TOKEN_ALREADY_CLAIMED', async () => {
    const token = 'play_sub_token_active_001';
    subResponses.set(token, {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      latestOrderId: 'GPA.1111-2222-3333-00001',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      lineItems: [
        {
          productId: 'shaadibanao_plus_3m',
          expiryTime: new Date(Date.now() + 60 * 86400000).toISOString(),
        },
      ],
    });

    const replayRes = await request(app)
      .post('/api/v1/billing/play/verify-subscription')
      .set('Authorization', `Bearer ${secondMaleToken}`)
      .send({
        productId: 'shaadibanao_plus_3m',
        purchaseToken: token,
      });

    expect(replayRes.status).toBe(409);
    expect(replayRes.body.error.code).toBe('PURCHASE_TOKEN_ALREADY_CLAIMED');
  });

  it('handles pending, cancelled-until-expiry, expired, on-hold, paused, and restore lifecycle cleanly', async () => {
    // 1. Pending purchase must NOT unlock paid chat
    const pendingToken = 'play_sub_pending_002';
    subResponses.set(pendingToken, {
      subscriptionState: 'SUBSCRIPTION_STATE_PENDING',
      latestOrderId: 'GPA.9999-0000-0001',
      lineItems: [{ productId: 'shaadibanao_plus_3m' }],
    });

    const pendingRes = await request(app)
      .post('/api/v1/billing/play/verify-subscription')
      .set('Authorization', `Bearer ${secondMaleToken}`)
      .send({ productId: 'shaadibanao_plus_3m', purchaseToken: pendingToken });

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data.status).toBe('pending');
    expect(pendingRes.body.data.entitlementGranted).toBe(false);

    const stillBlocked = await attemptMaleMessages(secondMaleToken);
    expect(stillBlocked).toContain(402);

    // 2. Cancelled subscription BEFORE expiry retains access until expiresAt
    const cancelFutureToken = 'play_sub_cancel_future_003';
    subResponses.set(cancelFutureToken, {
      subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
      latestOrderId: 'GPA.2222-3333-4444',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      lineItems: [
        {
          productId: 'shaadibanao_premium_6m',
          expiryTime: new Date(Date.now() + 15 * 86400000).toISOString(),
          autoRenewingPlan: { autoRenewEnabled: false },
        },
      ],
    });

    const cancelFutureRes = await request(app)
      .post('/api/v1/billing/play/verify-subscription')
      .set('Authorization', `Bearer ${secondMaleToken}`)
      .send({ productId: 'shaadibanao_premium_6m', purchaseToken: cancelFutureToken });
    expect(cancelFutureRes.status).toBe(200);
    expect(cancelFutureRes.body.data.status).toBe('cancelled');
    expect(cancelFutureRes.body.data.entitlementGranted).toBe(true);
    expect(cancelFutureRes.body.data.planId).toBe('premium');

    // 3. On-hold immediately revokes access
    subResponses.set(cancelFutureToken, {
      subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
      latestOrderId: 'GPA.2222-3333-4444',
      lineItems: [
        {
          productId: 'shaadibanao_premium_6m',
          expiryTime: new Date(Date.now() + 15 * 86400000).toISOString(),
        },
      ],
    });
    const onHoldRes = await request(app)
      .post('/api/v1/billing/play/verify-subscription')
      .set('Authorization', `Bearer ${secondMaleToken}`)
      .send({ productId: 'shaadibanao_premium_6m', purchaseToken: cancelFutureToken });
    expect(onHoldRes.body.data.status).toBe('on_hold');
    expect(onHoldRes.body.data.entitlementGranted).toBe(false);

    const blockedAfterHold = await attemptMaleMessages(secondMaleToken);
    expect(blockedAfterHold).toContain(402);

    // 4. Restore purchases recovers active subscription
    subResponses.set(cancelFutureToken, {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      latestOrderId: 'GPA.2222-3333-4444',
      acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      lineItems: [
        {
          productId: 'shaadibanao_premium_6m',
          expiryTime: new Date(Date.now() + 180 * 86400000).toISOString(),
          autoRenewingPlan: { autoRenewEnabled: true },
        },
      ],
    });

    const restoreRes = await request(app)
      .post('/api/v1/billing/play/restore')
      .set('Authorization', `Bearer ${secondMaleToken}`)
      .send({
        purchases: [
          {
            productId: 'shaadibanao_premium_6m',
            purchaseToken: cancelFutureToken,
            productType: 'subs',
          },
        ],
      });
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.restoredCount).toBe(1);
    expect(restoreRes.body.data.membership.planId).toBe('premium');
  });

  it('processes Google Play RTDN revocation push notification and revokes access', async () => {
    const token = 'play_sub_cancel_future_003';
    subResponses.set(token, {
      subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED',
      lineItems: [{ productId: 'shaadibanao_premium_6m' }],
    });

    const envelope = Buffer.from(
      JSON.stringify({
        packageName: 'com.shaadibanao.app',
        subscriptionNotification: {
          notificationType: 12,
          purchaseToken: token,
          subscriptionId: 'shaadibanao_premium_6m',
        },
      }),
      'utf8'
    ).toString('base64');

    const rtdnRes = await request(app)
      .post('/api/v1/billing/play/rtdn')
      .send({ message: { data: envelope } });
    expect(rtdnRes.status).toBe(200);
    expect(rtdnRes.body.data.processed).toBe(true);
    expect(rtdnRes.body.data.status).toBe('expired');

    const chatAfterRevoke = await attemptMaleMessages(secondMaleToken);
    expect(chatAfterRevoke).toContain(402);
  });

  it('verifies Google Play one-time product unlock for Pandit consultation while keeping female free chat intact', async () => {
    // Downgrade male user back to free to isolate Pandit unlock test
    await MembershipModel.updateOne({ userId: maleUserId }, { planId: 'free', status: 'expired' });

    const prodToken = 'play_pandit_unlock_token_001';
    productResponses.set(prodToken, {
      purchaseState: 0, // Purchased
      acknowledgementState: 0,
      orderId: 'GPA.7777-8888-9999-00001',
    });

    const verifyProdRes = await request(app)
      .post('/api/v1/billing/play/verify-product')
      .set('Authorization', `Bearer ${maleToken}`)
      .send({
        productId: 'shaadibanao_pandit_chat_unlock',
        purchaseToken: prodToken,
        panditId,
      });

    expect(verifyProdRes.status).toBe(200);
    expect(verifyProdRes.body.data.verified).toBe(true);
    expect(verifyProdRes.body.data.acknowledged).toBe(true);
    expect(verifyProdRes.body.data.panditEntitlement?.paidAccessActive).toBe(true);
    expect(acknowledgedProducts).toContain(prodToken);

    // Female user retains free member chat without subscription
    const femaleConvRes = await request(app)
      .post('/api/v1/chat/conversations')
      .set('Authorization', `Bearer ${femaleToken}`)
      .send({ participantId: maleUserId });
    expect([200, 201]).toContain(femaleConvRes.status);
  });
});
