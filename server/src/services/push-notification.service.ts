import { UserModel } from '../models/user.model';
import { initializeFirebaseAdmin } from '../config/firebase';

export class PushNotificationService {
  /**
   * Send push notification to a user's registered devices
   */
  static async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    }
  ): Promise<boolean> {
    try {
      const user = await UserModel.findById(userId).select('fcmTokens');
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        return false;
      }

      const firebaseApp = initializeFirebaseAdmin();
      if (!firebaseApp) {
        return false;
      }

      // Dynamic import of firebase-admin/messaging to prevent loading errors
      const { getMessaging } = await import('firebase-admin/messaging');
      const messaging = getMessaging(firebaseApp);

      const message = {
        tokens: user.fcmTokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      };

      const response = await messaging.sendEachForMulticast(message);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const validTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (resp.success) {
            validTokens.push(user.fcmTokens[idx]);
          }
        });
        user.fcmTokens = validTokens;
        await user.save();
      }

      return response.successCount > 0;
    } catch {
      // Non-blocking for offline or mock environments
      return false;
    }
  }

  /**
   * Register an FCM token for a user
   */
  static async registerToken(userId: string, token: string): Promise<void> {
    if (!token) return;
    try {
      await UserModel.findByIdAndUpdate(userId, {
        $addToSet: { fcmTokens: token.trim() },
      });
    } catch {
      // Non-blocking
    }
  }

  /**
   * Remove an FCM token on logout
   */
  static async removeToken(userId: string, token: string): Promise<void> {
    if (!token) return;
    try {
      await UserModel.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: token.trim() },
      });
    } catch {
      // Non-blocking
    }
  }
}
