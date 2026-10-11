import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/requestValidator';
import { searchFilterSchema } from '@bandhansetu/shared';

export const searchRouter = Router();

// GET /api/v1/search
searchRouter.get(
  '/',
  requireAuth,
  validateRequest({ query: searchFilterSchema }),
  SearchController.searchProfiles
);
