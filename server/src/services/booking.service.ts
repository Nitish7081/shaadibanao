import mongoose from 'mongoose';
import crypto from 'crypto';
import { BookingModel, IBooking } from '../models/booking.model';
import { PanditModel } from '../models/pandit.model';
import { UserModel } from '../models/user.model';
import { AuditLogModel } from '../models/audit-log.model';

export interface CreateBookingInput {
  userId: string;
  panditId: string;
  serviceId: string;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: string;    // e.g. "10:00 AM - 01:00 PM"
  mode: 'in_person' | 'online';
  venueAddress?: string;
  kundliSharedConsent?: boolean;
  specialRequests?: string;
}

export class BookingService {
  /**
   * Request a new Puja / Wedding / Consultation booking
   */
  static async createBooking(input: CreateBookingInput) {
    const user = await UserModel.findById(input.userId);
    if (!user) throw new Error('User not found.');

    const pandit = await PanditModel.findById(input.panditId);
    if (!pandit) throw new Error('Pandit not found.');
    if (pandit.verificationStatus !== 'verified') {
      throw new Error('This Pandit profile is currently pending verification and cannot accept bookings.');
    }

    // Find the requested service
    const service = (pandit.services as any[]).find((s: any) => s.serviceId === input.serviceId);
    if (!service) {
      throw new Error('Requested service not offered by this Pandit.');
    }

    // 1. Conflict Prevention: Check if Pandit is already booked in that slot
    const existingConflict = await BookingModel.findOne({
      panditId: pandit._id,
      bookingDate: input.bookingDate,
      timeSlot: input.timeSlot,
      status: { $in: ['accepted', 'requested'] },
    });

    if (existingConflict) {
      throw new Error(
        `Pandit Ji is already booked or has a pending request on ${input.bookingDate} during slot (${input.timeSlot}). Please choose another time slot.`
      );
    }

    // Generate unique booking reference (e.g. SB-2026-7842)
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `SB-${new Date().getFullYear()}-${randomCode}`;

    // For online consultations, assign a secure roomId
    const roomId = input.mode === 'online' ? `room_${crypto.randomBytes(8).toString('hex')}` : undefined;

    const booking = await BookingModel.create({
      bookingReference,
      userId: user._id,
      userName: user.displayName || 'Devotee',
      userMobile: user.mobile,
      panditId: pandit._id,
      panditName: pandit.name,
      serviceId: service.serviceId,
      serviceName: service.name,
      ceremonyType: service.ceremonyType || 'other_puja',
      bookingDate: input.bookingDate,
      timeSlot: input.timeSlot,
      mode: input.mode,
      venueAddress: input.venueAddress,
      priceInr: service.priceInr,
      status: 'requested',
      statusHistory: [
        {
          status: 'requested',
          changedBy: user._id,
          timestamp: new Date(),
        },
      ],
      kundliSharedConsent: !!input.kundliSharedConsent,
      specialRequests: input.specialRequests,
      roomId,
    });

    return booking;
  }

  /**
   * Get user's bookings
   */
  static async getUserBookings(userId: string) {
    return BookingModel.find({ userId })
      .populate('panditId', 'name profilePhoto phone religiousTradition')
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get Pandit's bookings
   */
  static async getPanditBookings(panditUserId: string) {
    const pandit = await PanditModel.findOne({ userId: panditUserId });
    if (!pandit) throw new Error('Pandit account not found.');

    return BookingModel.find({ panditId: pandit._id })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Pandit: Accept booking request
   */
  static async acceptBooking(bookingId: string, panditUserId: string) {
    const pandit = await PanditModel.findOne({ userId: panditUserId });
    if (!pandit) throw new Error('Pandit account not found.');

    const booking = await BookingModel.findOne({
      _id: bookingId,
      panditId: pandit._id,
    });
    if (!booking) throw new Error('Booking not found.');

    if (booking.status !== 'requested') {
      throw new Error(`Cannot accept booking in '${booking.status}' status.`);
    }

    booking.status = 'accepted';
    booking.statusHistory.push({
      status: 'accepted',
      changedBy: pandit.userId,
      timestamp: new Date(),
    });
    await booking.save();

    return booking;
  }

  /**
   * Pandit: Decline booking request
   */
  static async declineBooking(bookingId: string, panditUserId: string, reason?: string) {
    const pandit = await PanditModel.findOne({ userId: panditUserId });
    if (!pandit) throw new Error('Pandit account not found.');

    const booking = await BookingModel.findOne({
      _id: bookingId,
      panditId: pandit._id,
    });
    if (!booking) throw new Error('Booking not found.');

    booking.status = 'declined';
    booking.cancellationReason = reason;
    booking.statusHistory.push({
      status: 'declined',
      changedBy: pandit.userId,
      reason,
      timestamp: new Date(),
    });
    await booking.save();

    return booking;
  }

  /**
   * Cancel booking (User or Pandit)
   */
  static async cancelBooking(bookingId: string, actorUserId: string, reason: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    if (['completed', 'cancelled'].includes(booking.status)) {
      throw new Error(`Booking is already ${booking.status}.`);
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.statusHistory.push({
      status: 'cancelled',
      changedBy: new mongoose.Types.ObjectId(actorUserId),
      reason,
      timestamp: new Date(),
    });
    await booking.save();

    return booking;
  }

  /**
   * Complete booking (Pandit or Admin)
   */
  static async completeBooking(bookingId: string, actorId: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    booking.status = 'completed';
    booking.statusHistory.push({
      status: 'completed',
      changedBy: new mongoose.Types.ObjectId(actorId),
      timestamp: new Date(),
    });
    await booking.save();

    return booking;
  }

  /**
   * Admin: List all bookings
   */
  static async listAdminBookings(page = 1, limit = 20, status = 'all') {
    const skip = (page - 1) * limit;
    const query = status === 'all' ? {} : { status };

    const [items, totalCount] = await Promise.all([
      BookingModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BookingModel.countDocuments(query),
    ]);

    return {
      items: items.map((b: any) => ({
        id: b._id.toString(),
        bookingReference: b.bookingReference,
        userId: b.userId.toString(),
        userName: b.userName,
        userMobile: b.userMobile,
        panditId: b.panditId.toString(),
        panditName: b.panditName,
        serviceName: b.serviceName,
        ceremonyType: b.ceremonyType,
        bookingDate: b.bookingDate,
        timeSlot: b.timeSlot,
        mode: b.mode,
        priceInr: b.priceInr,
        status: b.status,
        venueAddress: b.venueAddress,
        createdAt: b.createdAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }
}
