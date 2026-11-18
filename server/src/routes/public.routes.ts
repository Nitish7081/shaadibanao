import { Router } from 'express';
import {
  accountDeletionChallengeSchema,
  accountDeletionStatusParamsSchema,
  accountDeletionSubmitSchema,
  publicContactSchema,
} from '@bandhansetu/shared';
import { PublicController } from '../controllers/public.controller';
import {
  accountDeletionLimiter,
  publicReadLimiter,
  publicWriteLimiter,
} from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/requestValidator';

export const publicRouter = Router();

// 1. Public Privacy Policy (JSON legal document + version metadata)
publicRouter.get('/privacy-policy', publicReadLimiter, PublicController.getPrivacyPolicy);

// 2. Public Terms & Conditions (JSON legal document + version metadata)
publicRouter.get('/terms', publicReadLimiter, PublicController.getTerms);

// 3a. Request OTP Challenge for Web Account Deletion Verification
publicRouter.post(
  '/account-deletion/request-otp',
  accountDeletionLimiter,
  validateRequest({ body: accountDeletionChallengeSchema }),
  PublicController.requestDeletionOtp
);

// 3b. Submit Verified Account Deletion Request (supports Bearer JWT, Firebase ID Token, or Verified OTP)
publicRouter.post(
  '/account-deletion',
  accountDeletionLimiter,
  validateRequest({ body: accountDeletionSubmitSchema }),
  PublicController.submitAccountDeletion
);

// 4. Check Account Deletion Request Status by Reference ID (DEL-YYYYMMDD-XXXXXX)
publicRouter.get(
  '/account-deletion/:requestId',
  publicReadLimiter,
  validateRequest({ params: accountDeletionStatusParamsSchema }),
  PublicController.getAccountDeletionStatus
);

// 5. Submit Public Contact / Support / Grievance Inquiry
publicRouter.post(
  '/contact',
  publicWriteLimiter,
  validateRequest({ body: publicContactSchema }),
  PublicController.submitContact
);
