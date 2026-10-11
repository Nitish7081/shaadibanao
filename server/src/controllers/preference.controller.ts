import { Request, Response, NextFunction } from 'express';
import { PreferenceService } from '../services/preference.service';
import { ApiResponse } from '@bandhansetu/shared';

export class PreferenceController {
  public static async getMyPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const preferences = await PreferenceService.getMyPreferences(userId);

      const response: ApiResponse = {
        success: true,
        data: preferences,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  public static async upsertMyPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const preferences = await PreferenceService.upsertMyPreferences(userId, req.body);

      const response: ApiResponse = {
        success: true,
        message: 'Partner preferences saved successfully',
        data: preferences,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
