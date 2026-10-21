import { Router } from 'express';
import { ShortlistController } from '../controllers/shortlist.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireApproved } from '../middleware/approval.middleware';

export const shortlistRouter = Router();

// Enforce authentication AND administrator approval for shortlists
shortlistRouter.use(requireAuth, requireApproved);

// GET /api/v1/shortlists
shortlistRouter.get('/', requireAuth, ShortlistController.getShortlists);

// POST /api/v1/shortlists/:profileId
shortlistRouter.post('/:profileId', requireAuth, ShortlistController.addShortlist);

// DELETE /api/v1/shortlists/:profileId
shortlistRouter.delete('/:profileId', requireAuth, ShortlistController.removeShortlist);
