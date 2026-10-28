import { Router, Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service';
import { requireAuth } from '../middleware/auth.middleware';
import { requireApproved } from '../middleware/approval.middleware';
import { ApiResponse } from '@bandhansetu/shared';

export const bookingRouter = Router();

bookingRouter.use(requireAuth);

// GET /api/v1/bookings/my (User's booking history)
bookingRouter.get('/my', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const bookings = await BookingService.getUserBookings(userId);

    const response: ApiResponse = {
      success: true,
      data: bookings,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/bookings/pandit (Pandit's received bookings)
bookingRouter.get('/pandit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const bookings = await BookingService.getPanditBookings(userId);

    const response: ApiResponse = {
      success: true,
      data: bookings,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bookings (Create booking request - requires approved account)
bookingRouter.post('/', requireApproved, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const {
      panditId,
      serviceId,
      bookingDate,
      timeSlot,
      mode,
      venueAddress,
      city,
      state,
      guestCount,
      languagePref,
      budgetRangeInr,
      kundliSharedConsent,
      specialRequests,
    } = req.body;

    // serviceId, bookingDate, timeSlot are always required
    if (!serviceId || !bookingDate || !timeSlot) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'serviceId, bookingDate, and timeSlot are required.' },
      });
      return;
    }

    // Sanitize string inputs
    const clean = (v: any) => (typeof v === 'string' ? v.trim().slice(0, 500) : undefined);

    const booking = await BookingService.createBooking({
      userId,
      panditId: panditId || undefined,
      serviceId: String(serviceId).trim(),
      bookingDate: String(bookingDate).trim(),
      timeSlot: String(timeSlot).trim(),
      mode: mode || 'in_person',
      venueAddress: clean(venueAddress),
      city: clean(city),
      state: clean(state),
      guestCount: guestCount ? Number(guestCount) : undefined,
      languagePref: clean(languagePref),
      budgetRangeInr: clean(budgetRangeInr),
      kundliSharedConsent: !!kundliSharedConsent,
      specialRequests: clean(specialRequests),
    });

    const response: ApiResponse = {
      success: true,
      message: 'Booking request sent successfully.',
      data: booking,
    };
    res.status(201).json(response);
  } catch (error: any) {
    next(error);
  }
});

// POST /api/v1/bookings/:id/accept (Pandit accepts)
bookingRouter.post('/:id/accept', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const booking = await BookingService.acceptBooking(req.params.id, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Booking accepted successfully.',
      data: booking,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bookings/:id/decline (Pandit declines)
bookingRouter.post('/:id/decline', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { reason } = req.body;
    const booking = await BookingService.declineBooking(req.params.id, userId, reason);

    const response: ApiResponse = {
      success: true,
      message: 'Booking declined.',
      data: booking,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bookings/:id/cancel (User or Pandit cancels)
bookingRouter.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { reason } = req.body;
    const booking = await BookingService.cancelBooking(req.params.id, userId, reason || 'Cancelled by user');

    const response: ApiResponse = {
      success: true,
      message: 'Booking cancelled.',
      data: booking,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bookings/:id/complete (Pandit completes)
bookingRouter.post('/:id/complete', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const booking = await BookingService.completeBooking(req.params.id, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Booking marked as completed.',
      data: booking,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
