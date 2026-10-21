import { Router, Request, Response, NextFunction } from 'express';
import { AstrologyService } from '../services/astrology.service';
import { requireAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const astrologyRouter = Router();

// GET /api/v1/astrology/kundli/me
astrologyRouter.get('/kundli/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const kundli = await AstrologyService.getMyKundli(userId);

    const response: ApiResponse = {
      success: true,
      data: kundli,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/astrology/kundli/me
astrologyRouter.put('/kundli/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { dateOfBirth, timeOfBirth, birthPlace, rashi, nakshatra } = req.body;

    if (!dateOfBirth || !timeOfBirth || !birthPlace?.name || !rashi || !nakshatra) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'dateOfBirth, timeOfBirth, birthPlace.name, rashi, and nakshatra are required.' },
      });
      return;
    }

    const updated = await AstrologyService.upsertKundli(userId, req.body);
    const response: ApiResponse = {
      success: true,
      message: 'Kundli profile saved successfully.',
      data: updated,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/astrology/match
astrologyRouter.post('/match', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { boyRashi, boyNakshatra, girlRashi, girlNakshatra, boyManglik, girlManglik } = req.body;

    if (!boyRashi || !boyNakshatra || !girlRashi || !girlNakshatra) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'boyRashi, boyNakshatra, girlRashi, and girlNakshatra are required.' },
      });
      return;
    }

    const result = AstrologyService.calculateAshtaKoota(
      boyRashi,
      boyNakshatra,
      girlRashi,
      girlNakshatra,
      !!boyManglik,
      !!girlManglik
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
