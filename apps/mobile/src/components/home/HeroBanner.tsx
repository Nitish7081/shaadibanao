import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { HomeBanner } from '@bandhansetu/shared';
import { PressableScale, ds } from '../../design';
import { cloudinaryUrl } from '../../services/cloudinaryUrl';
import { HeroArt } from './HeroArt';

interface Props {
  banners?: HomeBanner[];
  loading?: boolean;
  onBannerPress?: (banner: HomeBanner) => void;
  onExplorePress: () => void;
}

export const HeroBanner: React.FC<Props> = ({ banners, loading = false, onBannerPress, onExplorePress }) => {
  const { t } = useTranslation();
  const [cardWidth, setCardWidth] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const scrollRef = useRef<ScrollView>(null);

  const activeBanners = Array.isArray(banners)
    ? banners.filter((b) => !!b && typeof b.imageUrl === 'string' && b.imageUrl)
    : [];

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== cardWidth) {
      setCardWidth(w);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth <= 0) return;
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / cardWidth);
    if (idx !== activeIndex && idx >= 0 && idx < activeBanners.length) {
      setActiveIndex(idx);
    }
  };

  // Auto-rotating timer (5-second interval) for multiple banners
  useEffect(() => {
    if (activeBanners.length <= 1 || cardWidth <= 0) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % activeBanners.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [activeBanners.length, cardWidth]);

  // Loading Skeleton State
  if (loading && activeBanners.length === 0) {
    return (
      <View style={[styles.card, styles.skeletonCard]}>
        <LinearGradient
          colors={['#2A0E18', '#3D1524', '#2A0E18']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.skeletonContent}>
          <ActivityIndicator size="small" color="#F9D976" style={{ marginBottom: 8 }} />
          <Text style={styles.skeletonText}>{t('home.hero.kicker') || 'Loading special offers...'}</Text>
        </View>
      </View>
    );
  }

  // Fallback: Built-in Vedic Sanatan artwork when 0 active banners exist
  if (activeBanners.length === 0) {
    return (
      <LinearGradient
        colors={ds.gradient.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.art} pointerEvents="none">
          <HeroArt size={135} />
        </View>
        <LinearGradient
          colors={['rgba(84,9,23,0.88)', 'rgba(84,9,23,0.55)', 'rgba(84,9,23,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.content}>
          <Text style={styles.kicker}>{t('home.hero.kicker')}</Text>
          <Text accessibilityRole="header" style={styles.headline}>
            {t('home.hero.headline')}
          </Text>
          <PressableScale
            onPress={onExplorePress}
            accessibilityRole="button"
            accessibilityLabel={t('home.hero.cta')}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{t('home.hero.cta')}</Text>
            <Ionicons name="arrow-forward" size={16} color={ds.color.deepMaroon} />
          </PressableScale>
        </View>
      </LinearGradient>
    );
  }

  // Single admin banner
  if (activeBanners.length === 1) {
    const banner = activeBanners[0];
    const handlePress = () => {
      if (onBannerPress) onBannerPress(banner);
      else onExplorePress();
    };

    return (
      <PressableScale
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={banner.title || t('home.hero.cta')}
        style={styles.card}
      >
        <Image
          source={{ uri: cloudinaryUrl(banner.imageUrl, 'hero') }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(84,9,23,0.75)', 'rgba(84,9,23,0.92)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.content, styles.bannerContent]}>
          {!!banner.title && (
            <Text accessibilityRole="header" style={styles.bannerHeadline} numberOfLines={2}>
              {banner.title}
            </Text>
          )}
          <View style={styles.bannerCtaRow}>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>{t('home.hero.cta')}</Text>
              <Ionicons name="arrow-forward" size={16} color={ds.color.deepMaroon} />
            </View>
          </View>
        </View>
      </PressableScale>
    );
  }

  // Multiple admin banners: Auto-rotating Carousel with Dots
  return (
    <View style={styles.card} onLayout={handleLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
      >
        {activeBanners.map((banner) => {
          const handlePress = () => {
            if (onBannerPress) onBannerPress(banner);
            else onExplorePress();
          };

          return (
            <PressableScale
              key={banner.id}
              onPress={handlePress}
              accessibilityRole="button"
              accessibilityLabel={banner.title || t('home.hero.cta')}
              style={{ width: cardWidth || 340, height: '100%' }}
            >
              <Image
                source={{ uri: cloudinaryUrl(banner.imageUrl, 'hero') }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.05)', 'rgba(84,9,23,0.70)', 'rgba(84,9,23,0.92)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={[styles.content, styles.bannerContent]}>
                {!!banner.title && (
                  <Text accessibilityRole="header" style={styles.bannerHeadline} numberOfLines={2}>
                    {banner.title}
                  </Text>
                )}
                <View style={styles.bannerCtaRow}>
                  <View style={styles.cta}>
                    <Text style={styles.ctaText}>{t('home.hero.cta')}</Text>
                    <Ionicons name="arrow-forward" size={16} color={ds.color.deepMaroon} />
                  </View>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Dots Indicator */}
      <View style={styles.dotsRow} pointerEvents="none">
        {activeBanners.map((b, i) => (
          <View
            key={b.id}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: ds.radius.xl,
    overflow: 'hidden',
    height: 145,
    marginBottom: ds.space.md,
    position: 'relative',
    ...ds.shadow.lift,
  },
  skeletonCard: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A0E18',
  },
  skeletonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: ds.space.lg,
  },
  skeletonText: {
    fontFamily: ds.font.bodyMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  art: { position: 'absolute', right: -12, bottom: -8, opacity: 0.92 },
  content: { paddingVertical: ds.space.md, paddingHorizontal: ds.space.lg, maxWidth: '82%' },
  bannerContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: '100%',
    padding: ds.space.lg,
  },
  kicker: { fontFamily: ds.font.bodySemiBold, fontSize: 12, color: '#F9D976', letterSpacing: 1.2 },
  headline: {
    fontFamily: ds.font.headingBold,
    fontSize: 16,
    lineHeight: 21,
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 8,
  },
  bannerHeadline: {
    fontFamily: ds.font.headingBold,
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  bannerCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#F9D976',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: ds.radius.pill,
    minHeight: 32,
  },
  ctaText: { fontFamily: ds.font.bodyBold, fontSize: 12, color: ds.color.deepMaroon },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    backgroundColor: '#F9D976',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
