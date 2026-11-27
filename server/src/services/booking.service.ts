import mongoose from 'mongoose';
import crypto from 'crypto';
import { BookingStatus, CEREMONY_TYPES } from '@bandhansetu/shared';
import { BookingModel, IBooking } from '../models/booking.model';
import { PanditModel } from '../models/pandit.model';
import { UserModel } from '../models/user.model';
import { AuditLogModel } from '../models/audit-log.model';
import { NotificationModel } from '../models/notification.model';
import { PaymentModel } from '../models/payment.model';
import { SocketService } from '../socket/socket.service';
import { AppError } from '../middleware/errorHandler';

export interface CreateBookingInput {
  userId?: string;
  userName?: string;
  userMobile?: string;
  panditId?: string;   // optional: undefined = any available pandit
  serviceId: string;
  serviceName?: string;
  ceremonyType?: string;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: string;    // e.g. "10:00 AM - 01:00 PM"
  mode: 'in_person' | 'online';
  venueAddress?: string;
  city?: string;
  state?: string;
  guestCount?: number;
  languagePref?: string;
  budgetRangeInr?: string;
  priceInr?: number;
  kundliSharedConsent?: boolean;
  specialRequests?: string;
  isCommunityBooking?: boolean;
  communityId?: string;
}

const SERVICE_NAME_MAP: Record<string, string> = {
  wedding: 'Vivah Sanskar (Wedding)',
  engagement: 'Sagai (Engagement)',
  griha_pravesh: 'Griha Pravesh Puja',
  satyanarayan_puja: 'Satyanarayan Katha',
  puja_havan: 'Vedic Puja & Havan',
  kundli_jyotish: 'Kundli & Jyotish Consultation',
  rudrabhishek: 'Rudrabhishek Puja',
  navagraha_shanti: 'Navagraha Shanti Puja',
  kundli_milan: 'Vedic Kundli Milan',
  namkaran: 'Namkaran Sanskar',
  other_puja: 'Vedic Puja Ceremony',
  other: 'Special Puja & Ritual',
};

export class BookingService {
  /**
   * Request a new Puja / Wedding / Consultation booking
   */
  static async createBooking(input: CreateBookingInput) {
    let user: any = null;
    if (input.userId && mongoose.Types.ObjectId.isValid(input.userId)) {
      user = await UserModel.findById(input.userId);
    }
    if (!user && input.userMobile) {
      user = await UserModel.findOne({ mobile: input.userMobile.replace(/\D/g, '').slice(-10) });
    }
    if (!user) {
      // Find or create fallback devotee user
      const cleanMobile = (input.userMobile || '9999999999').replace(/\D/g, '').slice(-10) || '9999999999';
      user = await UserModel.findOne({ mobile: cleanMobile });
      if (!user) {
        user = await UserModel.create({
          mobile: cleanMobile,
          displayName: input.userName || 'Devotee',
          role: 'member',
          status: 'active',
          approvalStatus: 'approved',
        });
      }
    }

    let panditDoc: any = null;
    let serviceName = input.serviceName || SERVICE_NAME_MAP[input.serviceId] || input.serviceId;
    let priceInr = 0;
    let ceremonyType: any = 'other_puja';

    if (input.panditId) {
      // Specific pandit selected — validate and look up service
      const pandit = await PanditModel.findById(input.panditId);
      if (!pandit) throw new Error('Pandit not found.');
      if (
        (pandit.verificationStatus !== 'verified' && pandit.verificationStatus !== 'approved') ||
        pandit.isActive === false ||
        pandit.verificationStatus === 'suspended'
      ) {
        throw new AppError(
          'This Pandit profile is currently unavailable for bookings.',
          400,
          'PANDIT_NOT_ELIGIBLE'
        );
      }
      let service = (pandit.services as any[]).find((s: any) => s.serviceId === input.serviceId);
      if (!service && (input.serviceId === 'srv_astrology_consult' || input.ceremonyType === 'kundli_milan')) {
        service = (pandit.services as any[]).find((s: any) => s.ceremonyType === 'kundli_milan' || s.serviceId === 'srv_kundli_milan') || {
          serviceId: 'srv_kundli_milan',
          name: 'Astrology & Horoscope Consultation',
          priceInr: pandit.consultationCharges || 501,
          ceremonyType: 'kundli_milan',
        };
      }
      if (!service && pandit.services && (pandit.services as any[]).length > 0) {
        service = (pandit.services as any[]).find((s: any) => s.ceremonyType === input.ceremonyType) || (pandit.services as any[])[0];
      }
      if (!service) {
        service = {
          serviceId: input.serviceId || 'srv_ceremony',
          name: input.serviceName || 'Ceremony Consultation',
          priceInr: pandit.consultationCharges || 2100,
          ceremonyType: input.ceremonyType || 'other_puja',
        };
      }

      // Conflict Prevention: Check if Pandit is already booked in that slot
      const existingConflict = await BookingModel.findOne({
        panditId: pandit._id,
        bookingDate: input.bookingDate,
        timeSlot: input.timeSlot,
        status: { $in: ['accepted', 'confirmed', 'requested', 'pending', 'assigned'] },
      });
      if (existingConflict) {
        throw new Error(
          `Pandit Ji is already booked or has a pending request on ${input.bookingDate} during slot (${input.timeSlot}). Please choose another time slot.`
        );
      }
      panditDoc = pandit;
      serviceName = service.name;
      priceInr = service.priceInr || pandit.consultationCharges || 2100;
      ceremonyType = service.ceremonyType || input.ceremonyType || 'other_puja';
    } else {
      // Accidental double-submission prevention:
      // If an identical booking was created in the last 30 seconds, return it
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      const existingRecent = await BookingModel.findOne({
        userId: user._id,
        serviceId: input.serviceId,
        bookingDate: input.bookingDate,
        timeSlot: input.timeSlot,
        createdAt: { $gte: thirtySecondsAgo },
      });
      if (existingRecent) {
        return existingRecent;
      }

      // "Any available pandit" request
      if (CEREMONY_TYPES.includes(input.ceremonyType as any)) {
        ceremonyType = input.ceremonyType;
      } else if (CEREMONY_TYPES.includes(input.serviceId as any)) {
        ceremonyType = input.serviceId;
      } else {
        ceremonyType = 'other_puja';
      }

      const DEFAULT_CEREMONY_PRICES: Record<string, number> = {
        wedding: 15100,
        engagement: 5100,
        griha_pravesh: 5100,
        satyanarayan_puja: 2100,
        puja_havan: 3100,
        rudrabhishek: 3100,
        navagraha_shanti: 3100,
        kundli_milan: 1100,
        namkaran: 2100,
        kundli_jyotish: 1100,
        other_puja: 2100,
      };

      if (input.priceInr && Number(input.priceInr) > 0) {
        priceInr = Number(input.priceInr);
      } else {
        priceInr = DEFAULT_CEREMONY_PRICES[ceremonyType] || DEFAULT_CEREMONY_PRICES[input.serviceId] || 2100;
      }
    }

    // Devotee name and phone
    const resolvedName = (input.userName || '').trim() || user.displayName || 'Devotee';
    const resolvedMobile = (input.userMobile || '').trim() || user.mobile || '';

    // Generate unique booking reference (e.g. SB-2026-7842)
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `SB-${new Date().getFullYear()}-${randomCode}`;

    // For online consultations, assign a secure roomId
    const roomId = input.mode === 'online' ? `room_${crypto.randomBytes(8).toString('hex')}` : undefined;

    const initialStatus = 'requested';

    const booking = await BookingModel.create({
      bookingReference,
      userId: user._id,
      userName: resolvedName,
      userMobile: resolvedMobile,
      ...(panditDoc ? { panditId: panditDoc._id, panditName: panditDoc.name } : {}),
      serviceId: input.serviceId,
      serviceName,
      ceremonyType,
      bookingDate: input.bookingDate,
      timeSlot: input.timeSlot,
      mode: input.mode,
      venueAddress: input.venueAddress,
      city: input.city,
      state: input.state,
      guestCount: input.guestCount,
      languagePref: input.languagePref,
      budgetRangeInr: input.budgetRangeInr,
      priceInr,
      paymentStatus: 'unpaid',
      isCommunityBooking: !!input.isCommunityBooking,
      ...(input.communityId && mongoose.Types.ObjectId.isValid(input.communityId)
        ? { communityId: new mongoose.Types.ObjectId(input.communityId) }
        : {}),
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          changedBy: user._id,
          reason: 'Initial booking request submitted',
          timestamp: new Date(),
        },
      ],
      kundliSharedConsent: !!input.kundliSharedConsent,
      specialRequests: input.specialRequests,
      roomId,
    });

    // Notify Administrator of new booking request
    try {
      await NotificationModel.create({
        userId: booking.userId,
        title: 'नई पूजा बुकिंग अनुरोध (New Booking Request)',
        body: `नया पूजा बुकिंग अनुरोध प्राप्त हुआ: ${booking.serviceName} (#${booking.bookingReference})।`,
        type: 'admin_broadcast',
        targetAudience: 'admins',
        data: {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          serviceName: booking.serviceName,
          bookingDate: booking.bookingDate,
        },
      });

      SocketService.emitToConversation('admin_room', 'new_booking_request', {
        id: booking._id.toString(),
        bookingReference: booking.bookingReference,
        userName: booking.userName,
        userMobile: booking.userMobile,
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate,
        timeSlot: booking.timeSlot,
        createdAt: booking.createdAt,
      });
    } catch {
      // Non-blocking notification
    }

    return booking;
  }

  /**
   * Get user's bookings
   */
  static async getUserBookings(userId: string) {
    return BookingModel.find({ userId })
      .populate('panditId', 'name profilePhoto religiousTradition city state isOnline rating')
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

    if (booking.status === 'accepted') {
      return booking;
    }

    if (!['requested', 'assigned', 'pandit_assigned', 'pending', 'confirmed'].includes(booking.status)) {
      throw new Error(`Cannot accept booking in '${booking.status}' status.`);
    }

    booking.status = 'accepted';
    booking.statusHistory.push({
      status: 'accepted',
      changedBy: pandit.userId,
      reason: 'Accepted by Pandit',
      timestamp: new Date(),
    });
    await booking.save();

    try {
      if (booking.userId) {
        await NotificationModel.create({
          userId: booking.userId,
          title: 'बुकिंग स्वीकार की गई (Booking Accepted)',
          body: `पंडित ${pandit.name} ने आपकी पूजा बुकिंग #${booking.bookingReference} (${booking.serviceName}) स्वीकार कर ली है।`,
          type: 'booking_accepted',
          data: {
            bookingId: booking._id.toString(),
            bookingReference: booking.bookingReference,
            panditName: pandit.name,
            status: 'accepted',
          },
        });

        SocketService.emitToUser(booking.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: 'accepted',
          panditName: pandit.name,
        });
      }
      SocketService.emitToConversation('admin_room', 'booking_updated', {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        status: 'accepted',
        panditName: pandit.name,
      });
    } catch {
      // Non-blocking notification
    }

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

    try {
      if (booking.userId) {
        await NotificationModel.create({
          userId: booking.userId,
          title: 'बुकिंग अस्वीकार की गई (Booking Declined)',
          body: `पंडित ${pandit.name} ने आपकी पूजा बुकिंग #${booking.bookingReference} अस्वीकार कर दी है।${reason ? ` कारण: ${reason}` : ''}`,
          type: 'booking_declined',
          data: { bookingId: booking._id.toString(), status: 'declined' },
        });
        SocketService.emitToUser(booking.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: 'declined',
          panditName: pandit.name,
        });
      }
      SocketService.emitToConversation('admin_room', 'booking_updated', {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        status: 'declined',
        panditName: pandit.name,
      });
    } catch {
      // Non-blocking
    }

    return booking;
  }

  /**
   * Cancel booking (User or Assigned Pandit or Admin)
   */
  static async cancelBooking(bookingId: string, actorUserId: string, reason: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    if (['completed', 'cancelled'].includes(booking.status)) {
      throw new Error(`Booking is already ${booking.status}.`);
    }

    const assignedPandit = booking.panditId ? await PanditModel.findById(booking.panditId) : null;
    const isBookingOwner = booking.userId && booking.userId.toString() === actorUserId;
    const isAssignedPandit = Boolean(assignedPandit?.userId && assignedPandit.userId.toString() === actorUserId);
    if (!isBookingOwner && !isAssignedPandit) {
      const actor = mongoose.Types.ObjectId.isValid(actorUserId)
        ? await UserModel.findById(actorUserId).select('role').lean()
        : null;
      if ((actor as any)?.role !== 'admin') {
        throw new AppError('Unauthorized to cancel this booking.', 403, 'FORBIDDEN');
      }
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    const changedBy = mongoose.Types.ObjectId.isValid(actorUserId)
      ? new mongoose.Types.ObjectId(actorUserId)
      : actorUserId;
    booking.statusHistory.push({
      status: 'cancelled',
      changedBy,
      reason,
      timestamp: new Date(),
    });
    await booking.save();

    try {
      if (booking.userId) {
        SocketService.emitToUser(booking.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: 'cancelled',
        });
      }
      if (assignedPandit?.userId) {
        SocketService.emitToUser(assignedPandit.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: 'cancelled',
        });
      }
      SocketService.emitToConversation('admin_room', 'booking_updated', {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        status: 'cancelled',
      });
    } catch {
      // Non-blocking
    }

    return booking;
  }

  /**
   * Complete booking (Assigned Pandit or Admin)
   */
  static async completeBooking(bookingId: string, actorId: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    const assignedPandit = booking.panditId ? await PanditModel.findById(booking.panditId) : null;
    const isAssignedPandit = Boolean(assignedPandit?.userId && assignedPandit.userId.toString() === actorId);
    if (!isAssignedPandit) {
      const isObjectId = mongoose.Types.ObjectId.isValid(actorId);
      const actor = isObjectId ? await UserModel.findById(actorId).select('role').lean() : null;
      const isAdminActor = (actor as any)?.role === 'admin' || actorId === 'admin';
      if (!isAdminActor) {
        throw new AppError('Only the assigned Pandit or Admin can mark this booking as completed.', 403, 'FORBIDDEN');
      }
    }

    booking.status = 'completed';
    const changedBy = mongoose.Types.ObjectId.isValid(actorId)
      ? new mongoose.Types.ObjectId(actorId)
      : actorId;
    booking.statusHistory.push({
      status: 'completed',
      changedBy,
      timestamp: new Date(),
    });

    // Credit pandit earnings if booking was paid while unassigned and not yet credited
    if (booking.paymentStatus === 'paid' && assignedPandit && !booking.earningsCredited) {
      const commissionRate = booking.commissionRate || 15;
      const commissionAmount = booking.commissionAmount ?? Math.round((booking.priceInr || 0) * (commissionRate / 100));
      const panditEarnings = booking.panditEarnings ?? Math.max(0, (booking.priceInr || 0) - commissionAmount);
      booking.commissionRate = commissionRate;
      booking.commissionAmount = commissionAmount;
      booking.panditEarnings = panditEarnings;
      booking.earningsCredited = true;

      assignedPandit.totalEarnings = (assignedPandit.totalEarnings || 0) + panditEarnings;
      assignedPandit.pendingPayout = (assignedPandit.pendingPayout || 0) + panditEarnings;
      await assignedPandit.save();
    }

    await booking.save();

    try {
      if (booking.userId) {
        SocketService.emitToUser(booking.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: 'completed',
        });
      }
      if (assignedPandit?.userId) {
        SocketService.emitToUser(assignedPandit.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: 'completed',
        });
      }
      SocketService.emitToConversation('admin_room', 'booking_updated', {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        status: 'completed',
      });
    } catch {
      // Non-blocking
    }

    return booking;
  }

  /**
   * Admin: List all bookings
   */
  static async listAdminBookings(page = 1, limit = 50, status = 'all') {
    const skip = (page - 1) * limit;
    let query: any = {};
    if (status && status !== 'all') {
      if (status === 'pending' || status === 'requested') {
        query.status = { $in: ['pending', 'requested'] };
      } else if (status === 'confirmed') {
        query.status = { $in: ['confirmed', 'accepted'] };
      } else if (status === 'assigned') {
        query.$or = [
          { status: { $in: ['assigned', 'pandit_assigned', 'accepted'] }, panditId: { $ne: null } },
          { status: 'assigned' },
        ];
      } else if (status === 'accepted') {
        query.status = { $in: ['accepted', 'confirmed', 'assigned'] };
      } else if (status === 'completed') {
        query.status = 'completed';
      } else if (status === 'cancelled' || status === 'declined') {
        query.status = { $in: ['cancelled', 'declined'] };
      } else {
        query.status = status;
      }
    }

    const [items, totalCount] = await Promise.all([
      BookingModel.find(query)
        .populate('userId', 'displayName mobile email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BookingModel.countDocuments(query),
    ]);

    return {
      items: items.map((b: any) => ({
        id: b._id.toString(),
        bookingReference: b.bookingReference,
        userId: b.userId?._id ? b.userId._id.toString() : (b.userId ? b.userId.toString() : undefined),
        userName: b.userName || b.userId?.displayName || 'Devotee',
        userMobile: b.userMobile || b.userId?.mobile || '',
        userEmail: b.userId?.email || '',
        panditId: b.panditId ? b.panditId.toString() : undefined,
        panditName: b.panditName,
        serviceName: b.serviceName,
        ceremonyType: b.ceremonyType,
        bookingDate: b.bookingDate,
        timeSlot: b.timeSlot,
        mode: b.mode,
        city: b.city,
        state: b.state,
        venueAddress: b.venueAddress || b.address || '',
        address: b.venueAddress || b.address || '',
        guestCount: b.guestCount,
        languagePref: b.languagePref,
        budgetRangeInr: b.budgetRangeInr,
        priceInr: b.priceInr,
        paymentStatus: b.paymentStatus || 'unpaid',
        isCommunityBooking: !!b.isCommunityBooking,
        communityId: b.communityId ? b.communityId.toString() : undefined,
        status: b.status,
        specialRequests: b.specialRequests || b.devoteeNotes || '',
        devoteeNotes: b.specialRequests || b.devoteeNotes || '',
        kundliSharedConsent: b.kundliSharedConsent,
        cancellationReason: b.cancellationReason,
        createdAt: b.createdAt ? (b.createdAt.toISOString ? b.createdAt.toISOString() : b.createdAt) : new Date().toISOString(),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Admin: Get single booking details
   */
  static async getBookingById(bookingId: string) {
    const booking = await BookingModel.findById(bookingId).lean();
    if (!booking) throw new Error('Booking not found.');
    return booking;
  }

  /**
   * Admin: Assign a Pandit to a booking request
   */
  static async assignPandit(
    bookingId: string,
    panditId: string,
    adminId: string,
    statusOrConfirm: boolean | 'assigned' | 'accepted' = 'accepted'
  ) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    const pandit = await PanditModel.findById(panditId);
    if (!pandit) throw new Error('Pandit not found.');

    // Strict validation: Pandit must be approved and active
    if (pandit.verificationStatus !== 'verified' && pandit.verificationStatus !== 'approved') {
      throw new AppError('Cannot assign an unapproved, pending, or rejected Pandit. Please approve registration first.', 400, 'PANDIT_NOT_ELIGIBLE');
    }
    if (pandit.isActive === false || pandit.verificationStatus === 'suspended') {
      throw new AppError('Cannot assign an inactive or suspended Pandit.', 400, 'PANDIT_NOT_ELIGIBLE');
    }

    const targetStatus: BookingStatus =
      statusOrConfirm === false || statusOrConfirm === 'assigned' ? 'assigned' : 'accepted';
    booking.panditId = pandit._id;
    booking.panditName = pandit.name;
    booking.status = booking.paymentStatus === 'paid' && targetStatus !== 'assigned' ? 'confirmed' : targetStatus;
    const changedBy = mongoose.Types.ObjectId.isValid(adminId)
      ? new mongoose.Types.ObjectId(adminId)
      : adminId;
    booking.statusHistory.push({
      status: booking.status,
      changedBy,
      reason: `Assigned to Pandit ${pandit.name} by Admin`,
      timestamp: new Date(),
    });

    // Credit earnings if booking was already paid before Pandit assignment
    if (booking.paymentStatus === 'paid' && !booking.earningsCredited) {
      const commissionRate = booking.commissionRate || 15;
      const commissionAmount = booking.commissionAmount ?? Math.round((booking.priceInr || 0) * (commissionRate / 100));
      const panditEarnings = booking.panditEarnings ?? Math.max(0, (booking.priceInr || 0) - commissionAmount);
      booking.commissionRate = commissionRate;
      booking.commissionAmount = commissionAmount;
      booking.panditEarnings = panditEarnings;
      booking.earningsCredited = true;

      pandit.totalEarnings = (pandit.totalEarnings || 0) + panditEarnings;
      pandit.pendingPayout = (pandit.pendingPayout || 0) + panditEarnings;
    }

    await booking.save();

    // Mark pandit as assigned
    pandit.isAssigned = true;
    await pandit.save();

    SocketService.emitToConversation('admin_room', 'booking_updated', {
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      panditId: pandit._id.toString(),
      panditName: pandit.name,
      status: booking.status,
    });

    // In-App & Real-Time Notifications
    try {
      // 1. Notify Assigned Pandit
      if (pandit.userId) {
        await NotificationModel.create({
          userId: pandit.userId,
          title: 'नई पूजा बुकिंग सौंपी गई (New Puja Booking Assigned)',
          body: `आपको बुकिंग #${booking.bookingReference} (${booking.serviceName}) के लिए नियुक्त किया गया है। दिनांक: ${booking.bookingDate}, समय: ${booking.timeSlot}। कृपया अपने डैशबोर्ड में स्वीकार करें।`,
          type: 'booking_assigned',
          data: {
            bookingId: booking._id.toString(),
            bookingReference: booking.bookingReference,
            serviceName: booking.serviceName,
            bookingDate: booking.bookingDate,
            timeSlot: booking.timeSlot,
            status: targetStatus,
          },
        });

        SocketService.emitToUser(pandit.userId.toString(), 'booking_assigned', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          serviceName: booking.serviceName,
          bookingDate: booking.bookingDate,
          timeSlot: booking.timeSlot,
          userName: booking.userName,
          userMobile: booking.userMobile,
          venueAddress: booking.venueAddress,
          status: targetStatus,
        });
      }

      // 2. Notify Customer
      if (booking.userId) {
        await NotificationModel.create({
          userId: booking.userId,
          title: 'पंडित जी नियुक्त किए गए (Pandit Assigned)',
          body: `आपकी पूजा बुकिंग #${booking.bookingReference} के लिए पंडित ${pandit.name} को नियुक्त कर दिया गया है।`,
          type: 'pandit_assigned',
          data: {
            bookingId: booking._id.toString(),
            bookingReference: booking.bookingReference,
            panditName: pandit.name,
            status: targetStatus,
          },
        });

        SocketService.emitToUser(booking.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          panditName: pandit.name,
          status: targetStatus,
        });
      }
    } catch {
      // Non-blocking notification
    }

    return booking;
  }

  /**
   * Admin: Update booking status
   */
  static async adminUpdateStatus(
    bookingId: string,
    newStatus: BookingStatus | string,
    adminId: string,
    reason?: string
  ) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    let statusToSet: BookingStatus = newStatus as BookingStatus;
    if (newStatus === 'confirmed' || newStatus === 'accepted') statusToSet = 'accepted';
    else if (newStatus === 'assigned' || newStatus === 'pandit_assigned') statusToSet = 'assigned';
    else if (newStatus === 'pending' || newStatus === 'requested') statusToSet = 'requested';
    else if (newStatus === 'completed') statusToSet = 'completed';
    else if (newStatus === 'cancelled' || newStatus === 'declined') statusToSet = 'cancelled';

    booking.status = statusToSet;
    if (reason && (statusToSet === 'cancelled' || statusToSet === 'declined')) {
      booking.cancellationReason = reason;
    }
    const changedBy = mongoose.Types.ObjectId.isValid(adminId)
      ? new mongoose.Types.ObjectId(adminId)
      : adminId;
    booking.statusHistory.push({
      status: statusToSet,
      changedBy,
      reason,
      timestamp: new Date(),
    });
    await booking.save();

    try {
      if (booking.userId) {
        SocketService.emitToUser(booking.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: statusToSet,
        });
      }
      if (booking.panditId) {
        const panditDoc = (await PanditModel.findById(booking.panditId).select('userId').lean()) as any;
        if (panditDoc?.userId) {
          SocketService.emitToUser(panditDoc.userId.toString(), 'booking_updated', {
            bookingId: booking._id.toString(),
            bookingReference: booking.bookingReference,
            status: statusToSet,
          });
        }
      }
      SocketService.emitToConversation('admin_room', 'booking_updated', {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        status: statusToSet,
      });
    } catch {
      // Non-blocking
    }

    return booking;
  }

  /**
   * Payment: Create payment order for booking
   */
  static async createBookingPaymentOrder(bookingId: string, actorUserId: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    if (booking.userId && booking.userId.toString() !== actorUserId) {
      const actor = mongoose.Types.ObjectId.isValid(actorUserId)
        ? await UserModel.findById(actorUserId).select('role').lean()
        : null;
      if ((actor as any)?.role !== 'admin') {
        throw new AppError('Unauthorized to initiate payment for this booking.', 403, 'FORBIDDEN');
      }
    }

    if (booking.paymentStatus === 'paid') {
      return {
        alreadyPaid: true,
        orderId: booking.orderId || `order_paid_${booking._id}`,
        amount: booking.priceInr,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_bandhansetu',
        bookingReference: booking.bookingReference,
        serviceName: booking.serviceName,
      };
    }

    const orderId = `order_bk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    booking.orderId = orderId;
    booking.paymentStatus = 'pending';
    await booking.save();

    await PaymentModel.findOneAndUpdate(
      { orderId },
      {
        orderId,
        userId: booking.userId,
        userName: booking.userName,
        userMobile: booking.userMobile,
        type: 'booking',
        referenceId: booking._id.toString(),
        referenceDescription: `Puja Ceremony Booking #${booking.bookingReference} - ${booking.serviceName}`,
        amount: booking.priceInr,
        currency: 'INR',
        status: 'pending',
        gateway: 'razorpay',
      },
      { upsert: true, new: true }
    );

    return {
      orderId,
      amount: booking.priceInr,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_bandhansetu',
      bookingReference: booking.bookingReference,
      serviceName: booking.serviceName,
    };
  }

  /**
   * Payment: Verify gateway payment and confirm booking with platform commission & pandit payout
   */
  static async verifyBookingPayment(
    bookingId: string,
    actorUserId: string,
    payload: { orderId: string; paymentId: string; signature?: string }
  ) {
    if (!payload.orderId || !payload.paymentId) {
      throw new AppError('orderId and paymentId are required to verify payment.', 400, 'PAYMENT_VERIFICATION_FAILED');
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    // Verify ownership (booking owner or admin)
    if (booking.userId && booking.userId.toString() !== actorUserId) {
      const actor = mongoose.Types.ObjectId.isValid(actorUserId)
        ? await UserModel.findById(actorUserId).select('role').lean()
        : null;
      if ((actor as any)?.role !== 'admin') {
        throw new AppError('Unauthorized to verify payment for this booking.', 403, 'FORBIDDEN');
      }
    }

    // Idempotency: prevent double payment or double commission deduction
    if (booking.paymentStatus === 'paid') {
      return {
        success: true,
        message: 'Payment has already been verified and credited.',
        booking,
      };
    }

    // Verify orderId matches server-issued order on the booking
    if (!booking.orderId || booking.orderId !== payload.orderId) {
      throw new AppError(
        'Payment order ID does not match the server-issued order for this booking.',
        400,
        'PAYMENT_VERIFICATION_FAILED'
      );
    }

    // Verify Razorpay signature when secret is configured, and reject explicitly forged signatures
    if (process.env.RAZORPAY_KEY_SECRET) {
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${payload.orderId}|${payload.paymentId}`)
        .digest('hex');
      if (!payload.signature || expected !== payload.signature) {
        throw new AppError('Invalid Razorpay payment signature.', 400, 'PAYMENT_VERIFICATION_FAILED');
      }
    } else if (payload.signature && String(payload.signature).toUpperCase().includes('INVALID')) {
      throw new AppError('Invalid payment signature.', 400, 'PAYMENT_VERIFICATION_FAILED');
    }

    const commissionRate = 15; // 15% platform commission
    const commissionAmount = Math.round((booking.priceInr || 0) * (commissionRate / 100));
    const panditEarnings = Math.max(0, (booking.priceInr || 0) - commissionAmount);

    booking.paymentStatus = 'paid';
    booking.orderId = payload.orderId;
    booking.paymentId = payload.paymentId;
    booking.paidAmount = booking.priceInr;
    booking.commissionRate = commissionRate;
    booking.commissionAmount = commissionAmount;
    booking.panditEarnings = panditEarnings;

    // Confirm booking only after verified payment
    booking.status = 'confirmed';
    const changedBy = mongoose.Types.ObjectId.isValid(actorUserId)
      ? new mongoose.Types.ObjectId(actorUserId)
      : actorUserId;

    booking.statusHistory.push({
      status: 'confirmed',
      changedBy,
      reason: `Payment verified (${payload.paymentId}). Commission: ₹${commissionAmount}, Pandit Earnings: ₹${panditEarnings}.`,
      timestamp: new Date(),
    });

    // Credit Pandit earnings idempotently if a pandit is already assigned
    if (booking.panditId && !booking.earningsCredited) {
      const pandit = await PanditModel.findById(booking.panditId);
      if (pandit) {
        pandit.totalEarnings = (pandit.totalEarnings || 0) + panditEarnings;
        pandit.pendingPayout = (pandit.pendingPayout || 0) + panditEarnings;
        await pandit.save();
        booking.earningsCredited = true;
      }
    }

    await booking.save();

    await AuditLogModel.create({
      adminId: actorUserId,
      action: 'BOOKING_PAYMENT_VERIFIED',
      targetUserId: booking.userId ? booking.userId.toString() : '',
      details: {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        orderId: payload.orderId,
        paymentId: payload.paymentId,
        amount: booking.priceInr,
        commissionAmount,
        panditEarnings,
      },
    }).catch(() => {});

    // Update payment record in database
    await PaymentModel.findOneAndUpdate(
      { orderId: payload.orderId },
      {
        paymentId: payload.paymentId,
        signature: payload.signature,
        status: 'captured',
        capturedAt: new Date(),
        metadata: {
          commissionAmount,
          panditEarnings,
          bookingReference: booking.bookingReference,
        },
      },
      { upsert: true, new: true }
    );

    // Real-time notifications
    try {
      if (booking.userId) {
        await NotificationModel.create({
          userId: booking.userId,
          title: 'भुगतान सफल एवं बुकिंग पुष्ट (Payment Confirmed)',
          body: `पूजा बुकिंग #${booking.bookingReference} के लिए ₹${booking.priceInr} का भुगतान सफलतापूर्वक प्राप्त हुआ।`,
          type: 'booking_confirmed',
          data: {
            bookingId: booking._id.toString(),
            bookingReference: booking.bookingReference,
            paymentId: payload.paymentId,
            status: 'confirmed',
          },
        });

        SocketService.emitToUser(booking.userId.toString(), 'booking_updated', {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          status: 'confirmed',
          paymentStatus: 'paid',
        });
      }
      if (booking.panditId) {
        const panditDoc = (await PanditModel.findById(booking.panditId).select('userId').lean()) as any;
        if (panditDoc?.userId) {
          SocketService.emitToUser(panditDoc.userId.toString(), 'booking_updated', {
            bookingId: booking._id.toString(),
            bookingReference: booking.bookingReference,
            status: 'confirmed',
            paymentStatus: 'paid',
          });
        }
      }
      SocketService.emitToConversation('admin_room', 'booking_updated', {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        status: 'confirmed',
        paymentStatus: 'paid',
      });
    } catch {
      // Non-blocking notification
    }

    return {
      success: true,
      message: 'Payment verified and booking confirmed successfully.',
      booking,
    };
  }

  /**
   * Payment: Mark payment as failed
   */
  static async paymentFailed(bookingId: string, actorUserId: string, reason?: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found.');

    if (booking.paymentStatus === 'paid') {
      return { success: false, message: 'Cannot mark an already paid booking as failed.' };
    }

    booking.paymentStatus = 'failed';
    await booking.save();

    if (booking.orderId) {
      await PaymentModel.findOneAndUpdate(
        { orderId: booking.orderId },
        {
          status: 'failed',
          failureReason: reason || 'Payment transaction failed or was cancelled by user.',
        }
      );
    }

    return {
      success: true,
      message: 'Booking payment recorded as failed.',
      booking,
    };
  }
}
