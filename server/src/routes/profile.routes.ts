import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/requestValidator';
import { upsertProfileSchema } from '@bandhansetu/shared';

export const profileRouter = Router();

// My Profile (Owner view & update)
profileRouter.get('/me', requireAuth, ProfileController.getMyProfile);
profileRouter.put(
  '/me',
  requireAuth,
  validateRequest({ body: upsertProfileSchema }),
  ProfileController.upsertMyProfile
);

// Public Profile (Permitted redacted view)
profileRouter.get('/:profileId', requireAuth, ProfileController.getPublicProfile);
