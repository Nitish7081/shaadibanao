import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { colors, spacing, borderRadius, minTouchTarget, typography, fonts } from '../../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'upgrade' | 'text';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryContainer;
      case 'upgrade':
        return styles.upgradeContainer;
      case 'text':
        return styles.textOnlyContainer;
      case 'primary':
      default:
        return styles.primaryContainer;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'upgrade':
        return styles.upgradeText;
      case 'text':
        return styles.textOnlyText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.baseContainer,
        getContainerStyle(),
        (disabled || loading) && styles.disabledContainer,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'text' ? colors.royalMaroon : '#FFFFFF'}
        />
      ) : (
        <Text style={[styles.baseText, getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    minHeight: 48, // 48dp standard touch target
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryContainer: {
    backgroundColor: colors.royalMaroon,
  },
  secondaryContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.royalMaroon,
  },
  upgradeContainer: {
    backgroundColor: colors.softGold,
  },
  textOnlyContainer: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  disabledContainer: {
    opacity: 0.5,
  },
  baseText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: typography.fontSizes.base,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: colors.royalMaroon,
  },
  upgradeText: {
    color: colors.royalMaroon,
    fontWeight: '700',
  },
  textOnlyText: {
    color: colors.royalMaroon,
    textDecorationLine: 'underline',
  },
});
