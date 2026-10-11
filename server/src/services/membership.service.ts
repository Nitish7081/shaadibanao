import mongoose from 'mongoose';
import { MembershipModel, IMembership } from '../models/membership.model';
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
    name: 'Bandhan Free',
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
    name: 'Bandhan Plus',
    tier: 'plus',
    priceInr: 2999,
    billingCycle: '3 Months',
    tagline: 'Direct 1-on-1 messaging & 25 verified contact disclosures',
    features: [
      'Everything in Free Plan',
      'Initiate direct 1-on-1 chat with mutual matches',
      '25 verified contact disclosures after mutual consent',
      'Profile Spotlight Badge (Bandhan Plus)',
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
    name: 'Bandhan Premium',
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
   * Returns list of configured membership tiers
   */
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

    return {
      userId,
      planId: planTier,
      planName: plan.name,
      status: record?.status || 'active',
      entitlements: {
        ...plan.entitlements,
        contactDisclosuresUsed: used,
        contactDisclosuresRemaining: remaining,
      },
      startDate: record?.startDate
        ? new Date(record.startDate).toISOString()
        : new Date().toISOString(),
      expiresAt: record?.expiresAt ? new Date(record.expiresAt).toISOString() : undefined,
    };
  }

  /**
   * POST /api/v1/membership/checkout
   * Development-only checkout placeholder. Strictly does not auto-activate subscriptions.
   */
  public static async initiateCheckout(
    userId: string,
    planId: 'plus' | 'premium'
  ): Promise<CheckoutResponse> {
    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new AppError('Invalid membership plan tier selected', 400, 'INVALID_PLAN');
    }

    // Critical Security Rule: Never auto-activate paid membership from client requests!
    return {
      checkoutAvailable: false,
      notice:
        'Payment gateway integration is currently unconfigured. Subscriptions cannot be purchased or activated directly via client requests until an official gateway webhook is configured.',
      planId: plan.id,
      planName: plan.name,
      amountInr: plan.priceInr,
      currency: 'INR',
      paymentGatewayStatus: 'unconfigured',
    };
  }
}
