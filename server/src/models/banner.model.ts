import mongoose, { Schema, Document } from 'mongoose';

export interface IBanner extends Document {
  title: string;
  imageUrl: string;
  publicId?: string;
  linkUrl?: string;
  isActive: boolean;
  priority: number;
  uploadedBy?: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    linkUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.Mixed, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

export const BannerModel =
  mongoose.models.Banner || mongoose.model<IBanner>('Banner', BannerSchema);
