import mongoose from 'mongoose';
import { BannerModel } from '../models/banner.model';
import { AuditLogModel } from '../models/audit-log.model';
import { StorageService } from './storage.service';
import { AppError } from '../middleware/errorHandler';

/**
 * Home-screen promotional banners. Uses the EXISTING `Banner` collection (no schema change):
 * title (required) / imageUrl / publicId / linkUrl / isActive / priority.
 * Images are PUBLIC Cloudinary assets (promotional, not private).
 */
export const DEFAULT_BANNER_TITLES = ['Banner', 'ShaadiBanao Matrimonial Banner'];
export const MAX_BANNER_BYTES = 5 * 1024 * 1024;

export interface PublicBanner {
  id: string;
  /** '' when the admin gave no title (the app then shows the image only). */
  title: string;
  imageUrl: string;
  linkUrl?: string;
}

/** Optional link: https URL or an in-app path ("/membership"). Anything else (javascript:, http:, //host) is rejected. */
export function sanitizeBannerLink(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new AppError('Banner link must be text.', 400, 'VALIDATION_ERROR');
  const t = value.trim();
  if (!t) return undefined;
  if (t.length > 500) throw new AppError('Banner link is too long (max 500 characters).', 400, 'VALIDATION_ERROR');
  if (t.startsWith('/') && !t.startsWith('//')) return t;
  if (/^https:\/\//i.test(t)) {
    try {
      new URL(t);
      return t;
    } catch {
      /* fall through */
    }
  }
  throw new AppError('Banner link must start with https:// or be an in-app path like /membership.', 400, 'VALIDATION_ERROR');
}

export function normaliseBannerTitle(value: unknown): string {
  const t = typeof value === 'string' ? value.trim().slice(0, 120) : '';
  return t || DEFAULT_BANNER_TITLES[0];
}

/** Validates a base64 / data-URL banner image (size + real content type) and returns the bytes. */
export function decodeBannerImage(base64?: unknown): Buffer {
  if (typeof base64 !== 'string' || !base64) {
    throw new AppError('Banner image payload (base64) is required.', 400, 'VALIDATION_ERROR');
  }
  let raw = base64;
  if (raw.includes(';base64,')) raw = raw.split(';base64,').pop() || '';
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length === 0) throw new AppError('Banner image is empty.', 400, 'VALIDATION_ERROR');
  if (buffer.length > MAX_BANNER_BYTES) throw new AppError('Banner image exceeds 5MB limit.', 400, 'FILE_TOO_LARGE');
  const format = StorageService.detectFileFormat(buffer);
  if (!['jpeg', 'png', 'webp'].includes(format)) {
    throw new AppError(`Invalid image content. Expected JPEG, PNG, or WebP but detected '${format}'.`, 400, 'INVALID_FILE_TYPE');
  }
  return buffer;
}

export function toPublicBanner(doc: any): PublicBanner {
  const title = String(doc.title || '');
  return {
    id: String(doc._id ?? doc.id),
    title: DEFAULT_BANNER_TITLES.includes(title) ? '' : title,
    imageUrl: doc.imageUrl,
    ...(doc.linkUrl ? { linkUrl: doc.linkUrl } : {}),
  };
}

export class BannerService {
  /** Active banners for the app Home screen (public). Highest priority first; max 10. */
  static async listPublic(): Promise<PublicBanner[]> {
    if (mongoose.connection.readyState !== 1) return [];
    const docs = await BannerModel.find({ isActive: true, imageUrl: { $exists: true, $ne: '' } })
      .sort({ priority: -1, createdAt: -1 })
      .limit(10)
      .lean();
    return docs.map(toPublicBanner);
  }

  /** Admin: every banner, active or not. */
  static async listAll(): Promise<any[]> {
    if (mongoose.connection.readyState !== 1) return [];
    return BannerModel.find({}).sort({ priority: -1, createdAt: -1 }).lean();
  }

  /** Admin: enable/disable, edit title/link/priority, and/or REPLACE the image. */
  static async update(
    bannerId: string,
    adminUser: any,
    payload: { title?: unknown; linkUrl?: unknown; priority?: unknown; isActive?: unknown; base64?: unknown },
    ipAddress?: string
  ): Promise<any> {
    if (mongoose.connection.readyState !== 1) {
      throw new AppError('Database is not connected.', 503, 'DATABASE_UNAVAILABLE');
    }
    if (!mongoose.Types.ObjectId.isValid(bannerId)) throw new AppError('Banner not found.', 404, 'NOT_FOUND');
    const banner: any = await BannerModel.findById(bannerId);
    if (!banner) throw new AppError('Banner not found.', 404, 'NOT_FOUND');

    const set: Record<string, any> = {};
    if (payload.title !== undefined) set.title = normaliseBannerTitle(payload.title);
    if (payload.linkUrl !== undefined) set.linkUrl = sanitizeBannerLink(payload.linkUrl) ?? '';
    if (payload.priority !== undefined) {
      const n = Number(payload.priority);
      if (!Number.isFinite(n)) throw new AppError('Priority must be a number.', 400, 'VALIDATION_ERROR');
      set.priority = Math.trunc(n);
    }
    if (payload.isActive !== undefined) {
      if (typeof payload.isActive !== 'boolean') throw new AppError('isActive must be true or false.', 400, 'VALIDATION_ERROR');
      set.isActive = payload.isActive;
    }

    let oldPublicId: string | undefined;
    if (payload.base64 !== undefined) {
      const buffer = decodeBannerImage(payload.base64); // validate BEFORE touching Cloudinary
      const up = await StorageService.uploadToCloudinary(buffer, {
        folder: 'shaadibanao/banners',
        tags: ['shaadibanao', 'banner', 'matrimonial_public'],
      });
      oldPublicId = banner.publicId;
      set.imageUrl = up.secureUrl;
      set.publicId = up.publicId;
    }

    if (Object.keys(set).length === 0) throw new AppError('Nothing to update.', 400, 'VALIDATION_ERROR');
    const updated = await BannerModel.findByIdAndUpdate(bannerId, { $set: set }, { new: true }).lean();

    if (oldPublicId) await StorageService.deleteFromCloudinary(oldPublicId); // only after the new image is saved

    await AuditLogModel.create({
      adminId: adminUser.userId || adminUser.id,
      adminEmail: adminUser.email,
      adminName: adminUser.displayName || 'Administrator',
      action: 'UPDATE_BANNER',
      details: { bannerId, fields: Object.keys(set).filter((k) => k !== 'imageUrl') , replacedImage: !!oldPublicId },
      ipAddress,
    });
    return updated;
  }
}
