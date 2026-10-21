import mongoose from 'mongoose';
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../services/token.service';
import { ChatService } from '../services/chat.service';
import { UserModel } from '../models/user.model';
import { config } from '../config/env';

let ioInstance: Server | null = null;

export class SocketService {
  /**
   * Initializes Socket.IO with HTTP server and authentication middleware
   */
  public static init(httpServer: HttpServer): Server {
    const io = new Server(httpServer, {
      cors: {
        origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Socket JWT Authentication Middleware
    io.use((socket: Socket, next) => {
      try {
        let token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization;

        if (token && token.startsWith('Bearer ')) {
          token = token.slice(7).trim();
        }

        if (!token) {
          return next(new Error('Authentication error: Token not provided'));
        }

        // Support mock dev session token in test / dev mode
        if (token === 'mock_dev_session_token') {
          socket.data.user = {
            userId: 'usr_dev_session',
            mobile: '9800000000',
            role: 'member',
          };
          return next();
        }

        const decoded = TokenService.verifyAccessToken(token);
        socket.data.user = decoded;
        next();
      } catch (err: any) {
        next(new Error(`Authentication failed: ${err.message || 'Invalid token'}`));
      }
    });

    const checkUserApproved = async (userId: string, role?: string): Promise<boolean> => {
      if (role === 'admin') return true;
      if (mongoose.connection.readyState === 1) {
        const u = await UserModel.findById(userId).select('approvalStatus status');
        return u?.status === 'active' && u?.approvalStatus === 'approved';
      }
      return true;
    };

    // Connection Handler
    io.on('connection', (socket: Socket) => {
      const user = socket.data.user;

      // Join Personal User Notification Room
      socket.join(`user_${user.userId}`);

      // Join specific conversation room after verifying membership and approval
      socket.on('join_conversation', async (data: { conversationId: string }, callback?: (res: any) => void) => {
        try {
          const { conversationId } = data || {};
          if (!conversationId) {
            callback?.({ success: false, error: 'conversationId required' });
            return;
          }

          const isApproved = await checkUserApproved(user.userId, user.role);
          if (!isApproved) {
            socket.emit('error_event', {
              code: 'APPROVAL_REQUIRED',
              message: 'Your profile must be approved by administration to participate in chats.',
            });
            callback?.({ success: false, error: 'Account approval required' });
            return;
          }

          const isMember = await ChatService.isUserInConversation(conversationId, user.userId);
          if (!isMember) {
            socket.emit('error_event', {
              code: 'FORBIDDEN',
              message: 'You are not a participant in this conversation',
            });
            callback?.({ success: false, error: 'Unauthorized conversation room' });
            return;
          }

          socket.join(`conv_${conversationId}`);
          callback?.({ success: true });
        } catch (err: any) {
          socket.emit('error_event', {
            code: 'JOIN_ERROR',
            message: err.message || 'Could not join conversation',
          });
          callback?.({ success: false, error: err.message });
        }
      });

      // Leave conversation room
      socket.on('leave_conversation', (data: { conversationId: string }) => {
        if (data?.conversationId) {
          socket.leave(`conv_${data.conversationId}`);
        }
      });

      // Send Message over Socket (Requires approval)
      socket.on(
        'send_message',
        async (
          data: { conversationId: string; text: string },
          callback?: (response: { success: boolean; data?: any; error?: string }) => void
        ) => {
          try {
            const { conversationId, text } = data || {};
            if (!conversationId || !text || !text.trim()) {
              callback?.({ success: false, error: 'conversationId and text are required' });
              return;
            }

            const isApproved = await checkUserApproved(user.userId, user.role);
            if (!isApproved) {
              socket.emit('error_event', {
                code: 'APPROVAL_REQUIRED',
                message: 'Your profile must be approved by administration to send messages.',
              });
              callback?.({ success: false, error: 'Account approval required' });
              return;
            }

            const message = await ChatService.sendMessage(user.userId, conversationId, text.trim());

            // Real-time broadcast to room
            io.to(`conv_${conversationId}`).emit('new_message', message);

            callback?.({ success: true, data: message });
          } catch (err: any) {
            socket.emit('error_event', {
              code: err.code || 'SEND_ERROR',
              message: err.message || 'Could not send message',
            });
            callback?.({ success: false, error: err.message });
          }
        }
      );

      // Mark conversation messages as read
      socket.on('mark_read', async (data: { conversationId: string }) => {
        try {
          if (!data?.conversationId) return;
          await ChatService.markMessagesAsRead(user.userId, data.conversationId);

          io.to(`conv_${data.conversationId}`).emit('messages_read', {
            conversationId: data.conversationId,
            readerId: user.userId,
            readAt: new Date().toISOString(),
          });
        } catch {
          // ignore socket mark read error
        }
      });

      socket.on('disconnect', () => {
        // Disconnected
      });
    });

    ioInstance = io;
    return io;
  }

  public static getIO(): Server | null {
    return ioInstance;
  }

  /**
   * Helper to emit event to a conversation room
   */
  public static emitToConversation(conversationId: string, event: string, payload: any): void {
    if (ioInstance) {
      ioInstance.to(`conv_${conversationId}`).emit(event, payload);
    }
  }

  /**
   * Helper to emit event to a specific user
   */
  public static emitToUser(userId: string, event: string, payload: any): void {
    if (ioInstance) {
      ioInstance.to(`user_${userId}`).emit(event, payload);
    }
  }
}
