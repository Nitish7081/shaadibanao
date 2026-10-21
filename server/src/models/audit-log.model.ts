import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  adminId: mongoose.Types.ObjectId | string;
  adminEmail?: string;
  adminName?: string;
  action: string;
  targetUserId?: mongoose.Types.ObjectId | string;
  targetUserEmail?: string;
  targetUserMobile?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    adminId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    adminName: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.Mixed,
      required: false,
      index: true,
    },
    targetUserEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    targetUserMobile: {
      type: String,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Optimize indexes for audit trail lookup
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLogModel =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
