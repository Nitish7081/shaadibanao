import { Router, Request, Response, NextFunction } from 'express';
import { PanditService } from '../services/pandit.service';
import { requireAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const panditRouter = Router();

// GET /api/v1/pandits (Public/Member: List verified pandits)
panditRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ceremonyType, location, page, limit } = req.query;
    const result = await PanditService.listVerifiedPandits({
      ceremonyType: ceremonyType as string,
      location: location as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 12,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/me (Pandit Owner View)
panditRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pandit = await PanditService.getPanditByUserId(userId);

    const response: ApiResponse = {
      success: true,
      data: pandit,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/dashboard (Pandit Dashboard)
panditRouter.get('/dashboard', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const dashboard = await PanditService.getPanditDashboard(userId);

    const response: ApiResponse = {
      success: true,
      data: dashboard,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/pandits/:id (Public view of single Pandit)
panditRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pandit = await PanditService.getPanditById(req.params.id);

    const response: ApiResponse = {
      success: true,
      data: pandit,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/pandits/register (User registers as Pandit)
panditRouter.post('/register', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const pandit = await PanditService.registerPandit(userId, req.body);

    const response: ApiResponse = {
      success: true,
      message: 'Pandit registration submitted for administrative review.',
      data: pandit,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/pandits/profile (Pandit updates profile)
panditRouter.put('/profile', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const updated = await PanditService.updatePanditProfile(userId, req.body);

    const response: ApiResponse = {
      success: true,
      message: 'Pandit profile updated successfully.',
      data: updated,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
