import { Router, Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service';
import { requireAuth } from '../middleware/auth.middleware';
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

// POST /api/v1/bookings or /request (Create booking request - accessible to all logged-in devotees)
bookingRouter.post(['/', '/request'], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const {
      userName,
      userMobile,
      serviceName,
      ceremonyType,
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
      priceInr,
      isCommunityBooking,
      communityId,
      kundliSharedConsent,
      specialRequests,
    } = req.body;

    // serviceId or ceremonyType, bookingDate, timeSlot are always required
    const finalServiceId = serviceId || ceremonyType || 'other_puja';
    if (!finalServiceId || !bookingDate || !timeSlot) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'serviceId/ceremonyType, bookingDate, and timeSlot are required.' },
      });
      return;
    }

    // Sanitize string inputs
    const clean = (v: any) => (typeof v === 'string' ? v.trim().slice(0, 500) : undefined);

    const booking = await BookingService.createBooking({
      userId,
      userName: clean(userName),
      userMobile: clean(userMobile),
      panditId: panditId || undefined,
      serviceId: String(finalServiceId).trim(),
      serviceName: clean(serviceName),
      ceremonyType: clean(ceremonyType),
      bookingDate: String(bookingDate).trim(),
      timeSlot: String(timeSlot).trim(),
      mode: mode || 'in_person',
      venueAddress: clean(venueAddress),
      city: clean(city),
      state: clean(state),
      guestCount: guestCount ? Number(guestCount) : undefined,
      languagePref: clean(languagePref),
      budgetRangeInr: clean(budgetRangeInr),
      priceInr: priceInr !== undefined && priceInr !== null ? Number(priceInr) : undefined,
      isCommunityBooking: !!isCommunityBooking,
      communityId: communityId ? String(communityId) : undefined,
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

// POST /api/v1/bookings/:id/payment/order (Create order for Razorpay/gateway)
bookingRouter.post(['/:id/payment/order', '/:id/create-order'], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const order = await BookingService.createBookingPaymentOrder(req.params.id, userId);

    const response: ApiResponse = {
      success: true,
      message: 'Payment order created successfully.',
      data: order,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bookings/:id/payment/verify (Verify gateway signature & confirm booking)
bookingRouter.post(['/:id/payment/verify', '/:id/verify-payment'], async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const result = await BookingService.verifyBookingPayment(req.params.id, userId, req.body);

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: result.booking,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/bookings/:id/payment/failed (Record payment failure)
bookingRouter.post('/:id/payment/failed', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id || (req as any).user.userId;
    const result = await BookingService.paymentFailed(req.params.id, userId, req.body?.reason);

    const response: ApiResponse = {
      success: true,
      message: result.message,
      data: result.booking,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
