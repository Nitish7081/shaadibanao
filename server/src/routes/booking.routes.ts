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
    const { panditId, serviceId, bookingDate, timeSlot, mode, venueAddress, kundliSharedConsent, specialRequests } = req.body;

    if (!panditId || !serviceId || !bookingDate || !timeSlot) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'panditId, serviceId, bookingDate, and timeSlot are required.' },
      });
      return;
    }

    const booking = await BookingService.createBooking({
      userId,
      panditId,
      serviceId,
      bookingDate,
      timeSlot,
      mode: mode || 'in_person',
      venueAddress,
      kundliSharedConsent: !!kundliSharedConsent,
      specialRequests,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Booking request sent successfully to Pandit Ji.',
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
