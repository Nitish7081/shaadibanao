import mongoose, { Schema, Document } from 'mongoose';
import { CONTACT_CATEGORIES, ContactCategory } from '@bandhansetu/shared';

export interface IContactInquiry extends Document {
  ticketId: string;
  name: string;
  email: string;
  phone?: string;
  category: ContactCategory;
  subject: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  ipHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactInquirySchema = new Schema<IContactInquiry>(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    category: {
      type: String,
      enum: CONTACT_CATEGORIES,
      default: 'general_support',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    ipHash: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ContactInquirySchema.index({ createdAt: -1 });

export const ContactInquiryModel =
  mongoose.models.ContactInquiry ||
  mongoose.model<IContactInquiry>('ContactInquiry', ContactInquirySchema);
