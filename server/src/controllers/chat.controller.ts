import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service';

export class ChatController {
  /**
   * GET /api/v1/conversations
   */
  public static async getConversations(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const conversations = await ChatService.getConversations(userId);

      res.status(200).json({
        success: true,
        data: conversations,
        meta: {
          totalCount: conversations.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/conversations
   */
  public static async getOrCreateConversation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { participantId } = req.body;

      const conversation = await ChatService.getOrCreateConversation(userId, participantId);

      res.status(201).json({
        success: true,
        message: 'Conversation ready',
        data: conversation,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/conversations/:conversationId/messages
   */
  public static async getMessages(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { conversationId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await ChatService.getMessages(userId, conversationId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/conversations/:conversationId/messages
   */
  public static async sendMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { conversationId } = req.params;
      const { text } = req.body;

      const message = await ChatService.sendMessage(userId, conversationId, text);

      res.status(201).json({
        success: true,
        message: 'Message delivered',
        data: message,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/conversations/:conversationId/read
   */
  public static async markRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { conversationId } = req.params;

      await ChatService.markMessagesAsRead(userId, conversationId);

      res.status(200).json({
        success: true,
        message: 'Messages marked as read',
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/conversations/:conversationId/contact-request
   */
  public static async handleContactRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { conversationId } = req.params;
      const { action } = req.body;

      const result = await ChatService.handleContactExchange(userId, conversationId, action);

      res.status(200).json({
        success: true,
        message: `Contact request ${action}ed successfully`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
