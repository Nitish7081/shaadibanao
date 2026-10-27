import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale, ds } from '../../design';

interface Props {
  placeholder: string;
  onPress: () => void;
}

/** Rounded pill search entry (opens the Search screen) with a filter icon. */
export const SearchPill: React.FC<Props> = ({ placeholder, onPress }) => (
  <PressableScale
    onPress={onPress}
    scaleTo={0.98}
    accessibilityRole="search"
    accessibilityLabel="Search profiles by name, ID or city"
    style={styles.pill}
  >
    <Ionicons name="search-outline" size={20} color={ds.color.textMuted} />
    <Text style={styles.text} numberOfLines={1}>
      {placeholder}
    </Text>
    <View style={styles.filter}>
      <Ionicons name="options-outline" size={18} color={ds.color.maroon} />
    </View>
  </PressableScale>
);

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.space.sm,
    backgroundColor: ds.color.surface,
    borderRadius: ds.radius.pill,
    paddingLeft: ds.space.lg,
    paddingRight: 6,
    height: 52,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.xl,
    ...ds.shadow.soft,
  },
  text: { flex: 1, ...ds.type.body, color: ds.color.textMuted },
  filter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ds.color.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
