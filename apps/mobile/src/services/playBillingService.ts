import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  restorePurchases,
  deepLinkToSubscriptions,
  purchaseUpdatedListener,
  purchaseErrorListener,
  subscriptionBillingIssueListener,
  isUserCancelledError,
  type Purchase,
  type PurchaseAndroid,
  type Product,
  type ProductSubscriptionAndroid,
} from 'expo-iap';
import {
  ApiResponse,
  PLAY_BILLING_PACKAGE_NAME,
  PlayBillingCatalog,
  PlayVerificationResult,
} from '@bandhansetu/shared';
import { apiClient } from './apiClient';

export interface PlayBillingPurchaseOutcome {
  status: 'purchased' | 'pending' | 'cancelled' | 'blocked' | 'failed';
  verification?: PlayVerificationResult;
  message: string;
  purchase?: Purchase;
}

export async function getPlayBillingCatalog(): Promise<ApiResponse<PlayBillingCatalog>> {
  return apiClient<ApiResponse<PlayBillingCatalog>>('/billing/play/catalog', {
    method: 'GET',
  });
}

export async function verifyPlaySubscriptionOnServer(
  accessToken: string,
  payload: {
    productId: string;
    purchaseToken: string;
    basePlanId?: string;
    offerId?: string;
    orderId?: string;
    packageName?: string;
  }
): Promise<ApiResponse<PlayVerificationResult>> {
  return apiClient<ApiResponse<PlayVerificationResult>>('/billing/play/verify-subscription', {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: JSON.stringify({
      ...payload,
      packageName: payload.packageName || PLAY_BILLING_PACKAGE_NAME,
    }),
  });
}

export async function verifyPlayProductOnServer(
  accessToken: string,
  payload: {
    productId: string;
    purchaseToken: string;
    panditId: string;
    orderId?: string;
    packageName?: string;
  }
): Promise<ApiResponse<PlayVerificationResult>> {
  return apiClient<ApiResponse<PlayVerificationResult>>('/billing/play/verify-product', {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: JSON.stringify({
      ...payload,
      packageName: payload.packageName || PLAY_BILLING_PACKAGE_NAME,
    }),
  });
}

export async function restorePlayPurchasesOnServer(
  accessToken: string,
  purchases: Array<{
    productId: string;
    purchaseToken: string;
    productType: 'subs' | 'in-app';
    basePlanId?: string;
    orderId?: string;
  }>
): Promise<
  ApiResponse<{
    restoredCount: number;
    results: PlayVerificationResult[];
    membership: any;
  }>
> {
  return apiClient<
    ApiResponse<{
      restoredCount: number;
      results: PlayVerificationResult[];
      membership: any;
    }>
  >('/billing/play/restore', {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: JSON.stringify({ purchases }),
  });
}

export async function ensurePlayBillingConnection(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    throw new Error('Google Play Billing is only available on Android devices.');
  }
  const connected = await initConnection();
  if (!connected) {
    throw new Error('Could not connect to Google Play Billing service on this device.');
  }
  return true;
}

export async function closePlayBillingConnection(): Promise<void> {
  try {
    await endConnection();
  } catch {
    // Safe cleanup on unmount
  }
}

export async function fetchStoreSubscriptions(
  skus: string[]
): Promise<ProductSubscriptionAndroid[]> {
  if (Platform.OS !== 'android' || skus.length === 0) return [];
  const items = await fetchProducts({ skus, type: 'subs' });
  return (items || []) as ProductSubscriptionAndroid[];
}

export async function fetchStoreInAppProducts(skus: string[]): Promise<Product[]> {
  if (Platform.OS !== 'android' || skus.length === 0) return [];
  const items = await fetchProducts({ skus, type: 'in-app' });
  return (items || []) as Product[];
}

async function awaitPlayPurchaseFlow(params: {
  productId: string;
  triggerPurchase: () => Promise<void>;
  onVerify: (purchase: Purchase) => Promise<PlayVerificationResult>;
}): Promise<PlayBillingPurchaseOutcome> {
  let settled = false;
  let subUpdated: { remove: () => void } | null = null;
  let subError: { remove: () => void } | null = null;
  let subBillingIssue: { remove: () => void } | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    subUpdated?.remove();
    subError?.remove();
    subBillingIssue?.remove();
  };

  return new Promise<PlayBillingPurchaseOutcome>((resolve) => {
    const finish = (outcome: PlayBillingPurchaseOutcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };

    timeoutId = setTimeout(() => {
      finish({
        status: 'failed',
        message: 'Google Play Billing timed out waiting for purchase confirmation.',
      });
    }, 120000);

    subUpdated = purchaseUpdatedListener(async (purchase: Purchase) => {
      if (purchase.productId !== params.productId) {
        return;
      }

      if (purchase.purchaseState === 'pending') {
        finish({
          status: 'pending',
          purchase,
          message:
            'Your payment is pending confirmation in Google Play. Access will unlock automatically once Google Play settles the payment.',
        });
        return;
      }

      if (!purchase.purchaseToken) {
        finish({
          status: 'failed',
          purchase,
          message: 'Google Play did not return a verifiable purchase token.',
        });
        return;
      }

      try {
        const verification = await params.onVerify(purchase);
        const androidPurchase = purchase as PurchaseAndroid;
        if (verification.verified) {
          // Acknowledge / finish transaction only after server confirms entitlement
          if (!androidPurchase.isAcknowledgedAndroid) {
            await finishTransaction({ purchase, isConsumable: false });
          }
          finish({
            status: 'purchased',
            purchase,
            verification,
            message: verification.message,
          });
          return;
        }

        if (verification.status === 'pending') {
          finish({
            status: 'pending',
            purchase,
            verification,
            message: verification.message,
          });
          return;
        }

        finish({
          status: 'failed',
          purchase,
          verification,
          message: verification.message || 'Purchase verification failed on server.',
        });
      } catch (verifyErr: any) {
        finish({
          status: 'failed',
          purchase,
          message: verifyErr?.message || 'Unable to verify Google Play purchase on server.',
        });
      }
    });

    subError = purchaseErrorListener((err) => {
      if (isUserCancelledError(err)) {
        finish({
          status: 'cancelled',
          message: 'Purchase was cancelled.',
        });
        return;
      }
      finish({
        status: 'failed',
        message: err?.message || 'Google Play purchase failed.',
      });
    });

    subBillingIssue = subscriptionBillingIssueListener(() => {
      finish({
        status: 'failed',
        message: 'Google Play reported a billing issue with your payment method.',
      });
    });

    params.triggerPurchase().catch((err: any) => {
      if (isUserCancelledError(err)) {
        finish({
          status: 'cancelled',
          message: 'Purchase was cancelled.',
        });
        return;
      }
      finish({
        status: 'failed',
        message: err?.message || 'Unable to launch Google Play Billing sheet.',
      });
    });
  });
}

export async function purchaseMembershipSubscription(params: {
  accessToken: string;
  userId: string;
  planId: 'plus' | 'premium';
  catalog: PlayBillingCatalog;
}): Promise<PlayBillingPurchaseOutcome> {
  if (!params.catalog.playConsoleProductsConfigured || !params.catalog.serverVerificationConfigured) {
    return {
      status: 'blocked',
      message:
        'Google Play subscriptions are not yet configured in Google Play Console or backend verification service.',
    };
  }

  const descriptor = params.catalog.products.find(
    (p) => p.productType === 'subs' && p.planTier === params.planId
  );
  if (!descriptor) {
    return {
      status: 'blocked',
      message: `No Google Play subscription SKU is configured for plan "${params.planId}".`,
    };
  }

  await ensurePlayBillingConnection();
  const storeSubs = await fetchStoreSubscriptions([descriptor.productId]);
  const storeSub = storeSubs.find((s) => s.id === descriptor.productId);
  if (!storeSub) {
    return {
      status: 'blocked',
      message: `Subscription SKU "${descriptor.productId}" is not available in Google Play Console yet.`,
    };
  }

  const offers = storeSub.subscriptionOffers || [];
  const matchingOffer = descriptor.basePlanId
    ? offers.find((o) => o.basePlanIdAndroid === descriptor.basePlanId) || offers[0]
    : offers[0];

  if (!matchingOffer?.offerTokenAndroid) {
    return {
      status: 'blocked',
      message: `No active base plan offer found in Google Play for "${descriptor.productId}".`,
    };
  }

  return awaitPlayPurchaseFlow({
    productId: descriptor.productId,
    triggerPurchase: async () => {
      await requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [descriptor.productId],
            obfuscatedAccountId: params.userId,
            subscriptionOffers: [
              {
                sku: descriptor.productId,
                offerToken: matchingOffer.offerTokenAndroid as string,
              },
            ],
          },
        },
      });
    },
    onVerify: async (purchase) => {
      const androidPurchase = purchase as PurchaseAndroid;
      const res = await verifyPlaySubscriptionOnServer(params.accessToken, {
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken!,
        basePlanId: descriptor.basePlanId || matchingOffer.basePlanIdAndroid || undefined,
        offerId: matchingOffer.id || undefined,
        orderId: purchase.transactionId || undefined,
        packageName: androidPurchase.packageNameAndroid || PLAY_BILLING_PACKAGE_NAME,
      });
      if (!res?.data) {
        throw new Error('Empty verification response from server.');
      }
      return res.data;
    },
  });
}

export async function purchasePanditConsultationProduct(params: {
  accessToken: string;
  userId: string;
  panditId: string;
  catalog: PlayBillingCatalog;
}): Promise<PlayBillingPurchaseOutcome> {
  if (!params.catalog.playConsoleProductsConfigured || !params.catalog.serverVerificationConfigured) {
    return {
      status: 'blocked',
      message:
        'Google Play one-time consultation products are not yet configured in Google Play Console or backend verification service.',
    };
  }

  const descriptor = params.catalog.products.find((p) => p.purpose === 'pandit_chat');
  if (!descriptor) {
    return {
      status: 'blocked',
      message: 'No Google Play SKU is configured for Pandit consultation unlocks.',
    };
  }

  await ensurePlayBillingConnection();
  const storeItems = await fetchStoreInAppProducts([descriptor.productId]);
  const storeItem = storeItems.find((item) => item.id === descriptor.productId);
  if (!storeItem) {
    return {
      status: 'blocked',
      message: `In-app product "${descriptor.productId}" is not available in Google Play Console yet.`,
    };
  }

  return awaitPlayPurchaseFlow({
    productId: descriptor.productId,
    triggerPurchase: async () => {
      await requestPurchase({
        type: 'in-app',
        request: {
          google: {
            skus: [descriptor.productId],
            obfuscatedAccountId: params.userId,
          },
        },
      });
    },
    onVerify: async (purchase) => {
      const androidPurchase = purchase as PurchaseAndroid;
      const res = await verifyPlayProductOnServer(params.accessToken, {
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken!,
        panditId: params.panditId,
        orderId: purchase.transactionId || undefined,
        packageName: androidPurchase.packageNameAndroid || PLAY_BILLING_PACKAGE_NAME,
      });
      if (!res?.data) {
        throw new Error('Empty verification response from server.');
      }
      return res.data;
    },
  });
}

export async function syncAndRestoreGooglePlayPurchases(
  accessToken: string,
  catalog: PlayBillingCatalog
): Promise<{
  restoredCount: number;
  message: string;
}> {
  if (!catalog.serverVerificationConfigured) {
    throw new Error(
      'Google Play backend verification is not configured on the server yet.'
    );
  }

  await ensurePlayBillingConnection();
  await restorePurchases();
  const available = await getAvailablePurchases();
  const mapped = (available || [])
    .filter((p) => Boolean(p.purchaseToken && p.productId))
    .map((p) => {
      const catalogItem = catalog.products.find((item) => item.productId === p.productId);
      return {
        productId: p.productId,
        purchaseToken: p.purchaseToken as string,
        productType: (catalogItem?.productType || 'subs') as 'subs' | 'in-app',
        basePlanId: catalogItem?.basePlanId || p.currentPlanId || undefined,
        orderId: p.transactionId || undefined,
      };
    });

  if (mapped.length === 0) {
    return {
      restoredCount: 0,
      message: 'No Google Play subscriptions found on this Google account.',
    };
  }

  const res = await restorePlayPurchasesOnServer(accessToken, mapped);
  return {
    restoredCount: res?.data?.restoredCount || 0,
    message:
      res?.message ||
      ((res?.data?.restoredCount || 0) > 0
        ? 'Active Google Play purchases restored.'
        : 'No active Google Play purchases eligible to restore.'),
  };
}

export async function openGooglePlaySubscriptions(sku?: string): Promise<void> {
  await deepLinkToSubscriptions({
    skuAndroid: sku,
    packageNameAndroid: PLAY_BILLING_PACKAGE_NAME,
  });
}
