import crypto from 'crypto';
import fs from 'fs';
import mongoose from 'mongoose';
import {
  DEFAULT_PLAY_PRODUCTS,
  PLAY_BILLING_PACKAGE_NAME,
  PlayBillingCatalog,
  PlayBillingCatalogProduct,
  PlayProductPurpose,
  PlayVerificationResult,
} from '@bandhansetu/shared';
import { AppError } from '../middleware/errorHandler';
import { MembershipModel } from '../models/membership.model';
import { PaymentModel } from '../models/payment.model';
import { PlayPurchaseModel, PlaySubscriptionState } from '../models/play-purchase.model';
import { PanditChatEntitlementModel } from '../models/pandit-chat-entitlement.model';
import { AuditLogModel } from '../models/audit-log.model';
import { UserModel } from '../models/user.model';
import { NotificationModel } from '../models/notification.model';
import { SocketService } from '../socket/socket.service';
import { MembershipService } from './membership.service';
import { PanditService } from './pandit.service';

export interface GooglePlaySubscriptionV2Response {
  kind?: string;
  subscriptionState: PlaySubscriptionState;
  latestOrderId?: string;
  acknowledgementState?: 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED' | 'ACKNOWLEDGEMENT_STATE_PENDING' | 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  canceledStateContext?: {
    userInitiatedCancellation?: { cancelTime?: string };
    systemInitiatedCancellation?: any;
    developerInitiatedCancellation?: any;
    replacementCancellation?: any;
  };
  lineItems?: Array<{
    productId: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    offerDetails?: {
      basePlanId?: string;
      offerId?: string;
    };
  }>;
}

export interface GooglePlayProductPurchaseResponse {
  kind?: string;
  purchaseTimeMillis?: string;
  purchaseState: number; // 0 = Purchased, 1 = Canceled, 2 = Pending
  consumptionState?: number;
  acknowledgementState?: number; // 0 = Yet to be acknowledged, 1 = Acknowledged
  orderId?: string;
  obfuscatedExternalAccountId?: string;
}

export interface PlayPublisherGateway {
  isConfigured(): boolean;
  getSubscriptionV2(packageName: string, purchaseToken: string): Promise<GooglePlaySubscriptionV2Response>;
  acknowledgeSubscription(packageName: string, subscriptionId: string, purchaseToken: string): Promise<void>;
  getProductPurchase(packageName: string, productId: string, purchaseToken: string): Promise<GooglePlayProductPurchaseResponse>;
  acknowledgeProduct(packageName: string, productId: string, purchaseToken: string): Promise<void>;
}

interface GoogleServiceAccountCreds {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function loadPlayServiceAccount(): GoogleServiceAccountCreds | null {
  const inlineJson = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim();
  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson);
      if (parsed?.client_email && parsed?.private_key) return parsed;
    } catch {
      return null;
    }
  }

  const filePath = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH || '').trim();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed?.client_email && parsed?.private_key) return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

function base64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

class LiveGooglePlayPublisherGateway implements PlayPublisherGateway {
  private cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

  public isConfigured(): boolean {
    return Boolean(loadPlayServiceAccount());
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiresAtMs - 60_000) {
      return this.cachedAccessToken.token;
    }

    const creds = loadPlayServiceAccount();
    if (!creds) {
      throw new AppError(
        'Google Play Billing verification credentials are not configured on the server.',
        503,
        'PLAY_BILLING_NOT_CONFIGURED'
      );
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64Url(
      JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: tokenUri,
        iat: nowSec,
        exp: nowSec + 3600,
      })
    );
    const unsigned = `${header}.${claims}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    const signature = base64Url(signer.sign(creds.private_key));
    const assertion = `${unsigned}.${signature}`;

    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!res.ok) {
      throw new AppError(
        `Google OAuth token exchange failed (${res.status}).`,
        502,
        'PLAY_AUTH_FAILED'
      );
    }

    const body = (await res.json()) as any;
    if (!body?.access_token) {
      throw new AppError('Google OAuth response missing access_token.', 502, 'PLAY_AUTH_FAILED');
    }

    this.cachedAccessToken = {
      token: body.access_token,
      expiresAtMs: Date.now() + Number(body.expires_in || 3600) * 1000,
    };
    return body.access_token;
  }

  public async getSubscriptionV2(
    packageName: string,
    purchaseToken: string
  ): Promise<GooglePlaySubscriptionV2Response> {
    const token = await this.getAccessToken();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 410) {
        throw new AppError('Google Play subscription token is invalid or no longer exists.', 400, 'INVALID_PURCHASE_TOKEN');
      }
      throw new AppError(`Google Play verification failed (${res.status}).`, 502, 'PLAY_VERIFICATION_ERROR');
    }

    return (await res.json()) as GooglePlaySubscriptionV2Response;
  }

  public async acknowledgeSubscription(
    packageName: string,
    subscriptionId: string,
    purchaseToken: string
  ): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(
      purchaseToken
    )}:acknowledge`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!res.ok && res.status !== 204) {
      throw new AppError(`Failed to acknowledge subscription (${res.status}).`, 502, 'PLAY_ACKNOWLEDGE_FAILED');
    }
  }

  public async getProductPurchase(
    packageName: string,
    productId: string,
    purchaseToken: string
  ): Promise<GooglePlayProductPurchaseResponse> {
    const token = await this.getAccessToken();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 410) {
        throw new AppError('Google Play product purchase token is invalid.', 400, 'INVALID_PURCHASE_TOKEN');
      }
      throw new AppError(`Google Play product verification failed (${res.status}).`, 502, 'PLAY_VERIFICATION_ERROR');
    }

    return (await res.json()) as GooglePlayProductPurchaseResponse;
  }

  public async acknowledgeProduct(
    packageName: string,
    productId: string,
    purchaseToken: string
  ): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
      purchaseToken
    )}:acknowledge`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!res.ok && res.status !== 204) {
      throw new AppError(`Failed to acknowledge product purchase (${res.status}).`, 502, 'PLAY_ACKNOWLEDGE_FAILED');
    }
  }
}

export class PlayBillingService {
  private static gateway: PlayPublisherGateway = new LiveGooglePlayPublisherGateway();

  public static setGatewayForTesting(customGateway: PlayPublisherGateway | null): void {
    this.gateway = customGateway || new LiveGooglePlayPublisherGateway();
  }

  public static getCatalog(): PlayBillingCatalog {
    const packageName =
      (process.env.GOOGLE_PLAY_PACKAGE_NAME || '').trim() || PLAY_BILLING_PACKAGE_NAME;

    const plusSku =
      (process.env.GOOGLE_PLAY_SKU_PLUS || '').trim() || DEFAULT_PLAY_PRODUCTS.membership_plus.productId;
    const plusBasePlan =
      (process.env.GOOGLE_PLAY_BASE_PLAN_PLUS || '').trim() ||
      DEFAULT_PLAY_PRODUCTS.membership_plus.basePlanId;
    const premiumSku =
      (process.env.GOOGLE_PLAY_SKU_PREMIUM || '').trim() ||
      DEFAULT_PLAY_PRODUCTS.membership_premium.productId;
    const premiumBasePlan =
      (process.env.GOOGLE_PLAY_BASE_PLAN_PREMIUM || '').trim() ||
      DEFAULT_PLAY_PRODUCTS.membership_premium.basePlanId;
    const panditSku =
      (process.env.GOOGLE_PLAY_SKU_PANDIT_CHAT || '').trim() ||
      DEFAULT_PLAY_PRODUCTS.pandit_chat.productId;

    const products: PlayBillingCatalogProduct[] = [
      {
        ...DEFAULT_PLAY_PRODUCTS.membership_plus,
        productId: plusSku,
        basePlanId: plusBasePlan,
      },
      {
        ...DEFAULT_PLAY_PRODUCTS.membership_premium,
        productId: premiumSku,
        basePlanId: premiumBasePlan,
      },
      {
        ...DEFAULT_PLAY_PRODUCTS.pandit_chat,
        productId: panditSku,
      },
    ];

    const playConsoleProductsConfigured =
      process.env.GOOGLE_PLAY_PRODUCTS_CONFIGURED === 'true';

    return {
      packageName,
      serverVerificationConfigured: this.gateway.isConfigured(),
      playConsoleProductsConfigured,
      products,
    };
  }

  private static resolveCatalogProduct(
    productId: string,
    expectedType: 'subs' | 'in-app'
  ): PlayBillingCatalogProduct {
    const catalog = this.getCatalog();
    const match = catalog.products.find(
      (p) => p.productId === productId && p.productType === expectedType
    );
    if (!match) {
      throw new AppError(
        `Unrecognized Google Play productId '${productId}'.`,
        400,
        'UNKNOWN_PLAY_PRODUCT'
      );
    }
    return match;
  }

  private static assertPackageNameAllowed(clientPackageName?: string): string {
    const expected = this.getCatalog().packageName;
    if (clientPackageName && clientPackageName !== expected) {
      throw new AppError('Package identity mismatch for Google Play purchase.', 403, 'PACKAGE_MISMATCH');
    }
    return expected;
  }

  /**
   * Verifies a subscription purchase token against Google Play Developer API v3,
   * enforces single-owner token binding, acknowledges if pending, and updates MembershipModel.
   */
  public static async verifySubscriptionPurchase(
    userId: string,
    input: {
      productId: string;
      purchaseToken: string;
      basePlanId?: string;
      offerId?: string;
      orderId?: string;
      packageName?: string;
    }
  ): Promise<PlayVerificationResult> {
    if (!this.gateway.isConfigured()) {
      throw new AppError(
        'Google Play Billing verification credentials are not configured on the server.',
        503,
        'PLAY_BILLING_NOT_CONFIGURED'
      );
    }

    const packageName = this.assertPackageNameAllowed(input.packageName);
    const catalogItem = this.resolveCatalogProduct(input.productId, 'subs');

    // Enforce one-to-one binding of purchaseToken to a single user account
    if (mongoose.connection.readyState === 1) {
      const existingTokenOwner = (await PlayPurchaseModel.findOne({
        purchaseToken: input.purchaseToken,
      })
        .select('userId')
        .lean()) as any;
      if (existingTokenOwner && existingTokenOwner.userId.toString() !== userId) {
        throw new AppError(
          'This Google Play purchase is already linked to another ShaadiBanao account.',
          409,
          'PURCHASE_TOKEN_ALREADY_CLAIMED'
        );
      }
    }

    const playSub = await this.gateway.getSubscriptionV2(packageName, input.purchaseToken);
    const lineItem =
      playSub.lineItems?.find((li) => li.productId === input.productId) ||
      playSub.lineItems?.[0];

    if (!lineItem || lineItem.productId !== input.productId) {
      throw new AppError(
        'Google Play subscription receipt product does not match the requested plan.',
        400,
        'PRODUCT_MISMATCH'
      );
    }

    const verifiedBasePlan = lineItem.offerDetails?.basePlanId || input.basePlanId || catalogItem.basePlanId;
    const verifiedOfferId = lineItem.offerDetails?.offerId || input.offerId;
    const autoRenewing = Boolean(lineItem.autoRenewingPlan?.autoRenewEnabled);
    const expiryDate = lineItem.expiryTime ? new Date(lineItem.expiryTime) : undefined;
    const now = new Date();
    const isFutureExpiry = Boolean(expiryDate && !isNaN(expiryDate.getTime()) && expiryDate.getTime() > now.getTime());

    let mappedStatus: PlayVerificationResult['status'] = 'expired';
    let entitlementGranted = false;
    let membershipStatus: 'active' | 'cancelled' | 'expired' = 'expired';

    switch (playSub.subscriptionState) {
      case 'SUBSCRIPTION_STATE_ACTIVE':
      case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
        mappedStatus = 'active';
        entitlementGranted = isFutureExpiry || !expiryDate;
        membershipStatus = entitlementGranted ? 'active' : 'expired';
        break;
      case 'SUBSCRIPTION_STATE_CANCELED':
        mappedStatus = 'cancelled';
        // Cancelled subscriptions keep entitlement strictly until current paid cycle expiryTime
        entitlementGranted = isFutureExpiry;
        membershipStatus = isFutureExpiry ? 'cancelled' : 'expired';
        break;
      case 'SUBSCRIPTION_STATE_PENDING':
        mappedStatus = 'pending';
        entitlementGranted = false;
        membershipStatus = 'expired';
        break;
      case 'SUBSCRIPTION_STATE_ON_HOLD':
        mappedStatus = 'on_hold';
        entitlementGranted = false;
        membershipStatus = 'expired';
        break;
      case 'SUBSCRIPTION_STATE_PAUSED':
        mappedStatus = 'paused';
        entitlementGranted = false;
        membershipStatus = 'expired';
        break;
      default:
        mappedStatus = 'expired';
        entitlementGranted = false;
        membershipStatus = 'expired';
        break;
    }

    let acknowledged =
      playSub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';

    if (entitlementGranted && !acknowledged) {
      await this.gateway.acknowledgeSubscription(packageName, input.productId, input.purchaseToken);
      acknowledged = true;
    }

    const planTier = catalogItem.planTier || 'plus';
    const orderId = playSub.latestOrderId || input.orderId;

    if (mongoose.connection.readyState === 1) {
      await PlayPurchaseModel.findOneAndUpdate(
        { purchaseToken: input.purchaseToken },
        {
          $set: {
            userId: new mongoose.Types.ObjectId(userId),
            packageName,
            productId: input.productId,
            basePlanId: verifiedBasePlan,
            offerId: verifiedOfferId,
            purchaseType: 'subs',
            purpose: catalogItem.purpose,
            orderId,
            subscriptionState: playSub.subscriptionState,
            acknowledgementState: acknowledged ? 'ACKNOWLEDGED' : 'UNACKNOWLEDGED',
            autoRenewing,
            expiryTime: expiryDate,
            lastVerifiedAt: now,
          },
        },
        { upsert: true, new: true }
      );

      if (mappedStatus !== 'pending') {
        const effectivePlanId = entitlementGranted ? planTier : 'free';
        await MembershipModel.findOneAndUpdate(
          { userId: new mongoose.Types.ObjectId(userId) },
          {
            $set: {
              planId: effectivePlanId,
              status: membershipStatus,
              startDate: now,
              ...(expiryDate ? { expiresAt: expiryDate } : {}),
            },
            $setOnInsert: { contactDisclosuresUsed: 0 },
          },
          { upsert: true, new: true }
        );
      }

      if (entitlementGranted && orderId) {
        const planMeta = MembershipService.getPlanById(planTier);
        await PaymentModel.findOneAndUpdate(
          { orderId },
          {
            $set: {
              userId: new mongoose.Types.ObjectId(userId),
              type: 'membership',
              referenceId: planTier,
              referenceDescription: `Google Play ${planMeta?.name || planTier}`,
              amount: planMeta?.priceInr || 0,
              currency: 'INR',
              status: 'captured',
              gateway: 'google_play',
              paymentMethod: 'google_play_billing',
              capturedAt: now,
              metadata: {
                productId: input.productId,
                basePlanId: verifiedBasePlan,
                subscriptionState: playSub.subscriptionState,
              },
            },
          },
          { upsert: true, new: true }
        );
      }
    }

    const membership = await MembershipService.getUserMembership(userId);
    if (entitlementGranted) {
      try {
        SocketService.emitToUser(userId, 'membership_updated', {
          planId: membership.planId,
          planName: membership.planName,
          status: membership.status,
          expiresAt: membership.expiresAt,
        });
      } catch {
        // Non-blocking
      }
    }

    return {
      verified: true,
      status: mappedStatus,
      entitlementGranted,
      acknowledged,
      productId: input.productId,
      planId: membership.planId,
      expiresAt: expiryDate?.toISOString(),
      autoRenewing,
      membership,
      message:
        mappedStatus === 'pending'
          ? 'Your Google Play purchase is pending payment confirmation. Access will activate automatically once settled.'
          : entitlementGranted
          ? 'Google Play subscription verified and active.'
          : `Subscription is currently ${mappedStatus.replace('_', ' ')} and does not grant paid access.`,
    };
  }

  /**
   * Verifies a one-time Google Play in-app product purchase (e.g., Pandit chat unlock).
   */
  public static async verifyProductPurchase(
    userId: string,
    input: {
      productId: string;
      purchaseToken: string;
      panditId: string;
      orderId?: string;
      packageName?: string;
    }
  ): Promise<PlayVerificationResult> {
    if (!this.gateway.isConfigured()) {
      throw new AppError(
        'Google Play Billing verification credentials are not configured on the server.',
        503,
        'PLAY_BILLING_NOT_CONFIGURED'
      );
    }

    const packageName = this.assertPackageNameAllowed(input.packageName);
    const catalogItem = this.resolveCatalogProduct(input.productId, 'in-app');
    const pandit = await PanditService.findApprovedPanditOrThrow(input.panditId);

    if (mongoose.connection.readyState === 1) {
      const existingOwner = (await PlayPurchaseModel.findOne({
        purchaseToken: input.purchaseToken,
      })
        .select('userId')
        .lean()) as any;
      if (existingOwner && existingOwner.userId.toString() !== userId) {
        throw new AppError(
          'This Google Play purchase is already linked to another account.',
          409,
          'PURCHASE_TOKEN_ALREADY_CLAIMED'
        );
      }
    }

    const purchase = await this.gateway.getProductPurchase(
      packageName,
      input.productId,
      input.purchaseToken
    );

    const now = new Date();
    let status: PlayVerificationResult['status'] = 'expired';
    let entitlementGranted = false;
    let stateStr: PlaySubscriptionState = 'CANCELED';

    if (purchase.purchaseState === 0) {
      status = 'active';
      entitlementGranted = true;
      stateStr = 'PURCHASED';
    } else if (purchase.purchaseState === 2) {
      status = 'pending';
      entitlementGranted = false;
      stateStr = 'PENDING';
    } else {
      status = 'revoked';
      entitlementGranted = false;
      stateStr = 'CANCELED';
    }

    let acknowledged = purchase.acknowledgementState === 1;
    if (entitlementGranted && !acknowledged) {
      await this.gateway.acknowledgeProduct(packageName, input.productId, input.purchaseToken);
      acknowledged = true;
    }

    const orderId = purchase.orderId || input.orderId || `gpa_${Date.now()}`;
    const expiresAt = new Date(now.getTime() + (catalogItem.durationDays || 7) * 86400000);

    if (mongoose.connection.readyState === 1) {
      await PlayPurchaseModel.findOneAndUpdate(
        { purchaseToken: input.purchaseToken },
        {
          $set: {
            userId: new mongoose.Types.ObjectId(userId),
            packageName,
            productId: input.productId,
            purchaseType: 'in-app',
            purpose: 'pandit_chat',
            panditId: pandit._id,
            orderId,
            subscriptionState: stateStr,
            acknowledgementState: acknowledged ? 'ACKNOWLEDGED' : 'UNACKNOWLEDGED',
            autoRenewing: false,
            expiryTime: expiresAt,
            lastVerifiedAt: now,
          },
        },
        { upsert: true, new: true }
      );

      if (entitlementGranted) {
        await PanditChatEntitlementModel.findOneAndUpdate(
          { userId, panditId: pandit._id },
          {
            $set: {
              paidAccessActive: true,
              paidSource: 'pandit_chat',
              paidActivatedAt: now,
              paidExpiresAt: expiresAt,
              lastOrderId: orderId,
              lastPaymentId: input.purchaseToken.slice(0, 64),
            },
          },
          { upsert: true, new: true }
        );

        const user = (await UserModel.findById(userId).select('displayName mobile email').lean()) as any;
        await PaymentModel.findOneAndUpdate(
          { orderId },
          {
            $set: {
              userId: new mongoose.Types.ObjectId(userId),
              userName: user?.displayName,
              userMobile: user?.mobile,
              userEmail: user?.email,
              type: 'pandit_chat',
              referenceId: pandit._id.toString(),
              referenceDescription: `Google Play Pandit Chat - ${pandit.name}`,
              amount: Number(pandit.consultationCharges || 501),
              currency: 'INR',
              status: 'captured',
              gateway: 'google_play',
              paymentMethod: 'google_play_billing',
              capturedAt: now,
              metadata: { productId: input.productId },
            },
          },
          { upsert: true, new: true }
        );

        await AuditLogModel.create({
          adminId: userId,
          action: 'PLAY_PANDIT_CHAT_VERIFIED',
          targetUserId: pandit.userId ? pandit.userId.toString() : '',
          details: { panditId: pandit._id.toString(), productId: input.productId, orderId },
        });
      }
    }

    const panditEntitlement = await PanditService.getPanditChatEligibility(
      userId,
      pandit._id.toString()
    );

    if (entitlementGranted) {
      SocketService.emitToUser(userId, 'pandit_chat_unlocked', {
        panditId: pandit._id.toString(),
        entitlement: panditEntitlement,
      });
    }

    return {
      verified: true,
      status,
      entitlementGranted,
      acknowledged,
      productId: input.productId,
      expiresAt: entitlementGranted ? expiresAt.toISOString() : undefined,
      panditEntitlement,
      message:
        status === 'pending'
          ? 'Your Google Play purchase is pending confirmation.'
          : entitlementGranted
          ? 'Pandit consultation access verified via Google Play Billing.'
          : 'Google Play purchase was cancelled or revoked.',
    };
  }

  /**
   * Restores active entitlements from Google Play purchases retrieved by the client.
   * Re-verifies every token directly against Google Play Developer API.
   */
  public static async restorePurchases(
    userId: string,
    purchases: Array<{
      productId: string;
      purchaseToken: string;
      productType: 'subs' | 'in-app';
      basePlanId?: string;
      orderId?: string;
    }>
  ): Promise<{
    restoredCount: number;
    results: PlayVerificationResult[];
    membership: UserMembershipResult;
  }> {
    if (!this.gateway.isConfigured()) {
      throw new AppError(
        'Google Play Billing verification credentials are not configured on the server.',
        503,
        'PLAY_BILLING_NOT_CONFIGURED'
      );
    }

    const results: PlayVerificationResult[] = [];
    let restoredCount = 0;

    for (const p of purchases) {
      if (p.productType === 'subs') {
        try {
          const r = await this.verifySubscriptionPurchase(userId, {
            productId: p.productId,
            purchaseToken: p.purchaseToken,
            basePlanId: p.basePlanId,
            orderId: p.orderId,
          });
          results.push(r);
          if (r.entitlementGranted) restoredCount++;
        } catch {
          // Skip unrecognized or other-user tokens safely during batch restore
        }
      }
    }

    const membership = await MembershipService.getUserMembership(userId);
    return { restoredCount, results, membership };
  }

  /**
   * Processes Google Play Real-Time Developer Notifications (RTDN) Pub/Sub push messages
   * so renewals, cancellations, on-hold, pause, and revocations sync automatically.
   */
  public static async handleRtdnNotification(
    notification: {
      packageName?: string;
      subscriptionNotification?: {
        notificationType: number;
        purchaseToken: string;
        subscriptionId: string;
      };
    }
  ): Promise<{ processed: boolean; status?: string }> {
    const subNotif = notification?.subscriptionNotification;
    if (!subNotif?.purchaseToken || !subNotif?.subscriptionId) {
      return { processed: false };
    }

    const existing = (await PlayPurchaseModel.findOne({
      purchaseToken: subNotif.purchaseToken,
    }).lean()) as any;

    if (!existing) {
      return { processed: false };
    }

    const res = await this.verifySubscriptionPurchase(existing.userId.toString(), {
      productId: subNotif.subscriptionId,
      purchaseToken: subNotif.purchaseToken,
      packageName: notification.packageName,
    });

    return { processed: true, status: res.status };
  }
}

type UserMembershipResult = Awaited<ReturnType<typeof MembershipService.getUserMembership>>;
