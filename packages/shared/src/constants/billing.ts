export const PLAY_BILLING_PACKAGE_NAME = 'com.shaadibanao.app';

export type PlayProductPurpose = 'membership_plus' | 'membership_premium' | 'pandit_chat';

export interface PlayProductDescriptor {
  purpose: PlayProductPurpose;
  productId: string;
  productType: 'subs' | 'in-app';
  basePlanId?: string;
  offerId?: string;
  planTier?: 'plus' | 'premium';
  durationDays?: number;
}

/**
 * Canonical Google Play Billing product ID mapping.
 * Override via environment variables once exact SKUs & base plans are published in Google Play Console.
 */
export const DEFAULT_PLAY_PRODUCTS: Record<PlayProductPurpose, PlayProductDescriptor> = {
  membership_plus: {
    purpose: 'membership_plus',
    productId: 'shaadibanao_plus_3m',
    productType: 'subs',
    basePlanId: 'plus-3-months',
    planTier: 'plus',
    durationDays: 90,
  },
  membership_premium: {
    purpose: 'membership_premium',
    productId: 'shaadibanao_premium_6m',
    productType: 'subs',
    basePlanId: 'premium-6-months',
    planTier: 'premium',
    durationDays: 180,
  },
  pandit_chat: {
    purpose: 'pandit_chat',
    productId: 'shaadibanao_pandit_chat_unlock',
    productType: 'in-app',
    durationDays: 7,
  },
};
