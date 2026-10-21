import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/requestValidator';
import { requireAuth } from '../middleware/auth.middleware';
import {
  requestOtpSchema,
  verifyOtpSchema,
  registerSchema,
  refreshTokenSchema,
  firebaseLoginSchema,
} from '@bandhansetu/shared';

export const authRouter = Router();

// Firebase Authentication (Phone OTP & Google Sign-In verification)
authRouter.post(
  '/firebase-login',
  validateRequest({ body: firebaseLoginSchema }),
  AuthController.firebaseLogin
);


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

// 4. Refresh Session Tokens
authRouter.post(
  '/refresh',
  validateRequest({ body: refreshTokenSchema }),
  AuthController.refreshToken
);

// 5. Get Current User Profile (Authenticated)
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
