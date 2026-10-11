import { Router } from 'express';
import { InterestController } from '../controllers/interest.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/requestValidator';
import { updateInterestStatusSchema } from '@bandhansetu/shared';

export const interestRouter = Router();

// GET /api/v1/interests/received
interestRouter.get('/received', requireAuth, InterestController.getReceived);

// GET /api/v1/interests/sent
interestRouter.get('/sent', requireAuth, InterestController.getSent);

// POST /api/v1/interests/:profileId (Send)
interestRouter.post('/:profileId', requireAuth, InterestController.sendInterest);

// PATCH /api/v1/interests/:interestId (Accept or Decline)
interestRouter.patch(
  '/:interestId',
  requireAuth,
  validateRequest({ body: updateInterestStatusSchema }),
  InterestController.updateStatus
);

// DELETE /api/v1/interests/:interestId (Withdraw)
interestRouter.delete('/:interestId', requireAuth, InterestController.withdraw);
