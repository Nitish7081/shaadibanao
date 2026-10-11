import { Request, Response, NextFunction } from 'express';
import { OtpService } from '../services/otp.service';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '@bandhansetu/shared';

export class AuthController {
  /**
   * POST /api/v1/auth/request-otp
   */
  public static async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mobile } = req.body;
      const result = await OtpService.requestOtp(mobile);

      const response: ApiResponse = {
        success: true,
        message: result.devTestOtpHint || 'Verification OTP sent successfully',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/verify-otp
   */
  public static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mobile, otp } = req.body;
      const result = await AuthService.verifyOtpAndAuthenticate(mobile, otp);

      const response: ApiResponse = {
        success: true,
        message: result.auth
          ? 'Authentication successful'
          : 'OTP verified successfully. Complete registration to continue.',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/register
   */
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await AuthService.register(req.body, ipAddress);

      const response: ApiResponse = {
        success: true,
        message: 'Account registered successfully',
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await AuthService.getCurrentUser(userId);

      const response: ApiResponse = {
        success: true,
        data: { user },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const refreshToken = req.body?.refreshToken;

      if (userId) {
        await AuthService.logout(userId, refreshToken);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Logged out successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
