import { colors, fonts } from '../constants/theme';

/**
 * Phase 3 design system tokens. Brand colours (maroon + gold) are used as accents;
 * surfaces are warm cream / white with soft shadows and generous spacing.
 */
export const ds = {
  color: {
    bg: '#FFFAF2', // warm cream
    surface: '#FFFFFF',
    surfaceWarm: '#FFF6E8',
    border: '#F1E6D6',
    text: colors.charcoal,
    textBody: '#3F3A37', // >= 9:1 contrast on cream
    textMuted: '#6B645F', // >= 5:1 contrast on cream/white
    maroon: colors.royalMaroon,
    deepMaroon: colors.deepMaroon,
    gold: colors.royalGold,
    goldDeep: '#A87B14',
    goldSoft: colors.lightGold,
    rose: colors.roseAccent,
    roseSoft: '#FFE9EF',
    green: colors.verifiedGreen,
    greenSoft: '#E6F6EA',
    white: '#FFFFFF',
    skeleton: '#F0E7DA',
    skeletonHi: '#F8F1E6',
  },
  gradient: {
    goldRing: ['#F9D976', '#D4AF37', '#B8741A', '#D8315B'] as const,
    goldRingIdle: ['#EFE3CC', '#E6D6B8'] as const,
    hero: ['#7A1528', '#9B1D36', '#C2410C'] as const,
    vip: ['#F5D77A', '#D4AF37', '#A87B14'] as const,
    progress: ['#D4AF37', '#D8315B'] as const,
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { md: 16, lg: 20, xl: 24, pill: 999 },
  font: fonts,
  type: {
    h1: { fontFamily: fonts.headingBold, fontSize: 24, lineHeight: 30, color: colors.charcoal },
    h2: { fontFamily: fonts.headingBold, fontSize: 19, lineHeight: 25, color: colors.charcoal },
    h3: { fontFamily: fonts.headingSemiBold, fontSize: 16, lineHeight: 22, color: colors.charcoal },
    body: { fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 20, color: '#3F3A37' },
    bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20, color: colors.charcoal },
    caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: '#6B645F' },
  },
  shadow: {
    soft: {
      shadowColor: '#3B1A10',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
    lift: {
      shadowColor: '#3B1A10',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
      elevation: 8,
    },
  },
} as const;

export type Gradient2 = readonly [string, string];
