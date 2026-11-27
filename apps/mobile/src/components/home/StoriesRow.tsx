import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { UserProfile, SearchResultProfile } from '@bandhansetu/shared';
import { GradientRingAvatar, PressableScale, Skeleton, AnimatedStaggerItem, ds } from '../../design';
import { photoSrc } from '../../services/cloudinaryUrl';
import { getInitials, getSafeMatchPhoto } from './matchPhoto';

interface Props {
  profile: UserProfile | null;
  userName: string;
  matches: SearchResultProfile[];
  loading: boolean;
  onYourProfilePress: () => void;
  onMatchPress: (match: SearchResultProfile) => void;
}

const SIZE = 68;
const PLACEHOLDERS = 4;

/** Instagram-style stories row: "Your profile" first, then today's matches (real photos only). */
export const StoriesRow: React.FC<Props> = ({
  profile,
  userName,
  matches,
  loading,
  onYourProfilePress,
  onMatchPress,
}) => {
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => new Set());
  const ownPhoto = profile?.photos?.find((p) => p.isMain && p.url) || profile?.photos?.find((p) => p.url);
  const completion = profile?.completenessPercent ?? 0;

  const handleMatchStoryPress = useCallback(
    (m: SearchResultProfile) => {
      setViewedIds((prev) => {
        if (prev.has(m.id)) return prev;
        const next = new Set(prev);
        next.add(m.id);
        return next;
      });
      onMatchPress(m);
    },
    [onMatchPress]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      <PressableScale
        onPress={onYourProfilePress}
        accessibilityRole="button"
        accessibilityLabel={completion < 100 ? 'Your profile, tap to complete it' : 'Your profile'}
        style={styles.item}
      >
        <GradientRingAvatar
          size={SIZE}
          uri={ownPhoto ? photoSrc(ownPhoto, 'avatar') : undefined}
          initials={getInitials(userName)}
          active={completion < 100}
          plus={completion < 100}
        />
        <Text style={styles.label} numberOfLines={1}>
          Your profile
        </Text>
      </PressableScale>

      {loading
        ? Array.from({ length: PLACEHOLDERS }).map((_, i) => (
            <View key={`sk-${i}`} style={styles.item}>
              <Skeleton width={SIZE} height={SIZE} radius={SIZE / 2} />
              <Skeleton width={46} height={12} style={{ marginTop: 8 }} />
            </View>
          ))
        : matches.length > 0
        ? matches.map((m, idx) => {
            const photo = getSafeMatchPhoto(m, 'avatar');
            const first = (m.displayName || 'Member').split(' ')[0];
            const isViewed = viewedIds.has(m.id);
            return (
              <AnimatedStaggerItem key={m.id} index={idx}>
                <PressableScale
                  onPress={() => handleMatchStoryPress(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${m.displayName || 'member'}`}
                  style={[styles.item, isViewed ? { opacity: 0.78 } : undefined]}
                >
                  <GradientRingAvatar
                    size={SIZE}
                    uri={photo?.uri}
                    blurred={photo?.blurred}
                    initials={getInitials(m.displayName)}
                    active={!isViewed}
                  />
                  <Text style={styles.label} numberOfLines={1}>
                    {first}
                  </Text>
                </PressableScale>
              </AnimatedStaggerItem>
            );
          })
        : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -ds.space.lg, marginBottom: ds.space.xl },
  row: { paddingHorizontal: ds.space.lg, gap: ds.space.lg },
  item: { alignItems: 'center', width: SIZE + 6 },
  label: { ...ds.type.caption, color: ds.color.text, marginTop: 6, maxWidth: SIZE + 6, textAlign: 'center' },
});
