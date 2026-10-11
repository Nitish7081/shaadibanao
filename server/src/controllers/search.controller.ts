import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/search.service';
import { ApiResponse } from '@bandhansetu/shared';

export class SearchController {
  public static async searchProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestingUserId = req.user!.userId;
      const results = await SearchService.searchProfiles(requestingUserId, req.query as any);

      const response: ApiResponse = {
        success: true,
        data: results,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}
