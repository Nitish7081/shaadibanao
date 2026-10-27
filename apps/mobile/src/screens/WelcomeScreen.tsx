import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius, shadows, fonts } from '../constants/theme';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { VedicDivider } from '../components/royal/VedicOrnament';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      title: t('welcome.slide1Title'),
      description: t('welcome.slide1Desc'),
      icon: 'shield-checkmark' as const,
      tag: t('welcome.slide1Tag'),
    },
    {
      title: t('welcome.slide2Title'),
      description: t('welcome.slide2Desc'),
      icon: 'lock-closed' as const,
      tag: t('welcome.slide2Tag'),
    },
    {
      title: t('welcome.slide3Title'),
      description: t('welcome.slide3Desc'),
      icon: 'planet' as const,
      tag: t('welcome.slide3Tag'),
    },
  ];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <Header
        title="ShaadiBanao"
        subtitle={t('welcome.subtitle')}
        onBack={() => navigation.navigate('LanguageSelection')}
        showStatusBadge={true}
        variant="royal"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Carousel Card */}
        <View style={styles.slideCard}>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{slides[activeSlide].tag}</Text>
          </View>
          <View style={styles.iconCircle}>
            <Ionicons name={slides[activeSlide].icon} size={30} color={colors.royalMaroon} />
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

        <VedicDivider color="rgba(212, 175, 55, 0.4)" style={{ marginVertical: spacing.sm }} />

        {/* Trust Badges Bar */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Ionicons name="checkmark-circle" size={14} color={colors.royalGold} />
            <Text style={styles.trustLabel}>{t('welcome.trust1')}</Text>
          </View>
          <View style={styles.trustItem}>
            <Ionicons name="checkmark-circle" size={14} color={colors.royalGold} />
            <Text style={styles.trustLabel}>{t('welcome.trust2')}</Text>
          </View>
          <View style={styles.trustItem}>
            <Ionicons name="checkmark-circle" size={14} color={colors.royalGold} />
            <Text style={styles.trustLabel}>{t('welcome.trust3')}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Button
            title={t('welcome.createAccount')}
            onPress={() => navigation.navigate('LoginOtp')}
            variant="primary"
            style={styles.mainCta}
          />
          <Button
            title={t('welcome.haveAccount')}
            onPress={() => navigation.navigate('LoginOtp')}
            variant="secondary"
            style={styles.secondaryCta}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs')}
            style={styles.browseButton}
          >
            <Text style={styles.browseText}>{t('welcome.browse')} →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: 50,
  },
  slideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFE8DE',
    ...shadows.card,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  tagBadge: {
    backgroundColor: '#FAF5ED',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    marginBottom: spacing.md,
  },
  tagText: {
    fontSize: 10,
    fontFamily: fonts.headingBold,
    fontWeight: '800',
    color: '#8D6E63',
    letterSpacing: 0.8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FAF5ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.royalGold,
  },
  iconText: {
    fontSize: 28,
  },
  slideTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: fonts.headingBold,
    fontWeight: '800',
    color: colors.charcoal,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  slideDescription: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.bodyText,
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
    backgroundColor: '#E0D6C8',
    marginHorizontal: spacing.xxs,
  },
  sliderDotActive: {
    backgroundColor: colors.royalMaroon,
    width: 22,
  },
  trustStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EFE8DE',
    marginBottom: spacing.lg,
    ...shadows.subtle,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  trustCheck: {
    color: colors.verifiedGreen,
    fontWeight: '800',
    marginRight: spacing.sm,
    fontSize: 14,
  },
  trustLabel: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fonts.bodyMedium,
    color: colors.charcoal,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  actionContainer: {
    marginTop: spacing.xs,
  },
  mainCta: {
    marginBottom: spacing.sm,
    minHeight: 50,
    ...shadows.subtle,
  },
  secondaryCta: {
    marginBottom: spacing.md,
    minHeight: 50,
  },
  browseButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  browseText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fonts.bodySemiBold,
    color: colors.royalMaroon,
    fontWeight: '700',
  },
});
