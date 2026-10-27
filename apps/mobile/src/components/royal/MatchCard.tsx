import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchResultProfile } from '@bandhansetu/shared';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';
import { cloudinaryUrl } from '../../services/cloudinaryUrl';

interface MatchCardProps {
  match: SearchResultProfile;
  onPress: () => void;
  style?: ViewStyle;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress, style }) => {
  const [imageError, setImageError] = React.useState(false);
  const displayName = match.displayName || 'Member';
  const locationStr = [match.city, match.state].filter(Boolean).join(', ');
  const professionStr = match.occupation || '';
  const educationStr = match.education || '';
  const mainPhotoObj =
    match.photos?.find((p: any) => p.isMain && p.url) || match.photos?.find((p: any) => !!p.url);
  const mainPhoto = mainPhotoObj?.url;
  // Server sends a blurred URL (or no URL) for locked photos; blur again as a safety net.
  const photoBlurred = mainPhotoObj?.isBlurred === true;
  const initials = displayName.slice(0, 2).toUpperCase();
  const matchScore = match.matchAlignment?.scoreText || '';

  const totalInches = match.heightCm ? Math.round(match.heightCm / 2.54) : 0;
  const heightStr = totalInches
    ? `${Math.floor(totalInches / 12)}'${totalInches % 12}"`
    : null;
  const subline = [heightStr, educationStr].filter(Boolean).join(' • ');

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.card, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View biodata of ${displayName}`}
    >
      <View style={styles.headerRow}>
        {/* Avatar / Photo with Gold Rim */}
        <View style={styles.avatarWrap}>
          {mainPhoto && !imageError ? (
            <Image
              source={{ uri: cloudinaryUrl(mainPhoto, 'card') }}
              style={styles.avatarImg}
              blurRadius={photoBlurred ? 12 : 0}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.avatarInitialsBox}>
              <Text style={styles.avatarInitialsText}>{initials}</Text>
            </View>
          )}

          {match.isVerified && (
            <View style={styles.avatarVerifiedBadge}>
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Profile Key Attributes */}
        <View style={styles.detailsCol}>
          <View style={styles.nameLine}>
            <Text style={styles.nameText} numberOfLines={1}>
              {displayName}
            </Text>
            {match.age ? <Text style={styles.ageText}>{match.age} yrs</Text> : null}
          </View>

          {subline ? (
            <Text style={styles.subline} numberOfLines={1}>
              {subline}
            </Text>
          ) : null}

          {professionStr ? (
            <View style={styles.infoLine}>
              <Ionicons name="briefcase-outline" size={13} color={colors.royalMaroon} />
              <Text style={styles.infoText} numberOfLines={1}>
                {professionStr}
              </Text>
            </View>
          ) : null}

          {locationStr ? (
            <View style={styles.infoLine}>
              <Ionicons name="location-outline" size={13} color={colors.royalGold} />
              <Text style={styles.infoText} numberOfLines={1}>
                {locationStr}
              </Text>
            </View>
          ) : null}

          {/* Verification badges: rendered only when backend flags are true */}
          {(match.isVerified || match.photoChecked) && (
            <View style={styles.badgesRow}>
              {match.isVerified && (
                <View style={styles.verifiedPill}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.verifiedGreen} />
                  <Text style={styles.verifiedPillText}>Verified ID</Text>
                </View>
              )}

              {match.photoChecked && (
                <View style={styles.photoCheckedPill}>
                  <Ionicons name="camera" size={11} color={colors.deepTeal} />
                  <Text style={styles.photoCheckedPillText}>Photo Checked</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footerRow}>
        {matchScore ? (
          <View style={styles.matchScorePill}>
            <Ionicons name="sparkles" size={11} color="#99731E" />
            <Text style={styles.matchScoreText}>{matchScore}</Text>
          </View>
        ) : (
          <View />
        )}

        <View style={styles.viewBiodataRow}>
          <Text style={styles.viewBiodataText}>View Biodata</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.royalMaroon} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#EFE8DE',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.royalGold,
  },
  avatarInitialsBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FAF5ED',
    borderWidth: 2,
    borderColor: colors.royalGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.royalMaroon,
  },
  avatarVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.verifiedGreen,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCol: {
    flex: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.charcoal,
    flexShrink: 1,
  },
  ageText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  subline: {
    fontSize: 12,
    color: colors.bodyText,
    marginTop: 2,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  infoText: {
    fontSize: 12,
    color: colors.bodyText,
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.verifiedBadgeBg,
    borderRadius: borderRadius.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  verifiedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.verifiedGreen,
  },
  photoCheckedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2F1',
    borderRadius: borderRadius.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  photoCheckedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.deepTeal,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F5EFEB',
  },
  matchScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF5ED',
    borderRadius: borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  matchScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A6715',
  },
  viewBiodataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewBiodataText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.royalMaroon,
  },
});
