import { ImagePreset, presetTransformation } from '@bandhansetu/shared';

/**
 * Cloudinary display-URL helper. Use for EVERY remote image shown in the app.
 * Adds f_auto,q_auto and a proper width. Profile photos use c_fill + g_face.
 * Non-Cloudinary, local (file:/data:) and private ("authenticated") URLs pass through untouched.
 *
 * SIGNED URLs (".../upload/s--SIGNATURE--/...", e.g. the blurred photos built by the server)
 * pass through untouched: adding a transformation would invalidate the signature.
 *
 * With Strict Transformations ON in the Cloudinary dashboard, the transformation strings
 * generated here (see presetTransformation in @bandhansetu/shared) must be allow-listed
 * exactly. See docs/CLOUDINARY_PRIVACY_SETUP.md.
 */
export type { ImagePreset };

export function cloudinaryUrl(url: string | undefined | null, preset: ImagePreset = 'card'): string {
  if (!url) return '';
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(url)) return url;
  if (!url.includes('/image/upload/')) return url; // never touch /authenticated/ or /private/
  if (/\/image\/upload\/s--[\w-]+--\//.test(url)) return url; // signed: never modify
  if (/\/image\/upload\/[^/]*(f_auto|q_auto)/.test(url)) return url; // already transformed
  return url.replace('/image/upload/', `/image/upload/${presetTransformation(preset)}/`);
}
