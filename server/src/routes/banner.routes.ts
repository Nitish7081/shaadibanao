import { Router, Request, Response, NextFunction } from 'express';
import { BannerService } from '../services/banner.service';

/** PUBLIC: active home-screen banners (promotional images; no personal data). */
export const bannerRouter = Router();

bannerRouter.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const items = await BannerService.listPublic();
    res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    next(error);
  }
});
