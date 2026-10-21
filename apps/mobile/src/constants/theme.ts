import { colors as baseColors, typography, spacing, borderRadius, minTouchTarget } from '@bandhansetu/shared';

export const colors = {
  ...baseColors,
  // Premium Royal Indian Matrimony Palette
  royalMaroon: '#7A1528',      // Rich vermilion-maroon (wedding primary)
  deepMaroon: '#540917',       // Deepest ceremonial burgundy
  brightCrimson: '#9B1D36',    // Festive vibrant crimson
  royalGold: '#D4AF37',        // Auspicious ceremonial gold
  brightGold: '#F5C542',       // Vibrant golden star
  lightGold: '#F9ECC7',        // Soft champagne gold
  goldBorder: '#E5C985',       // Delicate gold trim
  goldMuted: '#B89240',        // Subdued gold text
  ivory: '#FDFBF7',            // Warm royal ivory background
  ivoryLight: '#FFFDF9',       // Clean card surface
  cardBg: '#FFFFFF',           // Crisp white surface
  cardBorder: '#F0E6D8',       // Subtle warm border
  roseTint: '#FFF0F5',         // Soft romantic rose tint
  roseBorder: '#FAD2E1',       // Rose outline
  roseAccent: '#D8315B',       // Accent for interests & love
  charcoal: '#1A1817',         // Deep charcoal headline text
  bodyText: '#4A4644',         // Readable body text
  textMuted: '#8A8480',        // Subtle caption text
  verifiedGreen: '#1B8738',    // Verified trust green
  verifiedBadgeBg: '#E9F7EC',  // Verified badge container
  alertRed: '#C92A2A',         // Alert & error red
  shadowColor: '#540917',      // Warm tinted shadow
};

export const shadows = {
  subtle: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  card: {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  hero: {
    shadowColor: colors.deepMaroon,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  goldGlow: {
    shadowColor: colors.royalGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const fonts = {
  // Headings (Poppins)
  headingRegular: 'Poppins_400Regular',
  headingMedium: 'Poppins_500Medium',
  headingSemiBold: 'Poppins_600SemiBold',
  headingBold: 'Poppins_700Bold',
  headingExtraBold: 'Poppins_800ExtraBold',
  // Body & Forms (Inter)
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const typographyStyles = {
  heading1: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.charcoal,
    letterSpacing: -0.3,
  },
  heading2: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.charcoal,
    letterSpacing: -0.2,
  },
  heading3: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16.5,
    lineHeight: 22,
    color: colors.charcoal,
    letterSpacing: 0,
  },
  subheading: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.bodyText,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.bodyText,
  },
  bodySmall: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.charcoal,
    letterSpacing: 0.1,
  },
  button: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  helperText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textMuted,
  },
  errorText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.alertRed,
  },
};

export const theme = {
  colors,
  shadows,
  fonts,
  typography,
  typographyStyles,
  spacing,
  borderRadius,
  minTouchTarget,
};

export type Theme = typeof theme;
export { typography, spacing, borderRadius, minTouchTarget };
