import mongoose, { Schema, Document } from 'mongoose';
import { BOOKING_STATUS, BookingStatus, CEREMONY_TYPES, CeremonyType } from '@bandhansetu/shared';

export interface IBookingStatusChange {
  status: BookingStatus;
  changedBy: mongoose.Types.ObjectId | string;
  reason?: string;
  timestamp: Date;
}

export interface IBooking extends Document {
  bookingReference: string; // e.g. "SB-2026-9281"
  userId: mongoose.Types.ObjectId;
  userName?: string;
  userMobile?: string;
  panditId: mongoose.Types.ObjectId;
  panditName?: string;
  serviceId: string;
  serviceName: string;
  ceremonyType: CeremonyType;
  bookingDate: string; // YYYY-MM-DD
  timeSlot: string;    // "10:00 AM - 01:00 PM"
  mode: 'in_person' | 'online';
  venueAddress?: string;
  priceInr: number;
  status: BookingStatus;
  statusHistory: IBookingStatusChange[];
  cancellationReason?: string;
  kundliSharedConsent: boolean;
  specialRequests?: string;
  roomId?: string; // For online video consultation
  rating?: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StatusChangeSchema = new Schema<IBookingStatusChange>(
  {
    status: { type: String, enum: BOOKING_STATUS, required: true },
    changedBy: { type: Schema.Types.Mixed, required: true },
    reason: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const BookingSchema = new Schema<IBooking>(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: { type: String, trim: true },
    userMobile: { type: String, trim: true },
    panditId: {
      type: Schema.Types.ObjectId,
      ref: 'Pandit',
      required: true,
      index: true,
    },
    panditName: { type: String, trim: true },
    serviceId: { type: String, required: true },
    serviceName: { type: String, required: true, trim: true },
    ceremonyType: {
      type: String,
      enum: CEREMONY_TYPES,
      default: 'other_puja',
    },
    bookingDate: { type: String, required: true, index: true },
    timeSlot: { type: String, required: true },
    mode: {
      type: String,
      enum: ['in_person', 'online'],
      default: 'in_person',
    },
    venueAddress: { type: String, trim: true },
    priceInr: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: BOOKING_STATUS,
      default: 'requested',
      index: true,
    },
    statusHistory: { type: [StatusChangeSchema], default: [] },
    cancellationReason: { type: String, trim: true },
    kundliSharedConsent: { type: Boolean, default: false },
    specialRequests: { type: String, trim: true },
    roomId: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

// Compound index for double-booking conflict detection
BookingSchema.index({ panditId: 1, bookingDate: 1, timeSlot: 1 });

export const BookingModel =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
