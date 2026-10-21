import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, shadows, fonts } from '../../constants/theme';
import { BackendStatusBadge } from './BackendStatusBadge';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  showStatusBadge?: boolean;
  variant?: 'royal' | 'surface';
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  showStatusBadge = true,
  variant = 'royal',
  style,
}) => {
  const isRoyal = variant === 'royal';

  return (
    <View style={[styles.container, isRoyal ? styles.royalContainer : styles.surfaceContainer, style]}>
      {isRoyal && <View style={styles.goldTopTrim} />}

      <View style={styles.leftRow}>
        {onBack && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.backButton, isRoyal && styles.royalBackButton]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={isRoyal ? '#FFFFFF' : colors.royalMaroon}
            />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, isRoyal ? styles.royalTitle : styles.surfaceTitle]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, isRoyal ? styles.royalSubtitle : styles.surfaceSubtitle]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightRow}>
        {rightAction}
        {showStatusBadge && <BackendStatusBadge compact={true} dark={isRoyal} />}
      </View>

      {isRoyal && <View style={styles.goldBottomTrim} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  royalContainer: {
    backgroundColor: colors.royalMaroon,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    ...shadows.hero,
  },
  surfaceContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  goldTopTrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.royalGold,
  },
  goldBottomTrim: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 1.5,
    backgroundColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: 6,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  royalBackButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: typography.fontSizes.base,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  royalTitle: {
    color: '#FFFFFF',
  },
  surfaceTitle: {
    color: colors.royalMaroon,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: typography.fontSizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  royalSubtitle: {
    color: colors.lightGold,
  },
  surfaceSubtitle: {
    color: colors.textSecondary,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.xs,
  },
});
