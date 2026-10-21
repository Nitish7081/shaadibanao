import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../constants/theme';
import { ShaadiBanaoLogo } from './ShaadiBanaoLogo';
import { BackendStatusBadge } from '../common/BackendStatusBadge';

interface BrandedHeaderProps {
  topInset?: number;
  userName?: string;
  hasNotifications?: boolean;
  /** Real backend account approval status (approved / pending / rejected / changes_requested). */
  accountStatus?: string;
  onNotificationsPress?: () => void;
  onAccountPress?: () => void;
  style?: ViewStyle;
}

const STATUS_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  approved: { label: 'Approved', icon: 'checkmark-circle', color: '#7BE0A0' },
  pending: { label: 'Pending Approval', icon: 'time', color: colors.brightGold },
  rejected: { label: 'Rejected', icon: 'close-circle', color: '#FF9A9A' },
  changes_requested: { label: 'Changes Requested', icon: 'create', color: colors.brightGold },
};

export const BrandedHeader: React.FC<BrandedHeaderProps> = ({
  topInset = 12,
  userName,
  hasNotifications = false,
  accountStatus,
  onNotificationsPress,
  onAccountPress,
  style,
}) => {
  const statusMeta = accountStatus ? STATUS_META[accountStatus] : undefined;
  return (
    <View style={[styles.headerContainer, { paddingTop: topInset }, style]}>
      {/* Delicate Golden Top Accent Bar */}
      <View style={styles.goldTopTrim} />

      <View style={styles.topRow}>
        {/* Brand Logo & Typography */}
        <View style={styles.brandGroup}>
          <ShaadiBanaoLogo size="medium" />

          <View style={styles.brandTextGroup}>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>ShaadiBanao</Text>
              <View style={styles.goldDot} />
            </View>
            <Text style={styles.brandTagline}>Rishton ki nayi shuruaat</Text>
          </View>
        </View>

        {/* Right Actions: Live Backend Status + Notification Bell */}
        <View style={styles.rightActionsGroup}>
          <BackendStatusBadge compact={true} dark={true} />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onNotificationsPress}
            style={styles.notificationBtn}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
            {hasNotifications && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Auspicious Vedic Greeting Ribbon */}
      {userName && (
        <View style={styles.greetingStrip}>
          <View style={styles.greetingTextWrap}>
            <Text style={styles.greetingText}>
              Namaste, <Text style={styles.greetingHighlight}>{userName}</Text>
            </Text>
            <Text style={styles.greetingSubtext}>
              May today bring auspicious matches & harmonious unions
            </Text>
          </View>
          {statusMeta && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onAccountPress}
              disabled={!onAccountPress}
              style={styles.statusChip}
              accessibilityRole="button"
              accessibilityLabel={`Account status: ${statusMeta.label}`}
            >
              <Ionicons name={statusMeta.icon} size={13} color={statusMeta.color} />
              <Text style={[styles.statusChipText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Delicate Golden Bottom Accent Line */}
      <View style={styles.goldBottomTrim} />
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: colors.royalMaroon,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.hero,
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
    left: '15%',
    right: '15%',
    height: 1.5,
    backgroundColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTextGroup: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brightGold,
    marginLeft: 3,
    marginBottom: 2,
  },
  brandTagline: {
    fontSize: 11,
    color: colors.lightGold,
    fontStyle: 'italic',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  rightActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.roseAccent,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  greetingStrip: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  greetingTextWrap: {
    flexDirection: 'column',
    flex: 1,
  },
  greetingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFDF9',
  },
  greetingHighlight: {
    fontWeight: '800',
    color: colors.brightGold,
  },
  greetingSubtext: {
    fontSize: 11,
    color: colors.lightGold,
    marginTop: 2,
    opacity: 0.9,
  },
});
