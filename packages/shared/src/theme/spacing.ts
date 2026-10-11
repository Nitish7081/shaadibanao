/**
 * BandhanSetu Spacing Tokens (4px / 8px grid system)
 * Touch targets are guaranteed to be at least 44px as required by blueprint
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  base: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const minTouchTarget = 44; // Minimum 44px touch target requirement from blueprint

export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
