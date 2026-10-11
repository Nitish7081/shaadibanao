import { Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services/profile.service';
import { ApiResponse } from '@bandhansetu/shared';

export class ProfileController {
  public static async getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profile = await ProfileService.getMyProfile(userId);

      const response: ApiResponse = {
        success: true,
        data: profile,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async upsertMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const profile = await ProfileService.upsertMyProfile(userId, req.body);

      const response: ApiResponse = {
        success: true,
        message: 'Profile saved successfully',
        data: profile,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async getPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { profileId } = req.params;
      const publicProfile = await ProfileService.getPublicProfile(profileId);

      const response: ApiResponse = {
        success: true,
        data: publicProfile,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
