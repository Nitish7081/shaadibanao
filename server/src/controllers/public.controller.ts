import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@bandhansetu/shared';
import { PublicService } from '../services/public.service';
import { AccountDeletionService } from '../services/account-deletion.service';

export class PublicController {
  /**
   * GET /api/v1/public/privacy-policy
   */
  public static getPrivacyPolicy(req: Request, res: Response, next: NextFunction): void {
    try {
      const policy = PublicService.getPrivacyPolicy();
      res.setHeader('Cache-Control', 'public, max-age=300');
      const response: ApiResponse = {
        success: true,
        data: policy,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/public/terms
   */
  public static getTerms(req: Request, res: Response, next: NextFunction): void {
    try {
      const terms = PublicService.getTermsAndConditions();
      res.setHeader('Cache-Control', 'public, max-age=300');
      const response: ApiResponse = {
        success: true,
        data: terms,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/public/account-deletion/request-otp
   */
  public static async requestDeletionOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await AccountDeletionService.requestVerificationChallenge(req.body);
      const response: ApiResponse = {
        success: true,
        message: result.devTestOtpHint || 'Verification code issued.',
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/public/account-deletion
   */
  public static async submitAccountDeletion(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : undefined;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await AccountDeletionService.submitVerifiedDeletion(
        req.body,
        bearerToken,
        ipAddress
      );

      const response: ApiResponse = {
        success: true,
        message: result.message,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/public/account-deletion/:requestId
   */
  public static async getAccountDeletionStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { requestId } = req.params;
      const result = await AccountDeletionService.getDeletionRequestStatus(requestId);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/public/contact
   */
  public static async submitContact(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await PublicService.submitContactInquiry(req.body, ipAddress);
      const response: ApiResponse = {
        success: true,
        message: result.message,
        data: result,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
}
