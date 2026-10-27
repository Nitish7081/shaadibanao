import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale, SectionHeader, ds } from '../../design';
import { SERVICE_MODULES, ServiceModuleId } from '../../constants/serviceModules';
import type { ExploreServicesGridProps } from '../royal/ExploreServicesGrid';

type IconName = keyof typeof Ionicons.glyphMap;

// One consistent rounded outline icon set (Ionicons) for all 8 modules.
const MODULE_ICON: Record<ServiceModuleId, IconName> = {
  find_match: 'heart-outline',
  kundli_milan: 'planet-outline',
  book_pandit: 'flame-outline',
  muhurat_finder: 'calendar-outline',
  astrology: 'sparkles-outline',
  community: 'people-outline',
  messages: 'chatbubbles-outline',
  my_profile: 'person-circle-outline',
};

interface CardProps {
  id: ServiceModuleId;
  badge?: string;
  onPress: () => void;
}

const ServiceCard: React.FC<CardProps> = ({ id, badge, onPress }) => {
  const m = SERVICE_MODULES[id];
  const shownBadge = badge || m.defaultBadge;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={m.accessibilityLabel}
      accessibilityHint={`Navigates to ${m.title}`}
      style={styles.card}
    >
      <View style={styles.cardTop}>
        <LinearGradient
          colors={[m.bgColor, m.iconBg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircle}
        >
          <Ionicons name={MODULE_ICON[id]} size={24} color={m.accentColor} />
        </LinearGradient>
        {shownBadge ? (
          <View style={[styles.badge, { backgroundColor: m.badgeBg }]}>
            <Text style={[styles.badgeText, { color: m.badgeColor }]} numberOfLines={1}>
              {shownBadge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {m.title}
      </Text>
      <Text style={styles.desc} numberOfLines={2}>
        {m.description}
      </Text>
      <View style={[styles.arrow, { backgroundColor: m.iconBg }]}>
        <Ionicons name="arrow-forward" size={14} color={m.primaryColor} />
      </View>
    </PressableScale>
  );
};

/** Explore Services: all 8 modules, 2-column grid, each with its own accent colour. */
export const ServiceGrid: React.FC<ExploreServicesGridProps> = ({
  onFindMatchPress,
  onKundliMilanPress,
  onBookPanditPress,
  onMuhuratFinderPress,
  onAstrologyPress,
  onCommunityPress,
  onMessagesPress,
  onMyProfilePress,
  newInterestsCount = 0,
  unreadMessagesCount = 0,
  profileCompletionPercent = 0,
  isIdentityVerified = false,
}) => {
  // Badges come only from real backend state (same rules as the previous Home).
  const findMatchBadge = newInterestsCount > 0 ? `${newInterestsCount} New` : undefined;
  const messagesBadge = unreadMessagesCount > 0 ? `${unreadMessagesCount} New` : undefined;
  const profileBadge = isIdentityVerified
    ? 'Verified'
    : profileCompletionPercent > 0
    ? `${profileCompletionPercent}% Done`
    : undefined;

  const rows: Array<[CardProps, CardProps]> = [
    [
      { id: 'find_match', badge: findMatchBadge, onPress: onFindMatchPress },
      { id: 'kundli_milan', onPress: onKundliMilanPress },
    ],
    [
      { id: 'book_pandit', onPress: onBookPanditPress },
      { id: 'muhurat_finder', onPress: onMuhuratFinderPress },
    ],
    [
      { id: 'astrology', onPress: onAstrologyPress },
      { id: 'community', onPress: onCommunityPress },
    ],
    [
      { id: 'messages', badge: messagesBadge, onPress: onMessagesPress },
      { id: 'my_profile', badge: profileBadge, onPress: onMyProfilePress },
    ],
  ];

  return (
    <View style={{ marginBottom: ds.space.xl }}>
      <SectionHeader title="Explore Services" subtitle="Matrimony, astrology & sacred rituals" />
      {rows.map((pair, i) => (
        <View key={i} style={styles.row}>
          {pair.map((c) => (
            <ServiceCard key={c.id} {...c} />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ds.space.md, marginBottom: ds.space.md },
  card: {
    flex: 1,
    minHeight: 150,
    backgroundColor: ds.color.surface,
    borderRadius: ds.radius.lg,
    padding: ds.space.md + 2,
    borderWidth: 1,
    borderColor: ds.color.border,
    ...ds.shadow.soft,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: ds.radius.pill, maxWidth: '55%' },
  badgeText: { fontFamily: ds.font.bodySemiBold, fontSize: 12, lineHeight: 16 },
  title: { ...ds.type.h3, marginTop: ds.space.md },
  desc: { ...ds.type.body, fontSize: 13, lineHeight: 18, marginTop: 2, paddingRight: 26 },
  arrow: {
    position: 'absolute',
    right: ds.space.md,
    bottom: ds.space.md,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
