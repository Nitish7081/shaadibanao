import { Router, Request, Response, NextFunction } from 'express';
import { CallService } from '../services/call.service';
import { requireAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const callRouter = Router();

// WebRTC ICE / STUN configuration (free & public)
callRouter.get('/config', (req: Request, res: Response): void => {
  const config = CallService.getWebRtcConfig();
  res.status(200).json({ success: true, data: config });
});

callRouter.get('/webrtc/config', (req: Request, res: Response): void => {
  const config = CallService.getWebRtcConfig();
  res.status(200).json({ success: true, data: config });
});

// Authenticated Call Routes
callRouter.use(requireAuth);

// POST /api/v1/calls/initiate
callRouter.post('/initiate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const callerId = (req as any).user.id || (req as any).user.userId;
    const { receiverId, callType, panditId } = req.body;

    const session = await CallService.initiateCall({
      callerId,
      receiverId,
      callType: callType || 'audio',
      panditId,
    });

    const response: ApiResponse = {
      success: true,
      message: `${callType === 'video' ? 'Video' : 'Audio'} call initiated successfully.`,
      data: session,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/calls/:sessionId/accept
callRouter.post('/:sessionId/accept', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const receiverId = (req as any).user.id || (req as any).user.userId;
    const session = await CallService.acceptCall(req.params.sessionId, receiverId);

    const response: ApiResponse = {
      success: true,
      message: 'Call accepted.',
      data: session,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/calls/:sessionId/reject
callRouter.post('/:sessionId/reject', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const receiverId = (req as any).user.id || (req as any).user.userId;
    const { reason } = req.body;
    const session = await CallService.rejectCall(req.params.sessionId, receiverId, reason);

    const response: ApiResponse = {
      success: true,
      message: 'Call rejected.',
      data: session,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/calls/:sessionId/end
callRouter.post('/:sessionId/end', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const { reason, durationSeconds } = req.body;
    const session = await CallService.endCall(req.params.sessionId, userId, reason, durationSeconds);

    const response: ApiResponse = {
      success: true,
      message: 'Call ended.',
      data: session,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/calls/history
callRouter.get('/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const { page, limit } = req.query;

    const data = await CallService.getUserCallHistory(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20
    );

    const response: ApiResponse = {
      success: true,
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/calls/pandit/history
callRouter.get('/pandit/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const { page, limit } = req.query;

    const data = await CallService.getPanditCallHistory(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20
    );

    const response: ApiResponse = {
      success: true,
      data,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
