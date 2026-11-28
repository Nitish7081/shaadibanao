import { Router } from 'express';
import { SocialController } from '../controllers/social.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireApproved } from '../middleware/approval.middleware';
import { validateRequest } from '../middleware/requestValidator';
import {
  sendHelloSchema,
  sendFriendRequestSchema,
  respondFriendRequestSchema,
} from '@bandhansetu/shared';

export const storiesRouter = Router();
storiesRouter.use(requireAuth, requireApproved);
storiesRouter.get('/', SocialController.getStories);

export const helloRouter = Router();
helloRouter.use(requireAuth, requireApproved);
helloRouter.get('/sent', SocialController.getSentHellos);
helloRouter.get('/received', SocialController.getReceivedHellos);
helloRouter.get('/status/:recipientId', SocialController.getHelloStatus);
helloRouter.post('/', validateRequest({ body: sendHelloSchema }), SocialController.sendHello);
helloRouter.post('/:recipientId', validateRequest({ body: sendHelloSchema }), SocialController.sendHello);

export const friendRequestRouter = Router();
friendRequestRouter.use(requireAuth, requireApproved);
friendRequestRouter.get('/received', SocialController.getReceivedFriendRequests);
friendRequestRouter.get('/sent', SocialController.getSentFriendRequests);
friendRequestRouter.get('/friends', SocialController.getFriends);
friendRequestRouter.post('/', validateRequest({ body: sendFriendRequestSchema }), SocialController.sendFriendRequest);
friendRequestRouter.post('/:recipientId', validateRequest({ body: sendFriendRequestSchema }), SocialController.sendFriendRequest);
friendRequestRouter.patch(
  '/:requestId',
  validateRequest({ body: respondFriendRequestSchema }),
  SocialController.respondFriendRequest
);
friendRequestRouter.post('/:requestId/accept', SocialController.acceptFriendRequest);
friendRequestRouter.post('/:requestId/reject', SocialController.rejectFriendRequest);

export const blockRouter = Router();
blockRouter.use(requireAuth, requireApproved);
blockRouter.post('/:targetId', SocialController.blockUser);
blockRouter.delete('/:targetId', SocialController.unblockUser);
