import mongoose, { Document, Schema, Types } from 'mongoose';

export type PlaySubscriptionState =
  | 'SUBSCRIPTION_STATE_UNSPECIFIED'
  | 'SUBSCRIPTION_STATE_PENDING'
  | 'SUBSCRIPTION_STATE_ACTIVE'
  | 'SUBSCRIPTION_STATE_PAUSED'
  | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_STATE_ON_HOLD'
  | 'SUBSCRIPTION_STATE_CANCELED'
  | 'SUBSCRIPTION_STATE_EXPIRED'
  | 'PURCHASED'
  | 'CANCELED'
  | 'PENDING'
  | 'REVOKED';

export interface IPlayPurchase extends Document {
  userId: Types.ObjectId;
  packageName: string;
  productId: string;
  basePlanId?: string;
  offerId?: string;
  purchaseType: 'subs' | 'in-app';
  purpose: 'membership_plus' | 'membership_premium' | 'pandit_chat';
  panditId?: Types.ObjectId;
  purchaseToken: string;
  orderId?: string;
  subscriptionState: PlaySubscriptionState;
  acknowledgementState: 'ACKNOWLEDGED' | 'UNACKNOWLEDGED';
  autoRenewing: boolean;
  expiryTime?: Date;
  lastVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PlayPurchaseSchema = new Schema<IPlayPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packageName: { type: String, required: true, trim: true },
    productId: { type: String, required: true, trim: true, index: true },
    basePlanId: { type: String, trim: true },
    offerId: { type: String, trim: true },
    purchaseType: { type: String, enum: ['subs', 'in-app'], required: true },
    purpose: {
      type: String,
      enum: ['membership_plus', 'membership_premium', 'pandit_chat'],
      required: true,
    },
    panditId: { type: Schema.Types.ObjectId, ref: 'Pandit', required: false, index: true },
    purchaseToken: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, trim: true, index: true },
    subscriptionState: { type: String, required: true },
    acknowledgementState: {
      type: String,
      enum: ['ACKNOWLEDGED', 'UNACKNOWLEDGED'],
      default: 'UNACKNOWLEDGED',
    },
    autoRenewing: { type: Boolean, default: false },
    expiryTime: { type: Date },
    lastVerifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PlayPurchaseSchema.index({ userId: 1, purpose: 1, lastVerifiedAt: -1 });

export const PlayPurchaseModel =
  mongoose.models.PlayPurchase ||
  mongoose.model<IPlayPurchase>('PlayPurchase', PlayPurchaseSchema);
