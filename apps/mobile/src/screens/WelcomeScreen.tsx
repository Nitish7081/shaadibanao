import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { APP_LANGUAGES, AppLanguageCode } from '@bandhansetu/shared';
import { Button } from '../components/common/Button';
import { BackendStatusBadge } from '../components/common/BackendStatusBadge';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSkip: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted, onSkip }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguageCode>('en');
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      title: 'Verified profiles you can trust',
      description: 'Photo checks, ID badges, and a dedicated team that reviews reports.',
      icon: '🛡️',
    },
    {
      title: 'Privacy control in your hands',
      description: 'You control who sees your photos, contact details, and family background.',
      icon: '🔒',
    },
    {
      title: 'Kundli & Astrology guidance',
      description: 'Authentic Guna Milan calculations and verified astrologers for traditional guidance.',
      icon: '✨',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <BackendStatusBadge />
        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Language Selection Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose your language</Text>
          <Text style={styles.sectionSubtitle}>You can change this anytime later in settings</Text>
        </View>

        <View style={styles.languageGrid}>
          {APP_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                activeOpacity={0.7}
                onPress={() => setSelectedLanguage(lang.code)}
                style={[
                  styles.languageChip,
                  isSelected && styles.languageChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.languageChipText,
                    isSelected && styles.languageChipTextSelected,
                  ]}
                >
                  {lang.label}
                </Text>
                <Text
                  style={[
                    styles.languageNativeText,
                    isSelected && styles.languageNativeTextSelected,
                  ]}
                >
                  {lang.native}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feature Highlights Card Carousel */}
        <View style={styles.slideCard}>
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

        {/* Trust Strip */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Text style={styles.trustDot}>✓</Text>
            <Text style={styles.trustLabel}>Verified</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustDot}>✓</Text>
            <Text style={styles.trustLabel}>Private</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustDot}>✓</Text>
            <Text style={styles.trustLabel}>Reviewed</Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <Button title="Get Started" onPress={onGetStarted} variant="primary" />
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  skipText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '600',
    color: colors.royalMaroon,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: spacing.xxs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  languageChip: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1.2,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  languageChipSelected: {
    backgroundColor: colors.royalMaroon,
    borderColor: colors.royalMaroon,
  },
  languageChipText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: '600',
    color: colors.charcoal,
  },
  languageChipTextSelected: {
    color: '#FFFFFF',
  },
  languageNativeText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  languageNativeTextSelected: {
    color: colors.warmGrey,
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
    shadowRadius: 4,
    elevation: 2,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warmGrey,
  },
  iconText: {
    fontSize: 28,
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
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.warmGrey,
    marginHorizontal: spacing.xxs,
  },
  sliderDotActive: {
    backgroundColor: colors.royalMaroon,
    width: 18,
    borderRadius: 4,
  },
  trustStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustDot: {
    color: colors.verifiedGreen,
    fontWeight: '700',
    marginRight: spacing.xs,
    fontSize: typography.fontSizes.sm,
  },
  trustLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: '600',
    color: colors.charcoal,
  },
  actionContainer: {
    marginTop: spacing.sm,
  },
});
