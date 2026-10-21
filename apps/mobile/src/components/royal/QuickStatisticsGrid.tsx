import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../constants/theme';

interface QuickStatisticsGridProps {
  newInterests: number;
  mutualMatches: number;
  messages: number;
  onInterestsPress: () => void;
  onMatchesPress: () => void;
  onMessagesPress: () => void;
  style?: ViewStyle;
}

export const QuickStatisticsGrid: React.FC<QuickStatisticsGridProps> = ({
  newInterests,
  mutualMatches,
  messages,
  onInterestsPress,
  onMatchesPress,
  onMessagesPress,
  style,
}) => {
  return (
    <View style={[styles.grid, style]}>
      {/* 1. New Interests Card */}
      <TouchableOpacity
        style={[styles.statBox, styles.statBoxRose]}
        activeOpacity={0.8}
        onPress={onInterestsPress}
        accessibilityRole="button"
        accessibilityLabel={`${newInterests} new interests`}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#FFE4EC' }]}>
          <Ionicons name="heart" size={17} color={colors.roseAccent} />
        </View>
        <Text style={[styles.statNumber, { color: colors.roseAccent }]}>
          {newInterests}
        </Text>
        <Text style={styles.statLabel}>New Interests</Text>
      </TouchableOpacity>

      {/* 2. Mutual Matches Card */}
      <TouchableOpacity
        style={[styles.statBox, styles.statBoxGold]}
        activeOpacity={0.8}
        onPress={onMatchesPress}
        accessibilityRole="button"
        accessibilityLabel={`${mutualMatches} mutual matches`}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#F9ECC7' }]}>
          <Ionicons name="sparkles" size={17} color={colors.royalGold} />
        </View>
        <Text style={[styles.statNumber, { color: '#99731E' }]}>
          {mutualMatches}
        </Text>
        <Text style={styles.statLabel}>Mutual Matches</Text>
      </TouchableOpacity>

      {/* 3. Messages Card */}
      <TouchableOpacity
        style={[styles.statBox, styles.statBoxTeal]}
        activeOpacity={0.8}
        onPress={onMessagesPress}
        accessibilityRole="button"
        accessibilityLabel={`${messages} messages`}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#E0F2F1' }]}>
          <Ionicons name="chatbubbles" size={17} color={colors.deepTeal} />
        </View>
        <Text style={[styles.statNumber, { color: colors.deepTeal }]}>
          {messages}
        </Text>
        <Text style={styles.statLabel}>Messages</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.base,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...shadows.subtle,
  },
  statBoxRose: {
    backgroundColor: colors.roseTint,
    borderColor: colors.roseBorder,
  },
  statBoxGold: {
    backgroundColor: '#FAF6ED',
    borderColor: colors.goldBorder,
  },
  statBoxTeal: {
    backgroundColor: '#F0F7F6',
    borderColor: '#CBE5E2',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.charcoal,
    marginTop: 2,
    textAlign: 'center',
  },
});
