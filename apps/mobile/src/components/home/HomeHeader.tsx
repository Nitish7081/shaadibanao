import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShaadiBanaoLogo } from '../royal/ShaadiBanaoLogo';
import { BackendStatusBadge } from '../common/BackendStatusBadge';
import { PressableScale, Chip, ds } from '../../design';

interface Props {
  topInset: number;
  userName: string;
  hasNotifications: boolean;
  /** approved / pending / rejected / changes_requested (real backend value) */
  accountStatus?: string;
  onNotificationsPress: () => void;
  onAccountPress: () => void;
}

const STATUS_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  approved: { label: 'Approved', icon: 'checkmark-circle', color: ds.color.green, bg: ds.color.greenSoft },
  pending: { label: 'Pending Approval', icon: 'time', color: '#9A6A00', bg: '#FFF3D1' },
  rejected: { label: 'Rejected', icon: 'close-circle', color: '#B42318', bg: '#FDE7E4' },
  changes_requested: { label: 'Changes Requested', icon: 'create', color: '#9A6A00', bg: '#FFF3D1' },
};

export const HomeHeader: React.FC<Props> = ({
  topInset,
  userName,
  hasNotifications,
  accountStatus,
  onNotificationsPress,
  onAccountPress,
}) => {
  const status = accountStatus ? STATUS_META[accountStatus] : undefined;
  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <ShaadiBanaoLogo size="medium" />
          <Text style={styles.brandName}>ShaadiBanao</Text>
        </View>
        <PressableScale
          onPress={onNotificationsPress}
          accessibilityRole="button"
          accessibilityLabel={hasNotifications ? 'Notifications, you have new activity' : 'Notifications'}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={22} color={ds.color.text} />
          {hasNotifications ? <View style={styles.badgeDot} /> : null}
        </PressableScale>
      </View>

      <Text style={styles.greeting} numberOfLines={1}>
        Namaste, <Text style={styles.greetingName}>{userName}</Text>
      </Text>

      <View style={styles.chipRow}>
        <BackendStatusBadge compact />
        {status ? (
          <Chip
            label={status.label}
            icon={status.icon}
            color={status.color}
            bg={status.bg}
            onPress={onAccountPress}
            accessibilityLabel={`Account status: ${status.label}`}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: ds.color.bg,
    paddingHorizontal: ds.space.lg,
    paddingBottom: ds.space.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: ds.space.sm },
  brandName: { fontFamily: ds.font.headingBold, fontSize: 20, color: ds.color.maroon, letterSpacing: -0.2 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ds.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ds.color.border,
    ...ds.shadow.soft,
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ds.color.rose,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  greeting: { ...ds.type.h1, marginTop: ds.space.md },
  greetingName: { color: ds.color.maroon },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: ds.space.sm, marginTop: ds.space.sm, flexWrap: 'wrap' },
});
