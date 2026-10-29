import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireApproved } from '../middleware/approval.middleware';
import { requireSubscriptionForFemaleProfile } from '../middleware/subscriptionGate';
import { validateRequest } from '../middleware/requestValidator';
import { upsertProfileSchema } from '@bandhansetu/shared';

export const profileRouter = Router();

// My Profile (Owner view & update: allowed for pending users to build their biodata)
profileRouter.get('/me', requireAuth, ProfileController.getMyProfile);
profileRouter.put(
  '/me',
  requireAuth,
  validateRequest({ body: upsertProfileSchema }),
  ProfileController.upsertMyProfile
);

// Public Profile (Requires approved account status & subscription gate for female profiles)
profileRouter.get(
  '/:profileId',
  requireAuth,
  requireApproved,
  requireSubscriptionForFemaleProfile,
  ProfileController.getPublicProfile
);
