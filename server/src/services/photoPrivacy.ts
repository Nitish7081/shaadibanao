import mongoose from 'mongoose';
import { PhotoPrivacy } from '@bandhansetu/shared';
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

const BLUR_TRANSFORM = 'e_blur:2000,q_auto,f_auto,w_320';

function normalise(value: any): PhotoPrivacy {
  return value === 'blurred' || value === 'after_interest_accepted' ? value : 'everyone';
}

export function effectivePhotoPrivacy(profilePrivacy: any, photoPrivacy: any): PhotoPrivacy {
  const a = normalise(profilePrivacy);
  const b = normalise(photoPrivacy);
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Returns a Cloudinary URL with a strong blur baked in, or '' when the URL cannot be
 * safely blurred server-side. Never returns the original URL.
 */
export function toBlurredUrl(url?: string): string {
  if (!url) return '';
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(url)) return '';
  const marker = '/image/upload/';
  if (!url.includes(marker)) return ''; // authenticated / private assets cannot be blurred with an unsigned URL
  return url.replace(marker, `${marker}${BLUR_TRANSFORM}/`);
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
        url: toBlurredUrl(p.url),
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
