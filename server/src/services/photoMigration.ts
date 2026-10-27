import { parseCloudinaryUrl } from './photoPrivacy';

export type PhotoMigrationPlan =
  | { action: 'skip'; reason: string }
  | { action: 'migrate'; publicId: string; oldUrl: string; newUrlPreview: string };

/**
 * Pure planning step of scripts/migrate-photos-to-authenticated.ts (unit-tested; no I/O).
 * Only public Cloudinary photos inside the owner's own profile folder are migrated.
 */
export function planPhotoMigration(
  photo: { url?: string; publicId?: string },
  ownerUserId: string
): PhotoMigrationPlan {
  const url = photo.url || '';
  if (!url) return { action: 'skip', reason: 'no-url' };
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return { action: 'skip', reason: 'not-a-cloudinary-image' };
  if (parsed.type !== 'upload') return { action: 'skip', reason: 'already-authenticated' };
  const ownPrefix = `shaadibanao/profiles/${ownerUserId}/`;
  if (!parsed.publicId.startsWith(ownPrefix)) return { action: 'skip', reason: 'outside-owner-profile-folder' };
  if (photo.publicId && photo.publicId !== parsed.publicId) return { action: 'skip', reason: 'publicId-mismatch' };
  const v = parsed.version ? `v${parsed.version}/` : '';
  const ext = parsed.format ? `.${parsed.format}` : '';
  return {
    action: 'migrate',
    publicId: parsed.publicId,
    oldUrl: url,
    newUrlPreview: `https://res.cloudinary.com/${parsed.cloudName}/image/authenticated/${v}${parsed.publicId}${ext}`,
  };
}
