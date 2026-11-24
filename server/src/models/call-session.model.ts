import mongoose, { Schema, Document } from 'mongoose';

export type CallType = 'audio' | 'video';
export type CallStatus =
  | 'initiating'
  | 'ringing'
  | 'accepted'
  | 'rejected'
  | 'missed'
  | 'busy'
  | 'ended'
  | 'failed';

export interface ICallSession extends Document {
  sessionId: string;
  callerId: mongoose.Types.ObjectId;
  callerName: string;
  callerPhoto?: string;
  receiverId: mongoose.Types.ObjectId;
  receiverName: string;
  receiverPhoto?: string;
  panditId?: mongoose.Types.ObjectId;
  callType: CallType;
  status: CallStatus;
  isPaid: boolean;
  amountPaid: number;
  commissionAmount: number;
  panditEarnings: number;
  startedAt: Date;
  connectedAt?: Date;
  endedAt?: Date;
  durationSeconds: number;
  rejectionReason?: string;
  rating?: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CallSessionSchema = new Schema<ICallSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    callerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    callerName: {
      type: String,
      default: 'Caller',
      trim: true,
    },
    callerPhoto: {
      type: String,
      default: '',
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverName: {
      type: String,
      default: 'Receiver',
      trim: true,
    },
    receiverPhoto: {
      type: String,
      default: '',
    },
    panditId: {
      type: Schema.Types.ObjectId,
      ref: 'Pandit',
      index: true,
    },
    callType: {
      type: String,
      enum: ['audio', 'video'],
      default: 'audio',
      index: true,
    },
    status: {
      type: String,
      enum: ['initiating', 'ringing', 'accepted', 'rejected', 'missed', 'busy', 'ended', 'failed'],
      default: 'initiating',
      index: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    panditEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    connectedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

CallSessionSchema.index({ callerId: 1, createdAt: -1 });
CallSessionSchema.index({ receiverId: 1, createdAt: -1 });
CallSessionSchema.index({ panditId: 1, createdAt: -1 });

export const CallSessionModel =
  mongoose.models.CallSession || mongoose.model<ICallSession>('CallSession', CallSessionSchema);
