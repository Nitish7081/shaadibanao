import mongoose, { Schema, Document } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface IWithdrawal extends Document {
  withdrawalId: string; // e.g. "WTH-2026-9281"
  panditId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  panditName: string;
  panditPhone?: string;
  amount: number; // in INR
  status: WithdrawalStatus;
  bankDetails: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    upiId?: string;
  };
  rejectionReason?: string;
  referenceNumber?: string; // UTR or IMPS reference number
  processedBy?: mongoose.Types.ObjectId | string;
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema = new Schema<IWithdrawal>(
  {
    withdrawalId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    panditId: {
      type: Schema.Types.ObjectId,
      ref: 'Pandit',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    panditName: { type: String, required: true, trim: true },
    panditPhone: { type: String, trim: true },
    amount: {
      type: Number,
      required: true,
      min: 100,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'paid'],
      default: 'pending',
      index: true,
    },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      bankName: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    rejectionReason: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
    processedBy: { type: Schema.Types.Mixed },
    processedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export const WithdrawalModel =
  mongoose.models.Withdrawal || mongoose.model<IWithdrawal>('Withdrawal', WithdrawalSchema);
