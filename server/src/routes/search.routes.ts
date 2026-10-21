import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireApproved } from '../middleware/approval.middleware';
import { validateRequest } from '../middleware/requestValidator';
import { searchFilterSchema } from '@bandhansetu/shared';

export const searchRouter = Router();

// Enforce authentication AND administrator approval for search
searchRouter.use(requireAuth, requireApproved);

// GET /api/v1/search
searchRouter.get(
  '/',
  validateRequest({ query: searchFilterSchema }),
  SearchController.searchProfiles
);

