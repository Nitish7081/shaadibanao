import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceModuleCard } from './ServiceModuleCard';
import { SERVICE_MODULES } from '../../constants/serviceModules';
import { colors, spacing } from '../../constants/theme';

export interface ExploreServicesGridProps {
  onFindMatchPress: () => void;
  onKundliMilanPress: () => void;
  onBookPanditPress: () => void;
  onMuhuratFinderPress: () => void;
  onAstrologyPress: () => void;
  onCommunityPress: () => void;
  onMessagesPress: () => void;
  onMyProfilePress: () => void;
  newInterestsCount?: number;
  unreadMessagesCount?: number;
  profileCompletionPercent?: number;
  isIdentityVerified?: boolean;
  style?: ViewStyle;
}

export const ExploreServicesGrid: React.FC<ExploreServicesGridProps> = ({
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
  style,
}) => {
  // Badges computed from authentic backend states
  const findMatchBadge =
    newInterestsCount > 0 ? `${newInterestsCount} New` : undefined;

  const messagesBadge =
    unreadMessagesCount > 0 ? `${unreadMessagesCount} New` : undefined;

  const profileBadge = isIdentityVerified
    ? 'Verified'
    : profileCompletionPercent > 0
    ? `${profileCompletionPercent}% Done`
    : undefined;

  return (
    <View style={[styles.container, style]}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="sparkles" size={15} color={colors.royalGold} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Explore Services</Text>
            <Text style={styles.sectionSubtitle}>
              Vedic matrimony, astrology & sacred rituals
            </Text>
          </View>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>8 Modules</Text>
        </View>
      </View>

      {/* Row 1: Find Your Match (Rose & Maroon) + Kundli Milan (Purple & Lavender) */}
      <View style={styles.row}>
        <ServiceModuleCard
          module={SERVICE_MODULES.find_match}
          badge={findMatchBadge}
          onPress={onFindMatchPress}
        />
        <ServiceModuleCard
          module={SERVICE_MODULES.kundli_milan}
          onPress={onKundliMilanPress}
        />
      </View>

      {/* Row 2: Book a Pandit (Saffron & Gold) + Muhurat Finder (Teal & Emerald) */}
      <View style={styles.row}>
        <ServiceModuleCard
          module={SERVICE_MODULES.book_pandit}
          onPress={onBookPanditPress}
        />
        <ServiceModuleCard
          module={SERVICE_MODULES.muhurat_finder}
          onPress={onMuhuratFinderPress}
        />
      </View>

      {/* Row 3: Astrology (Indigo & Violet) + Community (Coral & Pink) */}
      <View style={styles.row}>
        <ServiceModuleCard
          module={SERVICE_MODULES.astrology}
          onPress={onAstrologyPress}
        />
        <ServiceModuleCard
          module={SERVICE_MODULES.community}
          onPress={onCommunityPress}
        />
      </View>

      {/* Row 4: Messages (Sky Blue & Navy) + My Profile (Burgundy & Champagne Gold) */}
      <View style={styles.row}>
        <ServiceModuleCard
          module={SERVICE_MODULES.messages}
          badge={messagesBadge}
          onPress={onMessagesPress}
        />
        <ServiceModuleCard
          module={SERVICE_MODULES.my_profile}
          badge={profileBadge}
          onPress={onMyProfilePress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 4,
    paddingHorizontal: 2,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF2E2',
    borderWidth: 1,
    borderColor: '#F0DEC0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.1,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: '#F8F1E7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: '#EBDDC9',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.royalMaroon,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
});
