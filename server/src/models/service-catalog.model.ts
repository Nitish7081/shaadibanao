import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceCatalogItem extends Document {
  serviceId: string;
  name: string;
  nameHi?: string;
  category: string;
  description: string;
  descriptionHi?: string;
  priceInr: number;
  durationMinutes: number;
  isActive: boolean;
  ceremonyType: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceCatalogSchema = new Schema<IServiceCatalogItem>(
  {
    serviceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    nameHi: { type: String, trim: true },
    category: { type: String, default: 'Vedic Ceremonies', index: true },
    description: { type: String, default: '', trim: true },
    descriptionHi: { type: String, default: '', trim: true },
    priceInr: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, default: 60, min: 15 },
    isActive: { type: Boolean, default: true },
    ceremonyType: { type: String, default: 'other_puja' },
  },
  { timestamps: true }
);

export const ServiceCatalogModel = mongoose.model<IServiceCatalogItem>('ServiceCatalog', ServiceCatalogSchema);
