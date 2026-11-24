import { Router } from 'express';
import { MembershipController } from '../controllers/membership.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const membershipRouter = Router();

// GET /api/v1/membership/plans (Public / Authenticated catalog)
membershipRouter.get('/plans', MembershipController.getPlans);

// GET /api/v1/membership/me (Authenticated user's active membership & entitlements)
membershipRouter.get('/me', requireAuth, MembershipController.getMe);

// POST /api/v1/membership/order (Create order for Razorpay payment)
membershipRouter.post('/order', requireAuth, MembershipController.createOrder);

// POST /api/v1/membership/verify (Verify payment signature & activate plan)
membershipRouter.post('/verify', requireAuth, MembershipController.verifyPayment);

// POST /api/v1/membership/checkout (Checkout advisory)
membershipRouter.post('/checkout', requireAuth, MembershipController.checkout);
