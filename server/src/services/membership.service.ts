import mongoose from 'mongoose';
import crypto from 'crypto';
import { MembershipModel, IMembership } from '../models/membership.model';
import { SystemSettingsModel } from '../models/system-settings.model';
import { NotificationModel } from '../models/notification.model';
import { SocketService } from '../socket/socket.service';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import {
  MembershipPlan,
  UserMembership,
  CheckoutResponse,
  PlanTier,
} from '@bandhansetu/shared';

// In-memory fallback for testing / offline development
export interface InMemoryMembershipRecord {
  id: string;
  userId: string;
  planId: PlanTier;
  status: 'active' | 'expired' | 'cancelled';
  contactDisclosuresUsed: number;
  startDate: Date;
  expiresAt?: Date;
}
export const inMemoryMembershipStore = new Map<string, InMemoryMembershipRecord>();

/**
 * Canonical Membership Plans Catalog
 */
export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'free',
    name: 'ShaadiBanao Free',
    tier: 'free',
    priceInr: 0,
    billingCycle: 'Free Forever',
    tagline: 'Essential access for building your verified profile and receiving interests',
    features: [
      'Create and manage verified matrimonial profile',
      'Search and browse profiles with privacy controls',
      'Receive & respond to incoming interests',
      'Factual preference match alignment evaluation',
      'Contact numbers securely masked by default',
    ],
    entitlements: {
      canInitiateChat: false,
      contactDisclosuresLimit: 0,
      isSpotlightProfile: false,
      prioritySearchRanking: false,
      relationshipAdvisorConsult: false,
    },
    badgeText: 'Member',
  },
  {
    id: 'plus',
    name: 'ShaadiBanao Plus',
    tier: 'plus',
    priceInr: 2999,
    billingCycle: '3 Months',
    tagline: 'Direct 1-on-1 messaging & 25 verified contact disclosures',
    features: [
      'Everything in Free Plan',
      'Initiate direct 1-on-1 chat with mutual matches',
      '25 verified contact disclosures after mutual consent',
      'Profile Spotlight Badge (ShaadiBanao Plus)',
      'Priority placement in profile search results',
      'Read receipts and real-time delivery status',
    ],
    entitlements: {
      canInitiateChat: true,
      contactDisclosuresLimit: 25,
      isSpotlightProfile: true,
      prioritySearchRanking: true,
      relationshipAdvisorConsult: false,
    },
    badgeText: 'Plus Member',
    isPopular: true,
  },
  {
    id: 'premium',
    name: 'ShaadiBanao Premium',
    tier: 'premium',
    priceInr: 4999,
    billingCycle: '6 Months',
    tagline: 'Royal Maroon & Gold Spotlight, 75 contacts, and assisted advisor guidance',
    features: [
      'Everything in Plus Plan',
      '75 verified contact disclosures after mutual consent',
      'Royal Maroon & Gold Spotlight Highlight',
      'Top priority placement across all search categories',
      'Dedicated Relationship Advisor & Pandit consultation guidance',
      'Complimentary Kundli matching reports',
    ],
    entitlements: {
      canInitiateChat: true,
      contactDisclosuresLimit: 75,
      isSpotlightProfile: true,
      prioritySearchRanking: true,
      relationshipAdvisorConsult: true,
    },
    badgeText: 'Royal Premium',
  },
];

export class MembershipService {
  /**
   * Helper to ensure database is ready if running in production mode
   */
  private static assertDbReadiness(): void {
    if (config.isProduction && mongoose.connection.readyState !== 1) {
      throw new AppError(
        'Database connection required in production mode. In-memory fallbacks are prohibited.',
        503,
        'DATABASE_UNAVAILABLE'
      );
    }
  }

  /**
   * GET /api/v1/membership/plans
   * Returns list of configured membership tiers (with dynamic settings overrides if available)
   */
  public static async getPlansAsync(): Promise<MembershipPlan[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
        if (settings) {
          return MEMBERSHIP_PLANS.map((p) => {
            if (p.id === 'plus' && settings.plusPlanPriceInr !== undefined) {
              return { ...p, priceInr: settings.plusPlanPriceInr };
            }
            if (p.id === 'premium' && settings.premiumPlanPriceInr !== undefined) {
              return { ...p, priceInr: settings.premiumPlanPriceInr };
            }
            return p;
          });
        }
      } catch {
        // Fallback to static catalog
      }
    }
    return MEMBERSHIP_PLANS;
  }

  public static getPlans(): MembershipPlan[] {
    return MEMBERSHIP_PLANS;
  }

  /**
   * Find plan definition by ID
   */
  public static getPlanById(planId: string): MembershipPlan | undefined {
    return MEMBERSHIP_PLANS.find((p) => p.id === planId);
  }

  /**
   * GET /api/v1/membership/me
   * Retrieves active membership and entitlements for user
   */
  public static async getUserMembership(userId: string): Promise<UserMembership> {
    this.assertDbReadiness();
    const isDbConnected = mongoose.connection.readyState === 1;

    let record: any = null;

    if (isDbConnected) {
      record = await MembershipModel.findOne({ userId });
    } else {
      record = inMemoryMembershipStore.get(userId);
    }

    const planTier: PlanTier = record?.planId || 'free';
    const plan = this.getPlanById(planTier) || MEMBERSHIP_PLANS[0];
    const used = record?.contactDisclosuresUsed || 0;
    const limit = plan.entitlements.contactDisclosuresLimit;
    const remaining = Math.max(0, limit - used);

    // Check expiration & Play Billing lifecycle states
    let isExpired = record?.status === 'expired';
    let hasFutureExpiry = false;
    if (record?.expiresAt) {
      const expTime = new Date(record.expiresAt).getTime();
      if (!isNaN(expTime)) {
        if (expTime <= Date.now()) {
          isExpired = true;
        } else {
          hasFutureExpiry = true;
        }
      }
    }
    if (record?.status === 'cancelled' && !hasFutureExpiry) {
      isExpired = true;
    }

    const status = isExpired ? 'expired' : record?.status || 'active';

    return {
      userId,
      planId: isExpired ? 'free' : planTier,
      planName: isExpired
        ? 'ShaadiBanao Free (Plan Expired)'
        : status === 'cancelled'
        ? `${plan.name} (Cancels at period end)`
        : plan.name,
      status,
      entitlements: {
        ...plan.entitlements,
        canInitiateChat: isExpired ? false : plan.entitlements.canInitiateChat,
        contactDisclosuresUsed: used,
        contactDisclosuresRemaining: isExpired ? 0 : remaining,
      },
      startDate: record?.startDate
        ? new Date(record.startDate).toISOString()
        : new Date().toISOString(),
      expiresAt: record?.expiresAt ? new Date(record.expiresAt).toISOString() : undefined,
    };
  }

  /**
   * Canonical entitlement check: true for paid tiers (plus/premium) that are active,
   * or cancelled with remaining paid billing cycle before expiresAt.
   */
  public static hasActivePaidEntitlement(membership: UserMembership): boolean {
    const isPaid = membership.planId === 'plus' || membership.planId === 'premium';
    if (!isPaid) return false;

    const now = Date.now();
    const expTime = membership.expiresAt ? new Date(membership.expiresAt).getTime() : NaN;
    if (!isNaN(expTime) && expTime <= now) {
      return false;
    }

    if (membership.status === 'active') return true;
    if (membership.status === 'cancelled' && !isNaN(expTime) && expTime > now) return true;
    return false;
  }

  /**
   * POST /api/v1/membership/order
   * Creates a payment order for plan purchase
   */
  public static async createOrder(
    userId: string,
    planId: 'plus' | 'premium'
  ): Promise<{
    orderId: string;
    amountInr: number;
    currency: string;
    planId: string;
    planName: string;
    keyId: string;
  }> {
    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new AppError('Invalid membership plan tier selected', 400, 'INVALID_PLAN');
    }

    const orderId = `order_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      orderId,
      amountInr: plan.priceInr,
      currency: 'INR',
      planId: plan.id,
      planName: plan.name,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_bandhansetu',
    };
  }

  /**
   * POST /api/v1/membership/verify
   * Verifies payment and activates paid subscription
   */
  public static async verifyPaymentAndActivate(
    userId: string,
    data: {
      orderId: string;
      paymentId: string;
      signature?: string;
      planId: 'plus' | 'premium';
    }
  ): Promise<UserMembership> {
    const plan = this.getPlanById(data.planId);
    if (!plan) {
      throw new AppError('Invalid membership plan tier', 400, 'INVALID_PLAN');
    }

    if (!data.orderId || !data.paymentId) {
      throw new AppError('Payment orderId and paymentId are required.', 400, 'INVALID_PAYMENT_PAYLOAD');
    }

    // Razorpay signature verification (mandatory in production; never accept unsigned client payment IDs)
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    if (config.isProduction && !rzpSecret) {
      throw new AppError(
        'Direct Razorpay verification is not configured. Use Google Play Billing on Android.',
        503,
        'PAYMENT_GATEWAY_UNCONFIGURED'
      );
    }
    if (rzpSecret) {
      if (!data.signature) {
        throw new AppError('Payment verification signature is required.', 400, 'PAYMENT_VERIFICATION_FAILED');
      }
      const generatedSignature = crypto
        .createHmac('sha256', rzpSecret)
        .update(`${data.orderId}|${data.paymentId}`)
        .digest('hex');

      if (generatedSignature !== data.signature) {
        throw new AppError('Payment verification signature mismatch. Fraudulent transaction detected.', 400, 'PAYMENT_VERIFICATION_FAILED');
      }
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const validityDays = data.planId === 'premium' ? 180 : 90;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    if (isDbConnected) {
      let mem = await MembershipModel.findOne({ userId });
      if (!mem) {
        mem = new MembershipModel({
          userId: new mongoose.Types.ObjectId(userId),
          planId: data.planId,
          status: 'active',
          startDate: now,
          expiresAt,
          contactDisclosuresUsed: 0,
        });
      } else {
        mem.planId = data.planId;
        mem.status = 'active';
        mem.startDate = now;
        mem.expiresAt = expiresAt;
        mem.contactDisclosuresUsed = 0;
      }
      await mem.save();
    } else {
      inMemoryMembershipStore.set(userId, {
        id: `mem_${Date.now()}`,
        userId,
        planId: data.planId,
        status: 'active',
        contactDisclosuresUsed: 0,
        startDate: now,
        expiresAt,
      });
    }

    // In-app Notification to member
    try {
      await NotificationModel.create({
        userId: new mongoose.Types.ObjectId(userId),
        title: 'योजना सक्रिय (Membership Activated)',
        body: `बधाई हो! आपकी ${plan.name} सदस्यता सक्रिय हो गई है। आप असीमित चैट और विशेष विशेषाधिकारों का आनंद ले सकते हैं। (Congratulations! Your ${plan.name} is now active. Enjoy full chat access and verified privileges.)`,
        type: 'membership_activated',
        data: {
          planId: plan.id,
          planName: plan.name,
          expiresAt: expiresAt.toISOString(),
        },
      });

      SocketService.emitToUser(userId, 'membership_updated', {
        planId: plan.id,
        planName: plan.name,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
      });
    } catch {
      // Non-blocking notification
    }

    return this.getUserMembership(userId);
  }

  /**
   * POST /api/v1/membership/checkout
   * Development-only checkout placeholder. Strictly does not auto-activate subscriptions.
   */
  public static async initiateCheckout(
    userId: string,
    planId: 'plus' | 'premium'
  ): Promise<CheckoutResponse> {
    if (planId === ('free' as any)) {
      throw new AppError('Checkout is only applicable for paid membership tiers (plus, premium)', 400, 'PAID_PLAN_REQUIRED');
    }

    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new AppError('Invalid membership plan tier selected', 400, 'INVALID_PLAN');
    }

    return {
      checkoutAvailable: false,
      notice: 'Payment gateway integration pending configuration. Subscriptions cannot be self-activated from client.',
      planId: plan.id,
      planName: plan.name,
      amountInr: plan.priceInr,
      currency: 'INR',
      paymentGatewayStatus: 'unconfigured',
    };
  }
}
