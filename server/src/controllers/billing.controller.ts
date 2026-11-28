import { Request, Response, NextFunction } from 'express';
import { PlayBillingService } from '../services/playBilling.service';
import { AppError } from '../middleware/errorHandler';

export class BillingController {
  public static getPlayCatalog(req: Request, res: Response, next: NextFunction): void {
    try {
      const catalog = PlayBillingService.getCatalog();
      res.status(200).json({ success: true, data: catalog });
    } catch (err) {
      next(err);
    }
  }

  public static async verifySubscription(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const result = await PlayBillingService.verifySubscriptionPurchase(userId, req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async verifyProduct(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const result = await PlayBillingService.verifyProductPurchase(userId, req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async restorePurchases(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const result = await PlayBillingService.restorePurchases(
        userId,
        req.body?.purchases || []
      );
      res.status(200).json({
        success: true,
        message:
          result.restoredCount > 0
            ? 'Active Google Play purchases restored.'
            : 'No active Google Play subscriptions found to restore.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async handlePlayRtdn(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const configuredSecret = (process.env.GOOGLE_PLAY_RTDN_TOKEN || '').trim();
      if (configuredSecret) {
        const provided = String(req.headers['x-play-rtdn-token'] || req.query.token || '');
        if (provided !== configuredSecret) {
          throw new AppError('Unauthorized RTDN webhook token.', 401, 'UNAUTHORIZED');
        }
      }

      let payload = req.body;
      // Support standard Google Cloud Pub/Sub base64 push envelope
      if (req.body?.message?.data && typeof req.body.message.data === 'string') {
        payload = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString('utf8'));
      }

      const result = await PlayBillingService.handleRtdnNotification(payload);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
