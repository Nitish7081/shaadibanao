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
      const plans = await MembershipService.getPlansAsync();
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
      const userId = (req as any).user.userId || (req as any).user.id;
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
   * POST /api/v1/membership/order
   */
  public static async createOrder(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const { planId } = req.body;
      const order = await MembershipService.createOrder(userId, planId);

      res.status(200).json({
        success: true,
        message: 'Payment order created successfully.',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/membership/verify
   */
  public static async verifyPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user.userId || (req as any).user.id;
      const result = await MembershipService.verifyPaymentAndActivate(userId, req.body);

      res.status(200).json({
        success: true,
        message: 'Payment verified and plan activated successfully!',
        data: result,
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
      const userId = (req as any).user.userId || (req as any).user.id;
      const { planId } = req.body;

      const checkoutResult = await MembershipService.initiateCheckout(userId, planId);

      res.status(200).json({
        success: true,
        message: 'Checkout initialized',
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
