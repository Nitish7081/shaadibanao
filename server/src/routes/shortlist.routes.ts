import { Router } from 'express';
import { ShortlistController } from '../controllers/shortlist.controller';
import { requireAuth } from '../middleware/auth.middleware';

export const shortlistRouter = Router();

// GET /api/v1/shortlists
shortlistRouter.get('/', requireAuth, ShortlistController.getShortlists);

// POST /api/v1/shortlists/:profileId
shortlistRouter.post('/:profileId', requireAuth, ShortlistController.addShortlist);

// DELETE /api/v1/shortlists/:profileId
shortlistRouter.delete('/:profileId', requireAuth, ShortlistController.removeShortlist);
