import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  title: string;
  message?: string;
  body?: string;
  type: string;
  targetAudience: string;
  targetUserId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  data?: Record<string, any>;
  isRead: boolean;
  readBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    body: { type: String, trim: true },
    type: {
      type: String,
      default: 'system',
      index: true,
    },
    targetAudience: {
      type: String,
      default: 'all',
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    metadata: { type: Schema.Types.Mixed },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readBy: [{ type: String }],
  },
  { timestamps: true }
);

// Virtuals / Pre-save to synchronize message and body
NotificationSchema.pre('save', function (next) {
  if (!this.message && this.body) {
    this.message = this.body;
  }
  if (!this.body && this.message) {
    this.body = this.message;
  }
  if (!this.targetUserId && this.userId) {
    this.targetUserId = this.userId;
  }
  if (!this.userId && this.targetUserId) {
    this.userId = this.targetUserId;
  }
  next();
});

export const NotificationModel =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
