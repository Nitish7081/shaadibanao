import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';
import { VedicCornerMotif } from './VedicOrnament';

interface PremiumHeroBannerProps {
  onExplorePress: () => void;
  style?: ViewStyle;
}

export const PremiumHeroBanner: React.FC<PremiumHeroBannerProps> = ({
  onExplorePress,
  style,
}) => {
  return (
    <View style={[styles.heroBanner, style]}>
      {/* Decorative Warm Radial Glow Circles */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      {/* Decorative Subtle Corner Mandalas */}
      <VedicCornerMotif size={22} color="rgba(212, 175, 55, 0.4)" style={styles.cornerTL} />
      <VedicCornerMotif size={22} color="rgba(212, 175, 55, 0.4)" style={styles.cornerBR} />

      {/* Auspicious Vedic Tag */}
      <View style={styles.badgeRow}>
        <View style={styles.badgeContainer}>
          <Ionicons name="sparkles" size={11} color={colors.brightGold} />
          <Text style={styles.badgeText}>VEDIC SANATAN MATCHMAKING</Text>
        </View>
      </View>

      {/* Royal Headline with Exact Tagline */}
      <Text style={styles.headline}>
        Aapke perfect rishte ki shuruaat yahan se
      </Text>

      <Text style={styles.subheadline}>
        Discover profiles from families who share your traditions, values & aspirations.
      </Text>

      {/* Functional Explore Matches CTA Button */}
      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={onExplorePress}
        accessibilityRole="button"
        accessibilityLabel="Explore Matches"
      >
        <Text style={styles.ctaButtonText}>Explore Matches</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.deepMaroon} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  heroBanner: {
    backgroundColor: colors.deepMaroon,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.royalGold,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.hero,
  },
  glowTopRight: {
    position: 'absolute',
    top: -35,
    right: -35,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(216, 49, 91, 0.12)',
  },
  cornerTL: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    transform: [{ rotate: '180deg' }],
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 0.8,
    borderColor: colors.royalGold,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brightGold,
    letterSpacing: 0.6,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: spacing.xs,
    letterSpacing: 0.2,
    lineHeight: 26,
  },
  subheadline: {
    fontSize: 12,
    color: colors.lightGold,
    marginTop: 6,
    lineHeight: 18,
    opacity: 0.95,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.royalGold,
    borderRadius: borderRadius.full,
    paddingVertical: 9,
    paddingHorizontal: 18,
    marginTop: spacing.md,
    gap: 6,
    ...shadows.goldGlow,
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.deepMaroon,
    letterSpacing: 0.3,
  },
});
