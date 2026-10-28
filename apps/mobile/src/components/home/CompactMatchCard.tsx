import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SearchResultProfile } from '@bandhansetu/shared';
import { PressableScale, ds } from '../../design';
import { getInitials, getSafeMatchPhoto } from './matchPhoto';

interface Props {
  match: SearchResultProfile;
  onPress: () => void;
  width?: number;
}

export const CompactMatchCard: React.FC<Props> = ({ match, onPress, width }) => {
  const [failed, setFailed] = useState(false);
  const name = match.displayName || 'Member';
  const photo = getSafeMatchPhoto(match, 'card');
  const showPhoto = !!photo && !failed;

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = width || Math.min(290, Math.max(240, Math.round(screenWidth * 0.68)));
  const score = match.matchAlignment?.scoreText || '';
  const locationAndProfession = [match.occupation, match.city].filter(Boolean).join(' • ');

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={`View biodata of ${name}`}
      style={[styles.card, { width: cardWidth }]}
    >
      {/* 4:5 Aspect Ratio Photo Container */}
      <View style={styles.photoContainer}>
        {showPhoto ? (
          <Image
            source={{ uri: photo!.uri }}
            style={styles.photo}
            blurRadius={photo!.blurred ? 24 : 0}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <LinearGradient
            colors={['#540917', '#801026']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.photo, styles.noPhoto]}
          >
            <Text style={styles.initialsText}>{getInitials(name) || '?'}</Text>
          </LinearGradient>
        )}

        {/* Bottom subtle gradient shadow on photo */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top Badges */}
        <View style={styles.topBadgeRow}>
          {match.isVerified ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#10B981" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : <View />}

          {score ? (
            <View style={styles.scoreBadge}>
              <Ionicons name="sparkles" size={11} color="#C9A24B" />
              <Text style={styles.scoreText} numberOfLines={1}>
                {score.length > 18 ? score.slice(0, 16) + '…' : score}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Private photo indicator */}
        {showPhoto && photo!.blurred ? (
          <View style={styles.privateTag}>
            <Ionicons name="lock-closed" size={11} color="#FFFFFF" />
            <Text style={styles.privateText}>Private</Text>
          </View>
        ) : null}
      </View>

      {/* Profile Information */}
      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {match.age ? <Text style={styles.age}>, {match.age}</Text> : null}
        </View>

        {locationAndProfession ? (
          <Text style={styles.metaText} numberOfLines={1}>
            {locationAndProfession}
          </Text>
        ) : null}

        {/* View Biodata CTA Tap Area */}
        <View style={styles.ctaRow}>
          <Text style={styles.ctaLabel}>View Biodata</Text>
          <Ionicons name="arrow-forward" size={14} color={ds.color.maroon} />
        </View>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ds.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(84,9,23,0.08)',
    ...ds.shadow.lift,
    marginRight: 12,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#F7F3EE',
    position: 'relative',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  noPhoto: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontFamily: ds.font.headingBold,
    fontSize: 42,
    color: '#F9D976',
    letterSpacing: 2,
  },
  topBadgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ds.radius.pill,
  },
  verifiedText: {
    fontFamily: ds.font.bodySemiBold,
    fontSize: 11,
    color: '#065F46',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(42,14,24,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ds.radius.pill,
    maxWidth: '55%',
  },
  scoreText: {
    fontFamily: ds.font.bodySemiBold,
    fontSize: 10,
    color: '#F9D976',
  },
  privateTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ds.radius.pill,
  },
  privateText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 10,
    color: '#FFFFFF',
  },
  infoSection: {
    padding: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  name: {
    fontFamily: ds.font.headingBold,
    fontSize: 16,
    color: ds.color.deepMaroon,
    flexShrink: 1,
  },
  age: {
    fontFamily: ds.font.headingMedium,
    fontSize: 15,
    color: ds.color.textMuted,
  },
  metaText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0EAE1',
  },
  ctaLabel: {
    fontFamily: ds.font.bodyBold,
    fontSize: 12,
    color: ds.color.maroon,
  },
});
