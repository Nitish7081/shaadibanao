import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SearchResultProfile } from '@bandhansetu/shared';
import { PressableScale, Chip, ds } from '../../design';
import { formatHeight, getInitials, getSafeMatchPhoto } from './matchPhoto';

interface Props {
  match: SearchResultProfile;
  onPress: () => void;
}

/** Instagram-feed style match card: large rounded photo, verified badge, key facts, CTA. */
export const FeedMatchCard: React.FC<Props> = ({ match, onPress }) => {
  const [failed, setFailed] = useState(false);
  const name = match.displayName || 'Member';
  const photo = getSafeMatchPhoto(match, 'card');
  const showPhoto = !!photo && !failed;
  const height = formatHeight(match.heightCm);
  const facts = [height, match.education].filter(Boolean).join(' • ');
  const place = [match.city, match.state].filter(Boolean).join(', ');
  const score = match.matchAlignment?.scoreText || '';

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`View biodata of ${name}`}
      style={styles.card}
    >
      <View style={styles.photoWrap}>
        {showPhoto ? (
          <Image
            source={{ uri: photo!.uri }}
            style={styles.photo}
            blurRadius={photo!.blurred ? 28 : 0}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <LinearGradient colors={['#FFF1D6', '#FBE3E9']} style={[styles.photo, styles.noPhoto]}>
            <Text style={styles.bigInitials}>{getInitials(name) || '?'}</Text>
          </LinearGradient>
        )}

        {match.isVerified ? (
          <View style={styles.verified}>
            <Ionicons name="shield-checkmark" size={14} color={ds.color.green} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : null}

        {showPhoto && photo!.blurred ? (
          <View style={styles.privateTag}>
            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
            <Text style={styles.privateText}>Photo is private</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {match.age ? <Text style={styles.age}>{match.age} yrs</Text> : null}
        </View>

        {facts ? <Text style={styles.line}>{facts}</Text> : null}
        {match.occupation ? (
          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={15} color={ds.color.maroon} />
            <Text style={styles.line} numberOfLines={1}>
              {match.occupation}
            </Text>
          </View>
        ) : null}
        {place ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={15} color={ds.color.goldDeep} />
            <Text style={styles.line} numberOfLines={1}>
              {place}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          {score ? (
            <Chip label={score} icon="sparkles" color="#8A6715" bg={ds.color.goldSoft} style={{ flexShrink: 1 }} />
          ) : (
            <View />
          )}
          <View style={styles.cta}>
            <Text style={styles.ctaText}>View Biodata</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: ds.color.surface,
    borderRadius: ds.radius.xl,
    marginBottom: ds.space.lg,
    borderWidth: 1,
    borderColor: ds.color.border,
    overflow: 'hidden',
    ...ds.shadow.lift,
  },
  photoWrap: { padding: ds.space.sm },
  photo: { width: '100%', aspectRatio: 1, borderRadius: ds.radius.lg + 2 },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  bigInitials: { fontFamily: ds.font.headingBold, fontSize: 64, color: ds.color.maroon, opacity: 0.85 },
  verified: {
    position: 'absolute',
    top: ds.space.lg,
    left: ds.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: ds.radius.pill,
  },
  verifiedText: { fontFamily: ds.font.bodySemiBold, fontSize: 12, color: ds.color.green },
  privateTag: {
    position: 'absolute',
    bottom: ds.space.lg,
    left: ds.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: ds.radius.pill,
  },
  privateText: { fontFamily: ds.font.bodySemiBold, fontSize: 12, color: '#FFFFFF' },
  body: { paddingHorizontal: ds.space.lg, paddingBottom: ds.space.lg, paddingTop: ds.space.xs },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: ds.space.sm },
  name: { ...ds.type.h2, flexShrink: 1 },
  age: { ...ds.type.bodyStrong, color: ds.color.textMuted },
  line: { ...ds.type.body, flexShrink: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ds.space.sm,
    marginTop: ds.space.md,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: ds.color.maroon,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: ds.radius.pill,
    minHeight: 44,
  },
  ctaText: { fontFamily: ds.font.bodyBold, fontSize: 14, color: '#FFFFFF' },
});
