import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, ds } from '../../design';

/** Placeholder for the matches feed while data loads (no blank gaps). */
export const FeedSkeleton: React.FC = () => (
  <View accessibilityLabel="Loading matches">
    {[0, 1].map((i) => (
      <View key={i} style={styles.card}>
        <Skeleton height={260} radius={ds.radius.lg} />
        <Skeleton width="55%" height={20} style={{ marginTop: ds.space.md }} />
        <Skeleton width="80%" height={14} style={{ marginTop: ds.space.sm }} />
        <Skeleton width="40%" height={14} style={{ marginTop: ds.space.sm }} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: ds.color.surface,
    borderRadius: ds.radius.xl,
    padding: ds.space.sm + 2,
    paddingBottom: ds.space.lg,
    marginBottom: ds.space.lg,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
});
