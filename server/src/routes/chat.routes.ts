import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/requestValidator';
import {
  createConversationSchema,
  sendMessageSchema,
  contactRequestActionSchema,
} from '@bandhansetu/shared';

export const chatRouter = Router();

// GET /api/v1/conversations
chatRouter.get('/', requireAuth, ChatController.getConversations);

// POST /api/v1/conversations
chatRouter.post(
  '/',
  requireAuth,
  validateRequest({ body: createConversationSchema }),
  ChatController.getOrCreateConversation
);

// GET /api/v1/conversations/:conversationId/messages
chatRouter.get('/:conversationId/messages', requireAuth, ChatController.getMessages);

// POST /api/v1/conversations/:conversationId/messages
chatRouter.post(
  '/:conversationId/messages',
  requireAuth,
  validateRequest({ body: sendMessageSchema }),
  ChatController.sendMessage
);

// PATCH /api/v1/conversations/:conversationId/read
chatRouter.patch('/:conversationId/read', requireAuth, ChatController.markRead);

// POST /api/v1/conversations/:conversationId/contact-request
chatRouter.post(
  '/:conversationId/contact-request',
  requireAuth,
  validateRequest({ body: contactRequestActionSchema }),
  ChatController.handleContactRequest
);
