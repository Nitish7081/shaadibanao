/**
 * BandhanSetu Brand Design Tokens (Blueprint v0.2)
 */

export const colors = {
  // Core Brand Colors
  royalMaroon: '#7A1F3D', // Primary brand, primary buttons, header accents
  softGold: '#C9A24B',    // Premium accent, highlights, upgrade moments
  ivory: '#FBF6EE',       // Screen background, warm cards
  charcoal: '#2B2B2B',    // Primary typography, high contrast text
  deepTeal: '#2F6F6B',    // Secondary actions, trust icons, informational badges
  verifiedGreen: '#2E7D32', // Verified badges, success indicators
  alertRed: '#B3261E',    // Errors, destructive actions (block/delete)
  warmGrey: '#E8E2D8',    // Borders, dividers, subtle outlines

  // Functional & Surface Variations
  background: '#FBF6EE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceCard: '#FDFBF7',
  
  // Text Colors
  textPrimary: '#2B2B2B',
  textSecondary: '#666666',
  textMuted: '#8E8E93',
  textLight: '#FFFFFF',
  textGold: '#C9A24B',
  textMaroon: '#7A1F3D',

  // Interactive States
  buttonPrimaryBg: '#7A1F3D',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: '#FFFFFF',
  buttonSecondaryBorder: '#7A1F3D',
  buttonSecondaryText: '#7A1F3D',
  buttonUpgradeBg: '#C9A24B',
  buttonUpgradeText: '#FFFFFF',

  // Borders & Dividers
  borderLight: '#E8E2D8',
  borderDefault: '#D8D0C5',
  borderFocus: '#7A1F3D',

  // Status Tints
  successBg: '#E8F5E9',
  successBorder: '#A5D6A7',
  errorBg: '#FFEBEE',
  errorBorder: '#EF9A9A',
  warningBg: '#FFF8E1',
  warningBorder: '#FFE082',
  infoBg: '#E0F2F1',
  infoBorder: '#80CBC4',
} as const;

export type Colors = typeof colors;
