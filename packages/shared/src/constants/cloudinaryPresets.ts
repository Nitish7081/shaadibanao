/**
 * Cloudinary display presets: single source of truth for the mobile helper (cloudinaryUrl)
 * and for the dashboard allow-list (Strict Transformations). The transformation STRINGS
 * must be allow-listed exactly as generated here (parameter order matters).
 */
export type ImagePreset = 'avatar' | 'card' | 'hero' | 'post';

export const IMAGE_PRESETS: Record<ImagePreset, { w: number; h?: number; face: boolean }> = {
  avatar: { w: 200, h: 200, face: true },
  card: { w: 600, h: 750, face: true },
  hero: { w: 1080, h: 1350, face: true },
  post: { w: 900, face: false },
};

export function presetTransformation(preset: ImagePreset): string {
  const p = IMAGE_PRESETS[preset];
  const t = ['f_auto', 'q_auto', `w_${p.w}`];
  if (p.h) t.push(`h_${p.h}`);
  if (p.face) t.push('c_fill', 'g_face');
  else t.push('c_limit');
  return t.join(',');
}

/** Blur baked into server-signed URLs for private photos. Signed => needs no allow-listing. */
export const BLUR_TRANSFORMATION = 'e_blur:2000,q_auto,f_auto,w_320';
