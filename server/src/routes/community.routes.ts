import { Router, Request, Response, NextFunction } from 'express';
import { CommunityService } from '../services/community.service';
import { requireAuth } from '../middleware/auth.middleware';
import { requireApproved } from '../middleware/approval.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const communityRouter = Router();

// GET /api/v1/community/feed (Public/Authenticated: Approved posts only)
communityRouter.get('/feed', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, category } = req.query;
    const currentUserId = (req as any).user?.id;

    const feed = await CommunityService.getPublicFeed(
      currentUserId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      category as string
    );

    const response: ApiResponse = {
      success: true,
      data: feed,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/community/posts (Create post - requires approved user)
communityRouter.post('/posts', requireAuth, requireApproved, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { mediaUrl, publicId, caption, category } = req.body;

    if (!mediaUrl || !caption) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'mediaUrl and caption are required.' },
      });
      return;
    }

    const post = await CommunityService.createPost({
      userId,
      mediaUrl,
      publicId,
      caption,
      category,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Your story has been submitted for moderation and will appear publicly once approved.',
      data: post,
    };
    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
});

// POST /api/v1/community/posts/:id/like
communityRouter.post('/posts/:id/like', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const result = await CommunityService.toggleLikePost(req.params.id, userId);

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/community/posts/:id/report
communityRouter.post('/posts/:id/report', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { reason } = req.body;
    const result = await CommunityService.reportPost(req.params.id, userId, reason || 'Inappropriate content');

    const response: ApiResponse = {
      success: true,
      message: result.message,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
