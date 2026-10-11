import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, borderRadius } from '../../constants/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'goldAccent';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'elevated' }) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return styles.outlinedCard;
      case 'goldAccent':
        return styles.goldAccentCard;
      case 'elevated':
      default:
        return styles.elevatedCard;
    }
  };

  return <View style={[styles.baseCard, getVariantStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  baseCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  elevatedCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  outlinedCard: {
    borderWidth: 1.2,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceCard,
  },
  goldAccentCard: {
    borderWidth: 1.5,
    borderColor: colors.softGold,
    backgroundColor: colors.surfaceCard,
  },
});
