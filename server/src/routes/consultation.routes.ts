import { Router, Request, Response, NextFunction } from 'express';
import { ConsultationTokenService } from '../services/consultation-token.service';
import { requireAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const consultationRouter = Router();

// POST /api/v1/consultations/:bookingId/token (Generate secure WebRTC room token)
consultationRouter.post('/:bookingId/token', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const bookingId = req.params.bookingId;

    const tokenSession = await ConsultationTokenService.generateRoomToken(bookingId, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Consultation session authorized.',
      data: tokenSession,
    };
    res.status(200).json(response);
  } catch (error: any) {
    next(error);
  }
});
