/**
 * Cloudinary display-URL helper. Use for EVERY remote image shown in the app.
 * Adds f_auto,q_auto and a proper width. Profile photos use c_fill + g_face.
 * Non-Cloudinary, local (file:/data:) and private ("authenticated") URLs pass through untouched.
 */
export type ImagePreset = 'avatar' | 'card' | 'hero' | 'post';

const PRESETS: Record<ImagePreset, { w: number; h?: number; face: boolean }> = {
  avatar: { w: 200, h: 200, face: true },
  card: { w: 600, h: 750, face: true },
  hero: { w: 1080, h: 1350, face: true },
  post: { w: 900, face: false },
};

export function cloudinaryUrl(url: string | undefined | null, preset: ImagePreset = 'card'): string {
  if (!url) return '';
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(url)) return url;
  if (!url.includes('/image/upload/')) return url; // never touch /authenticated/ or /private/
  if (/\/image\/upload\/[^/]*(f_auto|q_auto)/.test(url)) return url; // already transformed
  const p = PRESETS[preset];
  const t = ['f_auto', 'q_auto', `w_${p.w}`];
  if (p.h) t.push(`h_${p.h}`);
  if (p.face) t.push('c_fill', 'g_face');
  else t.push('c_limit');
  return url.replace('/image/upload/', `/image/upload/${t.join(',')}/`);
}
