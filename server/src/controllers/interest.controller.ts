import { Request, Response, NextFunction } from 'express';
import { InterestService } from '../services/interest.service';
import { ApiResponse } from '@bandhansetu/shared';

export class InterestController {
  public static async sendInterest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const senderId = req.user!.userId;
      const { profileId } = req.params;

      const result = await InterestService.sendInterest(senderId, profileId);

      const response: ApiResponse = {
        success: true,
        message: 'Interest sent successfully',
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async getReceived(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const receiverId = req.user!.userId;
      const items = await InterestService.getReceivedInterests(receiverId);

      const response: ApiResponse = {
        success: true,
        data: items,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async getSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const senderId = req.user!.userId;
      const items = await InterestService.getSentInterests(senderId);

      const response: ApiResponse = {
        success: true,
        data: items,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { interestId } = req.params;
      const { status } = req.body;

      const result = await InterestService.updateInterestStatus(userId, interestId, status);

      const response: ApiResponse = {
        success: true,
        message: `Interest ${status} successfully`,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { interestId } = req.params;

      await InterestService.withdrawInterest(userId, interestId);

      const response: ApiResponse = {
        success: true,
        message: 'Interest withdrawn successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
