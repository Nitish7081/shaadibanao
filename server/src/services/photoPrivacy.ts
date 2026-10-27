import crypto from 'crypto';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { PhotoPrivacy, BLUR_TRANSFORMATION } from '@bandhansetu/shared';
import { config } from '../config/env';
import { InterestModel } from '../models/interest.model';

/**
 * Server-side photo privacy.
 *
 * Rule: a photo the viewer is not allowed to see in full is NEVER sent with its original URL
 * (or its publicId, which would let a client rebuild the original URL).
 * It is sent as a Cloudinary-blurred URL, or with no URL at all when it cannot be blurred
 * (non-Cloudinary / private / authenticated URL).
 *
 *  - 'everyone'                 -> original photo
 *  - 'blurred'                  -> always blurred in the public view (the owner's own originals come
 *                                  from /profiles/me, so the public view is a faithful preview)
 *  - 'after_interest_accepted'  -> blurred until an interest between the two members is accepted
 *                                  (either direction)
 *
 * When a profile-level photoPrivacy and a per-photo privacy differ, the stricter one wins.
 */

export interface PhotoViewerContext {
  /** Authenticated viewer. Unknown viewer => treated as a stranger (most restrictive). */
  viewerId?: string;
  /** User ids that have an ACCEPTED interest with the viewer (either direction). */
  acceptedUserIds?: Set<string>;
}

export interface PublicPhotoOut {
  url: string;
  publicId?: string;
  isMain: boolean;
  isBlurred: boolean;
  /** Added (backward compatible): the privacy mode that applies to this photo. */
  privacy: PhotoPrivacy;
  /** Added (backward compatible): true when the viewer is not allowed to see the original. */
  isLocked: boolean;
}

const RANK: Record<PhotoPrivacy, number> = {
  everyone: 0,
  after_interest_accepted: 1,
  blurred: 2,
};

const BLUR_TRANSFORM = BLUR_TRANSFORMATION;

function normalise(value: any): PhotoPrivacy {
  return value === 'blurred' || value === 'after_interest_accepted' ? value : 'everyone';
}

export function effectivePhotoPrivacy(profilePrivacy: any, photoPrivacy: any): PhotoPrivacy {
  const a = normalise(profilePrivacy);
  const b = normalise(photoPrivacy);
  return RANK[a] >= RANK[b] ? a : b;
}

interface ParsedCloudinaryUrl {
  cloudName: string;
  type: 'upload' | 'private' | 'authenticated';
  version?: string;
  /** public id WITHOUT extension */
  publicId: string;
  format?: string;
}

/** Parses a res.cloudinary.com image URL (ignoring any signature / transformation segments). */
export function parseCloudinaryUrl(url?: string): ParsedCloudinaryUrl | null {
  if (!url) return null;
  const m = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/(upload|private|authenticated)\/([^?#]+)/i.exec(url);
  if (!m) return null;
  const segs = m[3].split('/');
  const vIdx = segs.findIndex((s) => /^v\d+$/.test(s));
  let rest: string[];
  let version: string | undefined;
  if (vIdx >= 0) {
    version = segs[vIdx].slice(1);
    rest = segs.slice(vIdx + 1);
  } else {
    // No version: drop a leading signature / transformation segment if present.
    rest = segs.filter((s, i) => !(i < segs.length - 1 && (/^s--[\w-]+--$/.test(s) || s.includes(','))));
  }
  if (rest.length === 0) return null;
  const file = rest.join('/');
  const dot = file.lastIndexOf('.');
  const hasExt = dot > file.lastIndexOf('/') + 0 && dot > 0;
  return {
    cloudName: m[1],
    type: m[2].toLowerCase() as ParsedCloudinaryUrl['type'],
    version,
    publicId: hasExt ? file.slice(0, dot) : file,
    format: hasExt ? file.slice(dot + 1) : undefined,
  };
}

function signatureFor(toSign: string, secret: string): string {
  return crypto
    .createHash('sha1')
    .update(toSign + secret)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .slice(0, 8);
}

/**
 * Returns a SIGNED Cloudinary URL (sign_url: true) with a strong blur baked in, or '' when
 * the URL cannot be safely blurred server-side (non-Cloudinary, unparseable, or no API
 * secret configured). Never returns the original URL. The secret is only used to sign;
 * it is never logged or returned.
 *
 * Changing or removing the blur transformation breaks the signature (Cloudinary answers 401).
 * Note: the ORIGINAL of a public 'upload' asset stays reachable if someone knows its public id;
 * see docs/CLOUDINARY_PRIVACY_SETUP.md.
 */
export function toBlurredUrl(url?: string, publicIdFallback?: string): string {
  const secret = config.cloudinary.apiSecret;
  if (!secret) return '';
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return '';
  const publicId = parsed.publicId || publicIdFallback;
  if (!publicId) return '';
  const signed = cloudinary.url(publicId, {
    cloud_name: parsed.cloudName,
    api_secret: secret,
    secure: true,
    sign_url: true,
    resource_type: 'image',
    type: parsed.type,
    version: parsed.version,
    format: parsed.format,
    raw_transformation: BLUR_TRANSFORM,
  });
  const out = signed.split('?')[0];
  return isValidBlurredPhotoUrl(out) ? out : '';
}

/**
 * True only for a URL carrying our exact blur transformation AND a valid signature for it.
 * A URL with the blur removed/changed, or without a (correct) signature, is rejected.
 */
export function isValidBlurredPhotoUrl(url?: string): boolean {
  const secret = config.cloudinary.apiSecret;
  if (!url || !secret) return false;
  const m = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/(?:upload|private|authenticated)\/s--([\w-]{8})--\/([^/]+)\/(?:v\d+\/)?([^?#]+)$/i.exec(url);
  if (!m) return false;
  const [, sig, transformation, file] = m;
  if (transformation !== BLUR_TRANSFORM) return false;
  const expected = signatureFor(`${transformation}/${file}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function idOf(value: any): string {
  return value?.toString?.() ?? String(value ?? '');
}

export function buildPublicPhotos(doc: any, ctx: PhotoViewerContext = {}): PublicPhotoOut[] {
  const ownerId = idOf(doc.userId);
  const accepted = !!ownerId && !!ctx.acceptedUserIds && ctx.acceptedUserIds.has(ownerId);

  // Only moderation-approved photos are ever public.
  return (doc.photos || [])
    .filter((p: any) => p.approved === true)
    .map((p: any): PublicPhotoOut => {
      const mode = effectivePhotoPrivacy(doc.photoPrivacy, p.privacy);
      const canSeeOriginal = mode === 'everyone' || (mode === 'after_interest_accepted' && accepted);

      if (canSeeOriginal) {
        return {
          url: p.url,
          publicId: p.publicId,
          isMain: !!p.isMain,
          isBlurred: false,
          privacy: mode,
          isLocked: false,
        };
      }

      return {
        url: toBlurredUrl(p.url, p.publicId),
        isMain: !!p.isMain,
        isBlurred: true,
        privacy: mode,
        isLocked: true,
      };
    });
}

/**
 * Which of `otherUserIds` have an accepted interest with `viewerId` (either direction)?
 * Works with MongoDB and with the in-memory development fallback.
 */
export async function getAcceptedUserIds(
  viewerId: string | undefined,
  otherUserIds: Array<string | { toString(): string }>
): Promise<Set<string>> {
  const result = new Set<string>();
  const others = Array.from(new Set(otherUserIds.map(idOf).filter(Boolean)));
  if (!viewerId || others.length === 0) return result;

  if (mongoose.connection.readyState === 1) {
    const valid = (s: string) => mongoose.Types.ObjectId.isValid(s);
    if (!valid(viewerId)) return result;
    const otherObjIds = others.filter(valid).map((s) => new mongoose.Types.ObjectId(s));
    if (otherObjIds.length === 0) return result;
    const viewerObjId = new mongoose.Types.ObjectId(viewerId);
    const rows = await InterestModel.find({
      status: 'accepted',
      $or: [
        { senderId: viewerObjId, receiverId: { $in: otherObjIds } },
        { receiverId: viewerObjId, senderId: { $in: otherObjIds } },
      ],
    }).select('senderId receiverId');
    rows.forEach((r: any) => {
      const s = idOf(r.senderId);
      const rc = idOf(r.receiverId);
      result.add(s === viewerId ? rc : s);
    });
    return result;
  }

  // In-memory fallback (loaded lazily to avoid an import cycle with interest.service)
  const { inMemoryInterestStore } = await import('./interest.service');
  const set = new Set(others);
  inMemoryInterestStore.forEach((i) => {
    if (i.status !== 'accepted') return;
    if (i.senderId === viewerId && set.has(i.receiverId)) result.add(i.receiverId);
    if (i.receiverId === viewerId && set.has(i.senderId)) result.add(i.senderId);
  });
  return result;
}
