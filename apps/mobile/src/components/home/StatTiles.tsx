import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale, ds } from '../../design';

type IconName = keyof typeof Ionicons.glyphMap;

interface TileProps {
  icon: IconName;
  tint: string;
  tintSoft: string;
  value: number;
  label: string;
  emptyHint: string;
  onPress: () => void;
}

const StatTile: React.FC<TileProps> = ({ icon, tint, tintSoft, value, label, emptyHint, onPress }) => (
  <PressableScale
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={value > 0 ? `${value} ${label}` : `${label}. ${emptyHint}`}
    style={styles.tile}
  >
    <View style={[styles.icon, { backgroundColor: tintSoft }]}>
      <Ionicons name={icon} size={18} color={tint} />
    </View>
    {value > 0 ? (
      <Text style={[styles.value, { color: tint }]} maxFontSizeMultiplier={1.2}>{value}</Text>
    ) : (
      <Text style={styles.hint} numberOfLines={2} maxFontSizeMultiplier={1.2}>
        {emptyHint}
      </Text>
    )}
    <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.2}>
      {label}
    </Text>
  </PressableScale>
);

interface Props {
  newInterests: number;
  mutualMatches: number;
  messages: number;
  onInterestsPress: () => void;
  onMatchesPress: () => void;
  onMessagesPress: () => void;
}

export const StatTiles: React.FC<Props> = ({
  newInterests,
  mutualMatches,
  messages,
  onInterestsPress,
  onMatchesPress,
  onMessagesPress,
}) => (
  <View style={styles.row}>
    <StatTile
      icon="heart-outline"
      tint={ds.color.rose}
      tintSoft={ds.color.roseSoft}
      value={newInterests}
      label="New Interests"
      emptyHint="Send your first interest"
      onPress={onInterestsPress}
    />
    <StatTile
      icon="sparkles-outline"
      tint={ds.color.goldDeep}
      tintSoft={ds.color.goldSoft}
      value={mutualMatches}
      label="Mutual Matches"
      emptyHint="Matches show up here"
      onPress={onMatchesPress}
    />
    <StatTile
      icon="chatbubble-ellipses-outline"
      tint="#0369A1"
      tintSoft="#E0F2FE"
      value={messages}
      label="Messages"
      emptyHint="Start a conversation"
      onPress={onMessagesPress}
    />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ds.space.md, marginBottom: ds.space.xl },
  tile: {
    flex: 1,
    minHeight: 118,
    backgroundColor: ds.color.surface,
    borderRadius: ds.radius.lg,
    padding: ds.space.md,
    borderWidth: 1,
    borderColor: ds.color.border,
    ...ds.shadow.soft,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: ds.font.headingBold, fontSize: 26, lineHeight: 32, marginTop: ds.space.sm },
  hint: { ...ds.type.bodyStrong, fontSize: 13, lineHeight: 17, marginTop: ds.space.sm, minHeight: 34 },
  label: { ...ds.type.caption, marginTop: 2 },
});
