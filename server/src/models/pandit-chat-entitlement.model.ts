import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPanditChatEntitlement extends Document {
  userId: Types.ObjectId;
  panditId: Types.ObjectId;
  freeMessagesUsed: number;
  freeLimitSnapshot: number;
  lastFreeMessageAt?: Date;
  paidAccessActive: boolean;
  paidSource?: 'pandit_chat' | 'booking' | 'admin_override';
  paidActivatedAt?: Date;
  paidExpiresAt?: Date;
  lastOrderId?: string;
  lastPaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const panditChatEntitlementSchema = new Schema<IPanditChatEntitlement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    panditId: { type: Schema.Types.ObjectId, ref: 'Pandit', required: true, index: true },
    freeMessagesUsed: { type: Number, default: 0, min: 0 },
    freeLimitSnapshot: { type: Number, default: 1, min: 0 },
    lastFreeMessageAt: { type: Date },
    paidAccessActive: { type: Boolean, default: false },
    paidSource: { type: String, enum: ['pandit_chat', 'booking', 'admin_override'] },
    paidActivatedAt: { type: Date },
    paidExpiresAt: { type: Date },
    lastOrderId: { type: String, trim: true },
    lastPaymentId: { type: String, trim: true },
  },
  { timestamps: true }
);

panditChatEntitlementSchema.index({ userId: 1, panditId: 1 }, { unique: true });

export const PanditChatEntitlementModel =
  (mongoose.models.PanditChatEntitlement as mongoose.Model<IPanditChatEntitlement>) ||
  mongoose.model<IPanditChatEntitlement>('PanditChatEntitlement', panditChatEntitlementSchema);
