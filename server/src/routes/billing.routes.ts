import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/requestValidator';
import {
  verifyPlaySubscriptionSchema,
  verifyPlayProductSchema,
  restorePlayPurchasesSchema,
} from '@bandhansetu/shared';

export const billingRouter = Router();

billingRouter.get('/play/catalog', BillingController.getPlayCatalog);

billingRouter.post(
  '/play/verify-subscription',
  requireAuth,
  validateRequest({ body: verifyPlaySubscriptionSchema }),
  BillingController.verifySubscription
);

billingRouter.post(
  '/play/verify-product',
  requireAuth,
  validateRequest({ body: verifyPlayProductSchema }),
  BillingController.verifyProduct
);

billingRouter.post(
  '/play/restore',
  requireAuth,
  validateRequest({ body: restorePlayPurchasesSchema }),
  BillingController.restorePurchases
);

billingRouter.post('/play/rtdn', BillingController.handlePlayRtdn);
