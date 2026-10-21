import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';

interface EmptyMatchesStateProps {
  onSearchPress: () => void;
  style?: ViewStyle;
}

export const EmptyMatchesState: React.FC<EmptyMatchesStateProps> = ({
  onSearchPress,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name="flower-outline" size={28} color={colors.royalMaroon} />
      </View>

      <Text style={styles.title}>No matches to show yet</Text>
      <Text style={styles.subtext}>
        We could not find profiles to recommend right now. Adjust your filters or browse the complete directory.
      </Text>

      <TouchableOpacity
        style={styles.searchBtn}
        activeOpacity={0.85}
        onPress={onSearchPress}
        accessibilityRole="button"
        accessibilityLabel="Search All Profiles"
      >
        <Ionicons name="search" size={15} color="#FFFFFF" />
        <Text style={styles.searchBtnText}>Search All Profiles</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFE8DE',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FAF5ED',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.charcoal,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 12,
    color: colors.bodyText,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.royalMaroon,
    borderRadius: borderRadius.full,
    paddingVertical: 9,
    paddingHorizontal: 22,
    ...shadows.subtle,
  },
  searchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
