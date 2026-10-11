import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

interface StatusNoticeProps {
  milestoneText: string;
  subtext?: string;
}

export const StatusNotice: React.FC<StatusNoticeProps> = ({
  milestoneText,
  subtext = 'UI blueprint preview rendered. Backend API integration scheduled for subsequent milestone.',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>UI PREVIEW</Text>
      <Text style={styles.milestoneText}>{milestoneText}</Text>
      <Text style={styles.subtext}>{subtext}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderLeftWidth: 4,
    borderLeftColor: colors.deepTeal,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.deepTeal,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  milestoneText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: 2,
  },
  subtext: {
    fontSize: typography.fontSizes.xs - 1,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
