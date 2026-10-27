import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { ds } from './tokens';

type IconName = keyof typeof Ionicons.glyphMap;

interface ChipProps {
  label: string;
  icon?: IconName;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** Small rounded status / info chip. */
export const Chip: React.FC<ChipProps> = ({
  label,
  icon,
  color = ds.color.textBody,
  bg = ds.color.surfaceWarm,
  style,
  onPress,
  accessibilityLabel,
}) => {
  const body = (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}>
      {body}
    </PressableScale>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  style,
}) => (
  <View style={[styles.sectionRow, style]}>
    <View style={{ flex: 1 }}>
      <Text accessibilityRole="header" style={ds.type.h2}>
        {title}
      </Text>
      {subtitle ? <Text style={[ds.type.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
    {actionLabel && onActionPress ? (
      <PressableScale onPress={onActionPress} accessibilityRole="button" hitSlop={10}>
        <Text style={styles.sectionAction}>{actionLabel}</Text>
      </PressableScale>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: ds.radius.pill,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: ds.font.bodySemiBold, fontSize: 12, lineHeight: 16 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ds.space.md,
  },
  sectionAction: { fontFamily: ds.font.bodySemiBold, fontSize: 14, color: ds.color.maroon },
});
