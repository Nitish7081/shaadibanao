import { Request, Response, NextFunction } from 'express';
import { MembershipService } from '../services/membership.service';

export class MembershipController {
  /**
   * GET /api/v1/membership/plans
   */
  public static async getPlans(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const plans = MembershipService.getPlans();
      res.status(200).json({
        success: true,
        data: plans,
        meta: {
          totalPlans: plans.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/membership/me
   */
  public static async getMe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const membership = await MembershipService.getUserMembership(userId);

      res.status(200).json({
        success: true,
        data: membership,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/membership/checkout
   */
  public static async checkout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { planId } = req.body;

      const checkoutResult = await MembershipService.initiateCheckout(userId, planId);

      res.status(200).json({
        success: true,
        message: 'Checkout advisory: Payments are currently unconfigured',
        data: checkoutResult,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
