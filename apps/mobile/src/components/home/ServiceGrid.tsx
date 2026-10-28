import React from 'react';
import { View, Text, StyleSheet, Dimensions, useWindowDimensions } from 'react-native';
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

/** Max multiplier for card text – prevents large system font from breaking the 2-col grid. */
const TEXT_MAX_SCALE = 1.2;

interface CardProps {
  id: ServiceModuleId;
  badge?: string;
  onPress: () => void;
  cardWidth: number;
}

const ServiceCard: React.FC<CardProps> = ({ id, badge, onPress, cardWidth }) => {
  const m = SERVICE_MODULES[id];
  const shownBadge = badge || m.defaultBadge;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={m.accessibilityLabel}
      accessibilityHint={`Navigates to ${m.title}`}
      style={[styles.card, { width: cardWidth }]}
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
            <Text
              style={[styles.badgeText, { color: m.badgeColor }]}
              numberOfLines={1}
              maxFontSizeMultiplier={TEXT_MAX_SCALE}
            >
              {shownBadge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={styles.title}
        numberOfLines={1}
        maxFontSizeMultiplier={TEXT_MAX_SCALE}
      >
        {m.title}
      </Text>
      <Text
        style={styles.desc}
        numberOfLines={2}
        ellipsizeMode="tail"
        maxFontSizeMultiplier={TEXT_MAX_SCALE}
      >
        {m.description}
      </Text>
      <View style={[styles.arrow, { backgroundColor: m.iconBg }]}>
        <Ionicons name="arrow-forward" size={14} color={m.primaryColor} />
      </View>
    </PressableScale>
  );
};

/** Explore Services: all 8 modules, exactly 2 equal-width columns, no horizontal overflow. */
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
  // Compute exact card width so 2 cards + 1 gap exactly fill the parent.
  // Parent ScrollView has paddingHorizontal = ds.space.lg (16) on each side.
  const { width: screenWidth } = useWindowDimensions();
  const parentPad = ds.space.lg * 2; // 16 left + 16 right
  const gap = ds.space.md;           // 12px gap between the 2 cards
  const cardWidth = Math.floor((screenWidth - parentPad - gap) / 2);

  // Badges come only from real backend state.
  const findMatchBadge = newInterestsCount > 0 ? `${newInterestsCount} New` : undefined;
  const messagesBadge = unreadMessagesCount > 0 ? `${unreadMessagesCount} New` : undefined;
  const profileBadge = isIdentityVerified
    ? 'Verified'
    : profileCompletionPercent > 0
    ? `${profileCompletionPercent}% Done`
    : undefined;

  const rows: Array<[CardProps, CardProps]> = [
    [
      { id: 'find_match', badge: findMatchBadge, onPress: onFindMatchPress, cardWidth },
      { id: 'kundli_milan', onPress: onKundliMilanPress, cardWidth },
    ],
    [
      { id: 'book_pandit', onPress: onBookPanditPress, cardWidth },
      { id: 'muhurat_finder', onPress: onMuhuratFinderPress, cardWidth },
    ],
    [
      { id: 'astrology', onPress: onAstrologyPress, cardWidth },
      { id: 'community', onPress: onCommunityPress, cardWidth },
    ],
    [
      { id: 'messages', badge: messagesBadge, onPress: onMessagesPress, cardWidth },
      { id: 'my_profile', badge: profileBadge, onPress: onMyProfilePress, cardWidth },
    ],
  ];

  return (
    <View style={styles.container}>
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
  container: {
    marginBottom: ds.space.xl,
    // Prevent any child from overflowing horizontally
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: ds.space.md,
    marginBottom: ds.space.md,
    // Never allow children to stretch beyond this row
    overflow: 'hidden',
  },
  card: {
    // width is set dynamically via cardWidth prop — do NOT use flex:1 here
    // because flex:1 can produce unequal widths when combined with gap on Android.
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
