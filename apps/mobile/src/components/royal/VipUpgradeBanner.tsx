import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';

interface VipUpgradeBannerProps {
  onUpgradePress: () => void;
  style?: ViewStyle;
}

export const VipUpgradeBanner: React.FC<VipUpgradeBannerProps> = ({
  onUpgradePress,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={styles.vipBadge}>
          <Ionicons name="ribbon" size={13} color="#540917" />
          <Text style={styles.vipBadgeText}>VIP MEMBERSHIP</Text>
        </View>
      </View>

      <Text style={styles.title}>Direct Contact & Horoscope Matching</Text>
      <Text style={styles.desc}>
        Upgrade to Plus or Premium for verified phone numbers, direct chatting, and in-depth Ashta Koota reports.
      </Text>

      <TouchableOpacity
        style={styles.upgradeBtn}
        activeOpacity={0.85}
        onPress={onUpgradePress}
        accessibilityRole="button"
        accessibilityLabel="Explore Membership Plans"
      >
        <Text style={styles.upgradeBtnText}>Explore Membership Plans →</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FAF5ED',
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.royalGold,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.royalGold,
    borderRadius: borderRadius.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#540917',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.deepMaroon,
    marginTop: spacing.xs,
  },
  desc: {
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.9,
  },
  upgradeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.royalMaroon,
    borderRadius: borderRadius.full,
    paddingVertical: 9,
    paddingHorizontal: 18,
    marginTop: spacing.md,
    ...shadows.subtle,
  },
  upgradeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
