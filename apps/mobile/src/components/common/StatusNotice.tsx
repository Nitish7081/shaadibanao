import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, fonts } from '../../constants/theme';

interface StatusNoticeProps {
  milestoneText: string;
  subtext?: string;
}

/**
 * Refined royal info note (ivory card with gold accent) used for contextual
 * guidance banners across screens.
 */
export const StatusNotice: React.FC<StatusNoticeProps> = ({ milestoneText, subtext }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="information-circle" size={18} color={colors.goldMuted} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.milestoneText}>{milestoneText}</Text>
        {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FBF6EA',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.royalGold,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  iconWrap: {
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
  },
  milestoneText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.deepMaroon,
    marginBottom: 2,
  },
  subtext: {
    fontFamily: fonts.bodyRegular,
    fontSize: typography.fontSizes.xs,
    color: colors.bodyText,
    lineHeight: 16,
  },
});
