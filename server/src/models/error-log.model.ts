import mongoose, { Schema, Document } from 'mongoose';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ResolutionStatus = 'open' | 'investigating' | 'resolved' | 'ignored';

export interface IErrorLog extends Document {
  errorId: string; // e.g. "ERR-2026-9281"
  module: string; // 'booking' | 'payment' | 'pandit' | 'auth' | 'chat' | 'database' | 'admin' | 'system'
  errorMessage: string;
  stackTrace?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  severity: ErrorSeverity;
  userId?: string;
  userRole?: string;
  clientIp?: string;
  resolved: boolean;
  resolutionStatus: ResolutionStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ErrorLogSchema = new Schema<IErrorLog>(
  {
    errorId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    errorMessage: {
      type: String,
      required: true,
      trim: true,
    },
    stackTrace: {
      type: String,
      trim: true,
    },
    apiEndpoint: {
      type: String,
      trim: true,
      index: true,
    },
    httpMethod: {
      type: String,
      trim: true,
    },
    statusCode: {
      type: Number,
      default: 500,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    userId: {
      type: String,
      trim: true,
    },
    userRole: {
      type: String,
      trim: true,
    },
    clientIp: {
      type: String,
      trim: true,
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolutionStatus: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'ignored'],
      default: 'open',
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: String,
      trim: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const ErrorLogModel =
  mongoose.models.ErrorLog || mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
