import { Request, Response, NextFunction } from 'express';
import { ShortlistService } from '../services/shortlist.service';
import { ApiResponse } from '@bandhansetu/shared';

export class ShortlistController {
  public static async addShortlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { profileId } = req.params;

      await ShortlistService.addShortlist(userId, profileId);

      const response: ApiResponse = {
        success: true,
        message: 'Profile added to shortlist',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async removeShortlist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { profileId } = req.params;

      await ShortlistService.removeShortlist(userId, profileId);

      const response: ApiResponse = {
        success: true,
        message: 'Profile removed from shortlist',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async getShortlists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const items = await ShortlistService.getShortlists(userId);

      const response: ApiResponse = {
        success: true,
        data: items,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
