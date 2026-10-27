import { sanitizeBannerLink, normaliseBannerTitle } from '../src/services/banner.service';
import { bannerActionFor, HomeBanner } from '@bandhansetu/shared';

describe('Admin Banner Feature & Shared Helpers', () => {
  describe('sanitizeBannerLink', () => {
    it('accepts valid https URLs', () => {
      expect(sanitizeBannerLink('https://shaadibanao.in/offer')).toBe('https://shaadibanao.in/offer');
      expect(sanitizeBannerLink('https://example.com/VIP')).toBe('https://example.com/VIP');
    });

    it('accepts internal in-app paths starting with /', () => {
      expect(sanitizeBannerLink('/membership')).toBe('/membership');
      expect(sanitizeBannerLink('/matches')).toBe('/matches');
    });

    it('returns undefined for null, undefined or empty input', () => {
      expect(sanitizeBannerLink('')).toBeUndefined();
      expect(sanitizeBannerLink(null as any)).toBeUndefined();
      expect(sanitizeBannerLink(undefined)).toBeUndefined();
      expect(sanitizeBannerLink('   ')).toBeUndefined();
    });

    it('rejects unsafe protocols or plain domain strings without scheme', () => {
      expect(() => sanitizeBannerLink('javascript:alert(1)')).toThrow();
      expect(() => sanitizeBannerLink('http://insecure.com')).toThrow();
      expect(() => sanitizeBannerLink('//protocol-relative.com')).toThrow();
      expect(() => sanitizeBannerLink('example.com/test')).toThrow();
    });
  });

  describe('normaliseBannerTitle', () => {
    it('defaults to "Banner" when title is empty or missing', () => {
      expect(normaliseBannerTitle('')).toBe('Banner');
      expect(normaliseBannerTitle(undefined)).toBe('Banner');
      expect(normaliseBannerTitle('   ')).toBe('Banner');
    });

    it('trims and preserves non-empty title', () => {
      expect(normaliseBannerTitle('  Diwali Special Offer  ')).toBe('Diwali Special Offer');
    });
  });

  describe('bannerActionFor', () => {
    it('maps external https links to external action', () => {
      expect(bannerActionFor('https://shaadibanao.in/offers')).toEqual({
        kind: 'external',
        url: 'https://shaadibanao.in/offers',
      });
    });

    it('maps recognized in-app paths to screen or tab', () => {
      expect(bannerActionFor('/membership')).toEqual({ kind: 'screen', screen: 'Membership' });
      expect(bannerActionFor('/notifications')).toEqual({ kind: 'screen', screen: 'Notifications' });
      expect(bannerActionFor('/home')).toEqual({ kind: 'tab', screen: 'Home' });
      expect(bannerActionFor('/matches')).toEqual({ kind: 'tab', screen: 'Matches' });
    });

    it('returns { kind: "none" } for empty or unmapped links', () => {
      expect(bannerActionFor('')).toEqual({ kind: 'none' });
      expect(bannerActionFor(null)).toEqual({ kind: 'none' });
      expect(bannerActionFor('/unknown-path')).toEqual({ kind: 'none' });
    });
  });
});
