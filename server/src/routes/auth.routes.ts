import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/requestValidator';
import { requireAuth } from '../middleware/auth.middleware';
import {
  requestOtpSchema,
  verifyOtpSchema,
  registerSchema,
} from '@bandhansetu/shared';

export const authRouter = Router();

// 1. Request verification OTP
authRouter.post(
  '/request-otp',
  validateRequest({ body: requestOtpSchema }),
  AuthController.requestOtp
);

// 2. Verify OTP
authRouter.post(
  '/verify-otp',
  validateRequest({ body: verifyOtpSchema }),
  AuthController.verifyOtp
);

// 3. Complete Registration
authRouter.post(
  '/register',
  validateRequest({ body: registerSchema }),
  AuthController.register
);

// 4. Get Current User Profile (Authenticated)
authRouter.get(
  '/me',
  requireAuth,
  AuthController.getMe
);

// 5. Logout
authRouter.post(
  '/logout',
  requireAuth,
  AuthController.logout
);
