import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

export type BadgeVariant = 'verified' | 'photoChecked' | 'match' | 'gold' | 'warning' | 'alert' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
  icon,
}) => {
  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'verified':
        return styles.verifiedContainer;
      case 'photoChecked':
        return styles.tealContainer;
      case 'match':
        return styles.matchContainer;
      case 'gold':
        return styles.goldContainer;
      case 'warning':
        return styles.warningContainer;
      case 'alert':
        return styles.alertContainer;
      case 'neutral':
      default:
        return styles.neutralContainer;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'verified':
        return styles.verifiedText;
      case 'photoChecked':
        return styles.tealText;
      case 'match':
        return styles.matchText;
      case 'gold':
        return styles.goldText;
      case 'warning':
        return styles.warningText;
      case 'alert':
        return styles.alertText;
      case 'neutral':
      default:
        return styles.neutralText;
    }
  };

  return (
    <View style={[styles.baseContainer, getContainerStyle(), style]}>
      {icon && <Text style={[styles.icon, getTextStyle()]}>{icon} </Text>}
      <Text style={[styles.baseText, getTextStyle(), textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  baseText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    lineHeight: 15,
  },
  icon: {
    fontSize: typography.fontSizes.xs,
    marginRight: 2,
    lineHeight: 15,
  },
  verifiedContainer: {
    backgroundColor: colors.successBg,
    borderColor: colors.verifiedGreen,
    borderWidth: 1,
  },
  verifiedText: {
    color: colors.verifiedGreen,
  },
  tealContainer: {
    backgroundColor: colors.infoBg,
    borderColor: colors.deepTeal,
    borderWidth: 1,
  },
  tealText: {
    color: colors.deepTeal,
  },
  matchContainer: {
    backgroundColor: '#EBF4F3',
    borderColor: colors.deepTeal,
    borderWidth: 1,
  },
  matchText: {
    color: colors.deepTeal,
    fontWeight: '600',
  },
  goldContainer: {
    backgroundColor: colors.warningBg,
    borderColor: colors.softGold,
    borderWidth: 1,
  },
  goldText: {
    color: '#8A6D3B',
    fontWeight: '700',
  },
  warningContainer: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
    borderWidth: 1,
  },
  warningText: {
    color: '#F57F17',
    fontWeight: '700',
  },
  alertContainer: {
    backgroundColor: colors.errorBg,
    borderColor: colors.alertRed,
    borderWidth: 1,
  },
  alertText: {
    color: colors.alertRed,
  },
  neutralContainer: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDefault,
    borderWidth: 1,
  },
  neutralText: {
    color: colors.charcoal,
  },
});
