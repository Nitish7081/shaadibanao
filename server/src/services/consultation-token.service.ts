import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { BookingModel } from '../models/booking.model';
import { PanditModel } from '../models/pandit.model';
import { config } from '../config/env';

export interface ConsultationTokenResult {
  roomId: string;
  bookingId: string;
  token: string;
  userId: string;
  role: 'host' | 'client';
  expiresInSeconds: number;
  serverUrl?: string;
}

export class ConsultationTokenService {
  /**
   * Authorize and generate a secure WebRTC consultation room token for an approved booking
   */
  static async generateRoomToken(bookingId: string, requestUserId: string): Promise<ConsultationTokenResult> {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking consultation not found.');

    if (booking.mode !== 'online') {
      throw new Error('This booking is scheduled for in-person attendance, not online video consultation.');
    }

    if (['cancelled', 'declined'].includes(booking.status)) {
      throw new Error(`Cannot join consultation for a ${booking.status} booking.`);
    }

    const pandit = await PanditModel.findById(booking.panditId);
    if (!pandit) throw new Error('Pandit record not found.');

    // Determine authorization and role
    const isClient = booking.userId.toString() === requestUserId;
    const isHost = pandit.userId.toString() === requestUserId;

    if (!isClient && !isHost) {
      throw new Error('Access denied: You are not a participant in this consultation.');
    }

    const role: 'host' | 'client' = isHost ? 'host' : 'client';
    const roomId = booking.roomId || `room_${booking._id.toString()}`;

    // Ensure roomId is persisted on booking
    if (!booking.roomId) {
      booking.roomId = roomId;
      await booking.save();
    }

    // Token payload signed with server secret
    const expiresInSeconds = 3600; // 1 hour
    const payload = {
      roomId,
      bookingId: booking._id.toString(),
      userId: requestUserId,
      role,
      issuedAt: Date.now(),
    };

    const token = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: '1h',
    });

    return {
      roomId,
      bookingId: booking._id.toString(),
      token,
      userId: requestUserId,
      role,
      expiresInSeconds,
    };
  }

  /**
   * Verify room token for Socket.IO WebRTC signaling
   */
  static verifyRoomToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as any;
      return decoded;
    } catch {
      return null;
    }
  }
}
