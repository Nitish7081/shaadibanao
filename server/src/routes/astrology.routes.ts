import { Router, Request, Response, NextFunction } from 'express';
import { AstrologyService } from '../services/astrology.service';
import { PanditService } from '../services/pandit.service';
import { BookingService } from '../services/booking.service';
import { requireAuth } from '../middleware/auth.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const astrologyRouter = Router();

// GET /api/v1/astrology/astrologers (Browse approved astrologers)
astrologyRouter.get('/astrologers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await PanditService.listApprovedAstrologers(req.query);
    const response: ApiResponse = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/astrology/consultations (Book an astrology consultation)
astrologyRouter.post('/consultations', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const astrologerId = req.body.astrologerId || req.body.panditId;
    const { bookingDate, timeSlot, specialRequests, kundliSharedConsent, mode } = req.body;

    if (!astrologerId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'astrologerId is required to book a consultation.' },
      });
      return;
    }

    const astrologer = await PanditService.getPanditById(astrologerId);
    if (!astrologer) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Selected astrologer profile not found.' },
      });
      return;
    }

    if (astrologer.verificationStatus !== 'approved' && astrologer.verificationStatus !== 'verified') {
      res.status(400).json({
        success: false,
        error: { code: 'ASTROLOGER_NOT_APPROVED', message: 'Selected astrologer is not currently approved for consultations.' },
      });
      return;
    }

    const booking = await BookingService.createBooking({
      userId,
      panditId: astrologer._id.toString(),
      serviceId: 'srv_astrology_consult',
      serviceName: 'Astrology & Horoscope Consultation',
      ceremonyType: 'kundli_milan',
      bookingDate: bookingDate || new Date().toISOString().split('T')[0],
      timeSlot: timeSlot || '11:00 AM - 12:00 PM',
      mode: mode || 'online',
      specialRequests: specialRequests || 'Vedic Astrology Consultation',
      kundliSharedConsent: kundliSharedConsent !== undefined ? Boolean(kundliSharedConsent) : true,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Astrology consultation booked successfully.',
      data: booking,
    };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/astrology/kundli/me
astrologyRouter.get('/kundli/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
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
    const userId = (req as any).user.id || (req as any).user.userId;
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
