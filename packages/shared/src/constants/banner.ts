/**
 * Home-screen banners (admin managed). Shared so mobile and tests use the same link rules.
 */
export interface HomeBanner {
  id: string;
  /** '' => image only */
  title: string;
  imageUrl: string;
  linkUrl?: string;
}

export type BannerAction =
  | { kind: 'none' }
  | { kind: 'external'; url: string }
  | { kind: 'screen'; screen: 'Membership' | 'Notifications' | 'PrivacySettings' | 'MyBookings' | 'PanditServices' }
  | { kind: 'tab'; screen: 'Home' | 'Matches' | 'Community' | 'Astrology' | 'Profile' };

const INTERNAL: Record<string, BannerAction> = {
  '/membership': { kind: 'screen', screen: 'Membership' },
  '/notifications': { kind: 'screen', screen: 'Notifications' },
  '/privacy': { kind: 'screen', screen: 'PrivacySettings' },
  '/bookings': { kind: 'screen', screen: 'MyBookings' },
  '/pandits': { kind: 'screen', screen: 'PanditServices' },
  '/home': { kind: 'tab', screen: 'Home' },
  '/matches': { kind: 'tab', screen: 'Matches' },
  '/search': { kind: 'tab', screen: 'Matches' },
  '/community': { kind: 'tab', screen: 'Community' },
  '/astrology': { kind: 'tab', screen: 'Astrology' },
  '/profile': { kind: 'tab', screen: 'Profile' },
};

/** What tapping a banner does. Only https links and known in-app paths are ever followed. */
export function bannerActionFor(link?: string | null): BannerAction {
  const t = (link || '').trim();
  if (!t) return { kind: 'none' };
  if (/^https:\/\//i.test(t)) return { kind: 'external', url: t };
  if (t.startsWith('/') && !t.startsWith('//')) {
    return INTERNAL[t.toLowerCase().split(/[?#]/)[0].replace(/\/+$/, '') || '/'] || { kind: 'none' };
  }
  return { kind: 'none' };
}
