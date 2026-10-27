import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale, ds } from '../../design';
import { HeroArt } from './HeroArt';

interface Props {
  onExplorePress: () => void;
}

export const HeroBanner: React.FC<Props> = ({ onExplorePress }) => (
  <LinearGradient
    colors={ds.gradient.hero}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.card}
  >
    <View style={styles.art} pointerEvents="none">
      <HeroArt size={190} />
    </View>
    {/* gradient overlay keeps the text readable over the artwork */}
    <LinearGradient
      colors={['rgba(84,9,23,0.88)', 'rgba(84,9,23,0.55)', 'rgba(84,9,23,0)']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
    <View style={styles.content}>
      <Text style={styles.kicker}>VEDIC SANATAN MATCHMAKING</Text>
      <Text accessibilityRole="header" style={styles.headline}>
        Aapke perfect rishte ki shuruaat yahan se
      </Text>
      <PressableScale
        onPress={onExplorePress}
        accessibilityRole="button"
        accessibilityLabel="Explore Matches"
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Explore Matches</Text>
        <Ionicons name="arrow-forward" size={16} color={ds.color.deepMaroon} />
      </PressableScale>
    </View>
  </LinearGradient>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: ds.radius.xl,
    overflow: 'hidden',
    minHeight: 190,
    marginBottom: ds.space.lg,
    ...ds.shadow.lift,
  },
  art: { position: 'absolute', right: -24, bottom: -14, opacity: 0.95 },
  content: { padding: ds.space.xl, maxWidth: '78%' },
  kicker: { fontFamily: ds.font.bodySemiBold, fontSize: 12, color: '#F9D976', letterSpacing: 1.2 },
  headline: {
    fontFamily: ds.font.headingBold,
    fontSize: 21,
    lineHeight: 28,
    color: '#FFFFFF',
    marginTop: ds.space.sm,
    marginBottom: ds.space.lg,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#F9D976',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: ds.radius.pill,
    minHeight: 44,
  },
  ctaText: { fontFamily: ds.font.bodyBold, fontSize: 14, color: ds.color.deepMaroon },
});
