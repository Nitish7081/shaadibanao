import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMembership extends Document {
  userId: Types.ObjectId;
  planId: 'free' | 'plus' | 'premium';
  status: 'active' | 'expired' | 'cancelled';
  contactDisclosuresUsed: number;
  startDate: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    planId: {
      type: String,
      enum: ['free', 'plus', 'premium'],
      default: 'free',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
      required: true,
    },
    contactDisclosuresUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const MembershipModel = mongoose.model<IMembership>('Membership', MembershipSchema);
