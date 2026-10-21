import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';

interface HomeSearchBarProps {
  onPress: () => void;
  placeholder?: string;
  style?: ViewStyle;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({
  onPress,
  placeholder = 'Search by name, profile ID, or city...',
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.searchBar, style]}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search profiles by name, ID or city"
    >
      <View style={styles.leftRow}>
        <Ionicons name="search" size={18} color={colors.royalMaroon} style={styles.icon} />
        <Text style={styles.placeholderText} numberOfLines={1}>
          {placeholder}
        </Text>
      </View>

      <View style={styles.filterChip}>
        <Ionicons name="options-outline" size={15} color={colors.royalMaroon} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: '#EFE6D8',
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  icon: {
    marginRight: spacing.sm,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
    flex: 1,
  },
  filterChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8DEC8',
  },
});
