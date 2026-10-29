import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../navigation/types';
import { ds, PressableScale } from '../design';
import { VedicDivider } from '../components/royal/VedicOrnament';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
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
    <SafeAreaView edges={['top']} style={styles.screenBg}>
      {/* Top Language & Brand Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandTitleRow}>
          <Text maxFontSizeMultiplier={1.2} style={styles.brandTitle}>
            BandhanSetu
          </Text>
          <View style={styles.sanatanBadge}>
            <Text maxFontSizeMultiplier={1.2} style={styles.sanatanBadgeText}>
              Sanatan
            </Text>
          </View>
        </View>

        <PressableScale
          style={styles.langPill}
          onPress={() => navigation.navigate('LanguageSelection', { fromSettings: true })}
        >
          <Ionicons name="language" size={15} color={ds.color.maroon} />
          <Text maxFontSizeMultiplier={1.2} style={styles.langPillText}>
            भाषा / Lang
          </Text>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 30, 50) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Kicker */}
        <View style={styles.heroHeader}>
          <Text maxFontSizeMultiplier={1.2} style={styles.heroKicker}>
            VEDIC MATRIMONY & SACRED BONDS
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.heroHeadline}>
            {t('welcome.subtitle')}
          </Text>
        </View>

        {/* Feature Slides Carousel Card */}
        <View style={styles.slideCard}>
          <View style={styles.tagBadge}>
            <Text maxFontSizeMultiplier={1.2} style={styles.tagText}>
              {slides[activeSlide].tag}
            </Text>
          </View>

          <LinearGradient
            colors={['#FFF6E8', '#FFEECF']}
            style={styles.iconCircle}
          >
            <Ionicons
              name={slides[activeSlide].icon}
              size={32}
              color={ds.color.maroon}
            />
          </LinearGradient>

          <Text maxFontSizeMultiplier={1.2} style={styles.slideTitle}>
            {slides[activeSlide].title}
          </Text>

          <Text maxFontSizeMultiplier={1.2} style={styles.slideDescription}>
            {slides[activeSlide].description}
          </Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {slides.map((_, idx) => (
              <PressableScale
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

        <VedicDivider color="rgba(212, 175, 55, 0.4)" style={{ marginVertical: ds.space.md }} />

        {/* Trust Badges Bar */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Ionicons name="checkmark-circle" size={16} color={ds.color.goldDeep} />
            <Text maxFontSizeMultiplier={1.2} style={styles.trustLabel}>
              {t('welcome.trust1')}
            </Text>
          </View>

          <View style={styles.trustItem}>
            <Ionicons name="checkmark-circle" size={16} color={ds.color.goldDeep} />
            <Text maxFontSizeMultiplier={1.2} style={styles.trustLabel}>
              {t('welcome.trust2')}
            </Text>
          </View>

          <View style={styles.trustItem}>
            <Ionicons name="checkmark-circle" size={16} color={ds.color.goldDeep} />
            <Text maxFontSizeMultiplier={1.2} style={styles.trustLabel}>
              {t('welcome.trust3')}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <PressableScale
            style={styles.primaryActionBtn}
            onPress={() => navigation.navigate('LoginOtp')}
          >
            <LinearGradient
              colors={['#7A1528', '#9B1D36']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryGradient}
            >
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
              <Text maxFontSizeMultiplier={1.2} style={styles.primaryBtnText}>
                {t('welcome.createAccount')}
              </Text>
            </LinearGradient>
          </PressableScale>

          <PressableScale
            style={styles.secondaryActionBtn}
            onPress={() => navigation.navigate('LoginOtp')}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.secondaryBtnText}>
              {t('welcome.haveAccount')}
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => navigation.navigate('MainTabs')}
            style={styles.browseButton}
          >
            <Text maxFontSizeMultiplier={1.2} style={styles.browseText}>
              {t('welcome.browse')} →
            </Text>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ds.space.md,
    paddingVertical: ds.space.sm,
    backgroundColor: ds.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.border,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: -0.3,
  },
  sanatanBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sanatanBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.color.surfaceWarm,
    borderWidth: 1,
    borderColor: ds.color.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: ds.color.maroon,
  },
  scrollContent: {
    paddingHorizontal: ds.space.md,
    paddingTop: ds.space.md,
  },
  heroHeader: {
    alignItems: 'center',
    marginBottom: ds.space.md,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: ds.color.goldDeep,
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroHeadline: {
    fontSize: 18,
    fontWeight: '800',
    color: ds.color.text,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: ds.space.sm,
  },
  slideCard: {
    backgroundColor: ds.color.surface,
    borderRadius: 24,
    padding: ds.space.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ds.color.border,
    ...ds.shadow.soft,
    marginBottom: ds.space.xs,
  },
  tagBadge: {
    backgroundColor: ds.color.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: ds.space.md,
    borderWidth: 1,
    borderColor: ds.color.border,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: ds.color.maroon,
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ds.space.md,
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ds.color.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  slideDescription: {
    fontSize: 13,
    color: ds.color.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: ds.space.md,
    marginBottom: ds.space.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sliderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ds.color.border,
  },
  sliderDotActive: {
    width: 22,
    backgroundColor: ds.color.maroon,
  },
  trustStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: ds.color.surfaceWarm,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: ds.space.md,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.lg,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ds.color.text,
  },
  actionContainer: {
    gap: 12,
  },
  primaryActionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...ds.shadow.soft,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ds.color.surface,
    borderWidth: 1.5,
    borderColor: ds.color.border,
    borderRadius: 16,
    paddingVertical: 13,
  },
  secondaryBtnText: {
    color: ds.color.maroon,
    fontSize: 14,
    fontWeight: '700',
  },
  browseButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  browseText: {
    fontSize: 13,
    color: ds.color.textMuted,
    fontWeight: '600',
  },
});
