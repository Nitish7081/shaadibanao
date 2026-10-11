import { Router } from 'express';
import { PreferenceController } from '../controllers/preference.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/requestValidator';
import { partnerPreferencesSchema } from '@bandhansetu/shared';

export const preferenceRouter = Router();

// My Partner Preferences
preferenceRouter.get('/me', requireAuth, PreferenceController.getMyPreferences);
preferenceRouter.put(
  '/me',
  requireAuth,
  validateRequest({ body: partnerPreferencesSchema }),
  PreferenceController.upsertMyPreferences
);
