import mongoose from 'mongoose';
import { CallSessionModel, ICallSession, CallType, CallStatus } from '../models/call-session.model';
import { PanditModel } from '../models/pandit.model';
import { UserModel } from '../models/user.model';
import { ProfileModel } from '../models/profile.model';
import { SystemSettingsModel } from '../models/system-settings.model';
import { SocketService } from '../socket/socket.service';
import { PushNotificationService } from './push-notification.service';
import { AppError } from '../middleware/errorHandler';

export interface InitiateCallInput {
  callerId: string;
  receiverId: string;
  callType: CallType;
  panditId?: string;
}

export class CallService {
  /**
   * Initiate Audio or Video Call
   */
  static async initiateCall(input: InitiateCallInput) {
    const { callerId, receiverId, callType, panditId } = input;

    if (!callerId || !receiverId) {
      throw new AppError('callerId and receiverId are required to start a call.', 400, 'VALIDATION_ERROR');
    }

    if (callerId === receiverId) {
      throw new AppError('Cannot initiate a call to yourself.', 400, 'SELF_CALL_NOT_ALLOWED');
    }

    // Resolve caller details
    const callerUser = await UserModel.findById(callerId).select('displayName name mobile avatar profilePhoto');
    const callerProfile = await ProfileModel.findOne({ userId: callerId }).select('displayName photos');
    const callerName =
      callerUser?.displayName || callerUser?.name || callerProfile?.displayName || 'ShaadiBanao Caller';
    const callerPhoto =
      callerUser?.profilePhoto || callerUser?.avatar || (callerProfile?.photos?.[0]?.url ?? '');

    // Resolve receiver details
    const receiverUser = await UserModel.findById(receiverId).select('displayName name mobile avatar profilePhoto');
    const receiverProfile = await ProfileModel.findOne({ userId: receiverId }).select('displayName photos');
    const receiverName =
      receiverUser?.displayName || receiverUser?.name || receiverProfile?.displayName || 'User';
    const receiverPhoto =
      receiverUser?.profilePhoto || receiverUser?.avatar || (receiverProfile?.photos?.[0]?.url ?? '');

    // If call involves a Pandit, verify status & availability
    let panditDoc: any = null;
    let amountPaid = 0;
    let commissionAmount = 0;
    let panditEarnings = 0;
    let isPaid = false;

    if (panditId && mongoose.Types.ObjectId.isValid(panditId)) {
      panditDoc = await PanditModel.findById(panditId);
      if (!panditDoc) {
        throw new AppError('Pandit not found.', 404, 'PANDIT_NOT_FOUND');
      }

      if (panditDoc.verificationStatus !== 'approved' && panditDoc.verificationStatus !== 'verified') {
        throw new AppError(
          'This Pandit profile is currently pending verification and cannot take calls.',
          400,
          'PANDIT_NOT_VERIFIED'
        );
      }

      if (panditDoc.isOnline === false) {
        throw new AppError(
          'Pandit Ji is currently offline. Please try again later or schedule a booking.',
          400,
          'PANDIT_OFFLINE'
        );
      }

      if (callType === 'video' && panditDoc.isVideoCallAvailable === false) {
        throw new AppError('Pandit Ji is not accepting video calls at this time.', 400, 'CALL_UNAVAILABLE');
      }

      if (callType === 'audio' && panditDoc.isAudioCallAvailable === false) {
        throw new AppError('Pandit Ji is not accepting audio calls at this time.', 400, 'CALL_UNAVAILABLE');
      }

      // Fetch pricing & settings
      const settings = (await SystemSettingsModel.findOne({ key: 'global_settings' }).lean()) as any;
      const ratePerCall =
        callType === 'video'
          ? (settings?.videoConsultationPriceInr || 1100)
          : (settings?.audioConsultationPriceInr || 501);

      const commRate = settings?.callCommissionRate || 15;
      amountPaid = ratePerCall;
      commissionAmount = Math.round(amountPaid * (commRate / 100));
      panditEarnings = Math.max(0, amountPaid - commissionAmount);
      isPaid = true;
    }

    // Generate unique sessionId
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const sessionId = `call_${Date.now()}_${randomSuffix}`;

    const session = await CallSessionModel.create({
      sessionId,
      callerId: new mongoose.Types.ObjectId(callerId),
      callerName,
      callerPhoto,
      receiverId: new mongoose.Types.ObjectId(receiverId),
      receiverName,
      receiverPhoto,
      ...(panditDoc ? { panditId: panditDoc._id } : {}),
      callType,
      status: 'ringing',
      isPaid,
      amountPaid,
      commissionAmount,
      panditEarnings,
      startedAt: new Date(),
    });

    // Notify receiver via real-time WebSocket
    SocketService.emitToUser(receiverId, 'call_incoming', {
      sessionId: session.sessionId,
      callerId,
      callerName,
      callerPhoto,
      receiverId,
      receiverName,
      callType,
      panditId: panditDoc ? panditDoc._id.toString() : undefined,
    });

    // Trigger Push Notification if receiver is in background
    try {
      await PushNotificationService.sendToUser(receiverId, {
        title: `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
        body: `${callerName} is calling you on ShaadiBanao...`,
        data: {
          type: 'incoming_call',
          sessionId: session.sessionId,
          callType,
          callerId,
        },
      });
    } catch {
      // Non-blocking notification error
    }

    return session;
  }

  /**
   * Accept an incoming call
   */
  static async acceptCall(sessionId: string, receiverId: string) {
    const session = await CallSessionModel.findOne({ sessionId });
    if (!session) {
      throw new AppError('Call session not found.', 404, 'CALL_NOT_FOUND');
    }

    if (session.receiverId.toString() !== receiverId) {
      throw new AppError('Unauthorized to accept this call.', 403, 'FORBIDDEN');
    }

    if (session.status !== 'initiating' && session.status !== 'ringing') {
      throw new AppError(`Cannot accept call in '${session.status}' status.`, 400, 'INVALID_CALL_STATUS');
    }

    session.status = 'accepted';
    session.connectedAt = new Date();
    await session.save();

    // Notify caller that call was accepted
    SocketService.emitToUser(session.callerId.toString(), 'call_accepted', {
      sessionId: session.sessionId,
      receiverId,
      connectedAt: session.connectedAt,
    });

    return session;
  }

  /**
   * Reject an incoming call
   */
  static async rejectCall(sessionId: string, receiverId: string, reason?: string) {
    const session = await CallSessionModel.findOne({ sessionId });
    if (!session) {
      throw new AppError('Call session not found.', 404, 'CALL_NOT_FOUND');
    }

    if (session.receiverId.toString() !== receiverId && session.callerId.toString() !== receiverId) {
      throw new AppError('Unauthorized to reject this call.', 403, 'FORBIDDEN');
    }

    session.status = 'rejected';
    session.rejectionReason = reason || 'Call declined';
    session.endedAt = new Date();
    await session.save();

    // Notify other party
    const targetUserId =
      session.callerId.toString() === receiverId ? session.receiverId.toString() : session.callerId.toString();

    SocketService.emitToUser(targetUserId, 'call_rejected', {
      sessionId: session.sessionId,
      reason: session.rejectionReason,
    });

    return session;
  }

  /**
   * End an active or ongoing call
   */
  static async endCall(sessionId: string, userId: string, reason?: string, durationSeconds?: number) {
    const session = await CallSessionModel.findOne({ sessionId });
    if (!session) {
      throw new AppError('Call session not found.', 404, 'CALL_NOT_FOUND');
    }

    const callerIdStr = session.callerId.toString();
    const receiverIdStr = session.receiverId.toString();

    if (callerIdStr !== userId && receiverIdStr !== userId) {
      throw new AppError('Unauthorized to end this call.', 403, 'FORBIDDEN');
    }

    const now = new Date();
    session.endedAt = now;

    if (typeof durationSeconds === 'number' && durationSeconds >= 0) {
      session.durationSeconds = durationSeconds;
      session.status = durationSeconds > 0 || session.connectedAt ? 'ended' : 'missed';
    } else if (session.connectedAt) {
      session.status = 'ended';
      session.durationSeconds = Math.max(0, Math.round((now.getTime() - session.connectedAt.getTime()) / 1000));
    } else {
      session.status = session.status === 'ringing' ? 'missed' : 'ended';
      session.durationSeconds = 0;
    }

    if (reason) {
      session.rejectionReason = reason;
    }

    await session.save();

    // Credit Pandit earnings if consultation call completed
    if (session.panditId && session.panditEarnings > 0 && session.durationSeconds >= 30) {
      await PanditModel.findByIdAndUpdate(session.panditId, {
        $inc: {
          totalEarnings: session.panditEarnings,
          pendingPayout: session.panditEarnings,
        },
      });
    }

    // Notify both parties
    const endPayload = {
      sessionId: session.sessionId,
      durationSeconds: session.durationSeconds,
      endedBy: userId,
      status: session.status,
    };

    SocketService.emitToUser(callerIdStr, 'call_ended', endPayload);
    SocketService.emitToUser(receiverIdStr, 'call_ended', endPayload);

    return session;
  }

  /**
   * Fetch user's call history
   */
  static async getUserCallHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const objectId = new mongoose.Types.ObjectId(userId);

    const [items, totalCount] = await Promise.all([
      CallSessionModel.find({
        $or: [{ callerId: objectId }, { receiverId: objectId }],
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CallSessionModel.countDocuments({
        $or: [{ callerId: objectId }, { receiverId: objectId }],
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Fetch Pandit call requests and history
   */
  static async getPanditCallHistory(panditUserId: string, page = 1, limit = 20) {
    const pandit = await PanditModel.findOne({ userId: panditUserId });
    if (!pandit) {
      throw new AppError('Pandit profile not found.', 404, 'PANDIT_NOT_FOUND');
    }

    const skip = (page - 1) * limit;
    const [items, totalCount] = await Promise.all([
      CallSessionModel.find({ panditId: pandit._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CallSessionModel.countDocuments({ panditId: pandit._id }),
    ]);

    return {
      panditId: pandit._id.toString(),
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Admin: List all call records with metrics
   */
  static async getAdminCallList(page = 1, limit = 50, filterType = 'all') {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filterType === 'video') query.callType = 'video';
    if (filterType === 'audio') query.callType = 'audio';
    if (filterType === 'pandit') query.panditId = { $ne: null };
    if (filterType === 'missed') query.status = 'missed';
    if (filterType === 'ended') query.status = 'ended';

    const [items, totalCount, stats] = await Promise.all([
      CallSessionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CallSessionModel.countDocuments(query),
      CallSessionModel.aggregate([
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalDuration: { $sum: '$durationSeconds' },
            totalRevenue: { $sum: '$amountPaid' },
            totalPanditEarnings: { $sum: '$panditEarnings' },
          },
        },
      ]),
    ]);

    const aggregate = stats[0] || {
      totalCalls: 0,
      totalDuration: 0,
      totalRevenue: 0,
      totalPanditEarnings: 0,
    };

    return {
      items,
      stats: aggregate,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Return Public WebRTC ICE / STUN server configuration
   */
  static getWebRtcConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };
  }
}
