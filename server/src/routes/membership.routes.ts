import { Router } from 'express';
import { MembershipController } from '../controllers/membership.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/requestValidator';
import { checkoutPlanSchema } from '@bandhansetu/shared';

export const membershipRouter = Router();

// GET /api/v1/membership/plans (Public / Authenticated catalog)
membershipRouter.get('/plans', MembershipController.getPlans);

// GET /api/v1/membership/me (Authenticated user's active membership & entitlements)
membershipRouter.get('/me', requireAuth, MembershipController.getMe);

// POST /api/v1/membership/checkout (Development-only advisory placeholder)
membershipRouter.post(
  '/checkout',
  requireAuth,
  validateRequest({ body: checkoutPlanSchema }),
  MembershipController.checkout
);
