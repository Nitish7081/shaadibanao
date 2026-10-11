import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      title: 'Verified profiles you can trust',
      description: 'Photo checks, ID badges, and a dedicated moderation team that reviews reports.',
      icon: '🛡️',
      tag: 'TRUST & SAFETY',
    },
    {
      title: 'Privacy control in your hands',
      description: 'You control who sees your photos, contact details, and horoscope background.',
      icon: '🔒',
      tag: 'PRIVACY BY DEFAULT',
    },
    {
      title: 'Kundli & Astrology guidance',
      description: 'Authentic Guna Milan calculations and verified astrologers for traditional guidance.',
      icon: '✨',
      tag: 'VEDIC GUIDANCE',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="BandhanSetu"
        subtitle="Where trust meets togetherness"
        onBack={() => navigation.navigate('LanguageSelection')}
        showStatusBadge={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Carousel Card */}
        <View style={styles.slideCard}>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{slides[activeSlide].tag}</Text>
          </View>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{slides[activeSlide].icon}</Text>
          </View>
          <Text style={styles.slideTitle}>{slides[activeSlide].title}</Text>
          <Text style={styles.slideDescription}>{slides[activeSlide].description}</Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {slides.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setActiveSlide(idx)}
                style={[
                  styles.sliderDot,
                  idx === activeSlide && styles.sliderDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Trust Badges Bar */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Text style={styles.trustCheck}>✓</Text>
            <Text style={styles.trustLabel}>100% Verified Profiles</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustCheck}>✓</Text>
            <Text style={styles.trustLabel}>Zero Spam Tolerance</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustCheck}>✓</Text>
            <Text style={styles.trustLabel}>Strict Privacy</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Button
            title="Create Free Account"
            onPress={() => navigation.navigate('LoginOtp')}
            variant="primary"
            style={styles.mainCta}
          />
          <Button
            title="I already have an account"
            onPress={() => navigation.navigate('LoginOtp')}
            variant="secondary"
            style={styles.secondaryCta}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs')}
            style={styles.browseButton}
          >
            <Text style={styles.browseText}>Browse profiles without login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  slideCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  tagBadge: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    marginBottom: spacing.md,
  },
  tagText: {
    fontSize: typography.fontSizes.xs - 2,
    fontWeight: '800',
    color: '#8D6E63',
    letterSpacing: 0.8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warmGrey,
  },
  iconText: {
    fontSize: 30,
  },
  slideTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: '700',
    color: colors.charcoal,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  slideDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sliderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warmGrey,
    marginHorizontal: spacing.xxs,
  },
  sliderDotActive: {
    backgroundColor: colors.royalMaroon,
    width: 20,
  },
  trustStrip: {
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  trustCheck: {
    color: colors.verifiedGreen,
    fontWeight: '800',
    marginRight: spacing.sm,
    fontSize: typography.fontSizes.sm,
  },
  trustLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.charcoal,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: spacing.xs,
  },
  mainCta: {
    marginBottom: spacing.sm,
  },
  secondaryCta: {
    marginBottom: spacing.md,
  },
  browseButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  browseText: {
    fontSize: typography.fontSizes.sm,
    color: colors.royalMaroon,
    fontWeight: '600',
  },
});
