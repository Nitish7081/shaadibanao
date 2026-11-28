import fs from 'fs';
import path from 'path';

const mockPurchaseUpdatedCallbacks: Array<(p: any) => void> = [];
const mockPurchaseErrorCallbacks: Array<(e: any) => void> = [];
const mockBillingIssueCallbacks: Array<() => void> = [];

const mockInitConnection = jest.fn(async () => true);
const mockEndConnection = jest.fn(async () => undefined);
const mockFetchProducts = jest.fn();
const mockRequestPurchase = jest.fn();
const mockFinishTransaction = jest.fn(async () => undefined);
const mockGetAvailablePurchases = jest.fn();
const mockRestorePurchases = jest.fn(async () => undefined);
const mockDeepLinkToSubscriptions = jest.fn(async () => undefined);
const mockIsUserCancelledError = jest.fn((err: any) => err?.code === 'user-cancelled');

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {},
}));

jest.mock('expo-iap', () => ({
  initConnection: mockInitConnection,
  endConnection: mockEndConnection,
  fetchProducts: mockFetchProducts,
  requestPurchase: mockRequestPurchase,
  finishTransaction: mockFinishTransaction,
  getAvailablePurchases: mockGetAvailablePurchases,
  restorePurchases: mockRestorePurchases,
  deepLinkToSubscriptions: mockDeepLinkToSubscriptions,
  isUserCancelledError: mockIsUserCancelledError,
  purchaseUpdatedListener: (cb: (p: any) => void) => {
    mockPurchaseUpdatedCallbacks.push(cb);
    return {
      remove: () => {
        const idx = mockPurchaseUpdatedCallbacks.indexOf(cb);
        if (idx >= 0) mockPurchaseUpdatedCallbacks.splice(idx, 1);
      },
    };
  },
  purchaseErrorListener: (cb: (e: any) => void) => {
    mockPurchaseErrorCallbacks.push(cb);
    return {
      remove: () => {
        const idx = mockPurchaseErrorCallbacks.indexOf(cb);
        if (idx >= 0) mockPurchaseErrorCallbacks.splice(idx, 1);
      },
    };
  },
  subscriptionBillingIssueListener: (cb: () => void) => {
    mockBillingIssueCallbacks.push(cb);
    return {
      remove: () => {
        const idx = mockBillingIssueCallbacks.indexOf(cb);
        if (idx >= 0) mockBillingIssueCallbacks.splice(idx, 1);
      },
    };
  },
}));

const mockApiClient = jest.fn();
jest.mock('../src/services/apiClient', () => ({
  apiClient: (...args: any[]) => mockApiClient(...args),
}));

import {
  purchaseMembershipSubscription,
  purchasePanditConsultationProduct,
  syncAndRestoreGooglePlayPurchases,
} from '../src/services/playBillingService';
import { PlayBillingCatalog } from '@bandhansetu/shared';

describe('Mobile Play Billing Integration', () => {
  const configuredCatalog: PlayBillingCatalog = {
    packageName: 'com.shaadibanao.app',
    serverVerificationConfigured: true,
    playConsoleProductsConfigured: true,
    products: [
      {
        purpose: 'membership_plus',
        productId: 'shaadibanao_plus_3m',
        productType: 'subs',
        basePlanId: 'plus-3-months',
        planTier: 'plus',
        durationDays: 90,
      },
      {
        purpose: 'pandit_chat',
        productId: 'shaadibanao_pandit_chat_unlock',
        productType: 'in-app',
        durationDays: 7,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPurchaseUpdatedCallbacks.length = 0;
    mockPurchaseErrorCallbacks.length = 0;
    mockBillingIssueCallbacks.length = 0;
  });

  it('blocks checkout without fake success when Play Console products are not configured', async () => {
    const outcome = await purchaseMembershipSubscription({
      accessToken: 'jwt_token',
      userId: 'user_1',
      planId: 'plus',
      catalog: {
        ...configuredCatalog,
        playConsoleProductsConfigured: false,
        serverVerificationConfigured: false,
      },
    });

    expect(outcome.status).toBe('blocked');
    expect(mockRequestPurchase).not.toHaveBeenCalled();
  });

  it('launches Play Billing subscription purchase, verifies token on backend, and acknowledges transaction', async () => {
    mockFetchProducts.mockResolvedValueOnce([
      {
        id: 'shaadibanao_plus_3m',
        subscriptionOffers: [
          {
            id: 'intro',
            basePlanIdAndroid: 'plus-3-months',
            offerTokenAndroid: 'offer_token_plus_90d',
          },
        ],
      },
    ]);

    mockApiClient.mockResolvedValueOnce({
      success: true,
      data: {
        verified: true,
        status: 'active',
        entitlementGranted: true,
        acknowledged: true,
        productId: 'shaadibanao_plus_3m',
        planId: 'plus',
        message: 'Google Play subscription verified.',
      },
    });

    mockRequestPurchase.mockImplementationOnce(async () => {
      mockPurchaseUpdatedCallbacks.forEach((cb) =>
        cb({
          productId: 'shaadibanao_plus_3m',
          purchaseToken: 'play_live_purchase_token_12345',
          purchaseState: 'purchased',
          transactionId: 'GPA.1234-5678',
          isAcknowledgedAndroid: false,
          packageNameAndroid: 'com.shaadibanao.app',
        })
      );
    });

    const outcome = await purchaseMembershipSubscription({
      accessToken: 'jwt_token',
      userId: 'user_1',
      planId: 'plus',
      catalog: configuredCatalog,
    });

    expect(outcome.status).toBe('purchased');
    expect(mockApiClient).toHaveBeenCalledWith(
      '/billing/play/verify-subscription',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockFinishTransaction).toHaveBeenCalledTimes(1);
  });

  it('handles pending purchases and user cancellations without finishing unverified transactions', async () => {
    mockFetchProducts.mockResolvedValue([
      {
        id: 'shaadibanao_pandit_chat_unlock',
      },
    ]);

    mockRequestPurchase.mockImplementationOnce(async () => {
      mockPurchaseUpdatedCallbacks.forEach((cb) =>
        cb({
          productId: 'shaadibanao_pandit_chat_unlock',
          purchaseToken: 'play_pending_token_999',
          purchaseState: 'pending',
        })
      );
    });

    const pendingOutcome = await purchasePanditConsultationProduct({
      accessToken: 'jwt_token',
      userId: 'user_1',
      panditId: 'pandit_1',
      catalog: configuredCatalog,
    });
    expect(pendingOutcome.status).toBe('pending');
    expect(mockFinishTransaction).not.toHaveBeenCalled();

    mockRequestPurchase.mockImplementationOnce(async () => {
      mockPurchaseErrorCallbacks.forEach((cb) => cb({ code: 'user-cancelled', message: 'Cancelled' }));
    });
    const cancelOutcome = await purchasePanditConsultationProduct({
      accessToken: 'jwt_token',
      userId: 'user_1',
      panditId: 'pandit_1',
      catalog: configuredCatalog,
    });
    expect(cancelOutcome.status).toBe('cancelled');
  });

  it('restores Google Play purchases through /billing/play/restore', async () => {
    mockGetAvailablePurchases.mockResolvedValueOnce([
      {
        productId: 'shaadibanao_plus_3m',
        purchaseToken: 'play_restore_token_12345',
        transactionId: 'GPA.5555-6666',
      },
    ]);
    mockApiClient.mockResolvedValueOnce({
      success: true,
      message: 'Active Google Play purchases restored.',
      data: { restoredCount: 1, results: [], membership: { planId: 'plus' } },
    });

    const res = await syncAndRestoreGooglePlayPurchases('jwt_token', configuredCatalog);
    expect(res.restoredCount).toBe(1);
    expect(mockRestorePurchases).toHaveBeenCalledTimes(1);
    expect(mockApiClient).toHaveBeenCalledWith(
      '/billing/play/restore',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('confirms production screens contain no synthetic payment IDs or testing-mode purchase stubs', () => {
    const filesToCheck = [
      path.join(__dirname, '../src/screens/MembershipScreen.tsx'),
      path.join(__dirname, '../src/screens/ChatDetailScreen.tsx'),
      path.join(__dirname, '../src/screens/PanditDetailScreen.tsx'),
      path.join(__dirname, '../src/services/playBillingService.ts'),
    ];
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/pay_pchat_|pay_mobile_|Testing Mode|Unconfigured Gateway/);
    }
  });
});
