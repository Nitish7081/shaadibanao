import { Request, Response, NextFunction } from 'express';
import { SocialService } from '../services/social.service';
import { AppError } from '../middleware/errorHandler';

export class SocialController {
  public static async getStories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const stories = await SocialService.getStoriesFeed(userId);
      res.status(200).json({
        success: true,
        data: stories,
        meta: { totalCount: stories.length, timestamp: new Date().toISOString() },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async sendHello(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const recipientId = req.params.recipientId || req.body.recipientId;
      if (!recipientId) {
        throw new AppError('recipientId is required', 400, 'VALIDATION_ERROR');
      }
      const result = await SocialService.sendFreeHello(userId, recipientId, req.body?.message);
      res.status(201).json({
        success: true,
        message: 'Free Hello sent successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getHelloStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const status = await SocialService.getHelloStatus(userId, req.params.recipientId);
      res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }

  public static async getSentHellos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const items = await SocialService.getSentHellos(userId);
      res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  public static async getReceivedHellos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const items = await SocialService.getReceivedHellos(userId);
      res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  public static async sendFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const recipientId = req.params.recipientId || req.body.recipientId;
      if (!recipientId) {
        throw new AppError('recipientId is required', 400, 'VALIDATION_ERROR');
      }
      const item = await SocialService.sendFriendRequest(userId, recipientId, req.body?.note);
      res.status(201).json({
        success: true,
        message: 'Friend request sent',
        data: item,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async respondFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { requestId } = req.params;
      const rawAction = req.body?.action || req.body?.status;
      if (!['accept', 'reject', 'accepted', 'rejected'].includes(rawAction)) {
        throw new AppError('Valid action (accept/reject) or status (accepted/rejected) is required', 400, 'VALIDATION_ERROR');
      }
      const action: 'accept' | 'reject' =
        rawAction === 'accept' || rawAction === 'accepted' ? 'accept' : 'reject';

      const item = await SocialService.respondToFriendRequest(userId, requestId, action);
      res.status(200).json({
        success: true,
        message: action === 'accept' ? 'Friend request accepted. Two-way chat activated.' : 'Friend request rejected.',
        data: item,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async acceptFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const item = await SocialService.respondToFriendRequest(userId, req.params.requestId, 'accept');
      res.status(200).json({
        success: true,
        message: 'Friend request accepted. Two-way chat activated.',
        data: item,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async rejectFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const item = await SocialService.respondToFriendRequest(userId, req.params.requestId, 'reject');
      res.status(200).json({
        success: true,
        message: 'Friend request rejected.',
        data: item,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getReceivedFriendRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const items = await SocialService.getReceivedFriendRequests(userId);
      res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  public static async getSentFriendRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const items = await SocialService.getSentFriendRequests(userId);
      res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  public static async getFriends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const items = await SocialService.getFriends(userId);
      res.status(200).json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  public static async blockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const result = await SocialService.blockUser(userId, req.params.targetId, req.body?.reason);
      res.status(200).json({ success: true, message: 'User blocked', data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async unblockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const result = await SocialService.unblockUser(userId, req.params.targetId);
      res.status(200).json({ success: true, message: 'User unblocked', data: result });
    } catch (err) {
      next(err);
    }
  }
}
