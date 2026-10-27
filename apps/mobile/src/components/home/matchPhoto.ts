import { SearchResultProfile } from '@bandhansetu/shared';
import { cloudinaryUrl } from '../../services/cloudinaryUrl';

export interface SafePhoto {
  uri: string;
  /** Server marked this photo as blurred: it must be shown blurred. */
  blurred: boolean;
}

/**
 * Picks the photo to display for a match.
 * The server (ProfileService.formatPublicProfile) already returns only moderation-approved photos
 * and flags blurred ones. We never invent a photo: no photo => null (caller shows initials),
 * and a blurred flag is always honoured.
 */
export function getSafeMatchPhoto(match: SearchResultProfile, preset: 'avatar' | 'card'): SafePhoto | null {
  const photos = match.photos || [];
  const chosen = photos.find((p) => p.isMain && !!p.url) || photos.find((p) => !!p.url);
  if (!chosen) return null;
  return { uri: cloudinaryUrl(chosen.url, preset), blurred: chosen.isBlurred === true };
}

export function getInitials(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[1].charAt(0) : parts[0].charAt(1) || '';
  return (first + second).toUpperCase();
}

export function formatHeight(heightCm?: number): string | null {
  if (!heightCm) return null;
  const totalInches = Math.round(heightCm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}"`;
}
