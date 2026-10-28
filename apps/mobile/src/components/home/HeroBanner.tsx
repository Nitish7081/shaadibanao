import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
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
  onBannerPress?: (banner: HomeBanner) => void;
  onExplorePress: () => void;
}

export const HeroBanner: React.FC<Props> = ({ banners, onBannerPress, onExplorePress }) => {
  const { t } = useTranslation();
  const [cardWidth, setCardWidth] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

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

  // Fallback: Built-in Vedic Sanatan artwork
  if (activeBanners.length === 0) {
    return (
      <LinearGradient
        colors={ds.gradient.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.art} pointerEvents="none">
          <HeroArt size={190} />
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

  // Multiple admin banners: Carousel
  return (
    <View style={styles.card} onLayout={handleLayout}>
      <ScrollView
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
    height: 200,
    marginBottom: ds.space.lg,
    position: 'relative',
    ...ds.shadow.lift,
  },
  art: { position: 'absolute', right: -24, bottom: -14, opacity: 0.95 },
  content: { padding: ds.space.xl, maxWidth: '80%' },
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
    fontSize: 21,
    lineHeight: 28,
    color: '#FFFFFF',
    marginTop: ds.space.sm,
    marginBottom: ds.space.lg,
  },
  bannerHeadline: {
    fontFamily: ds.font.headingBold,
    fontSize: 19,
    lineHeight: 25,
    color: '#FFFFFF',
    marginBottom: ds.space.sm,
  },
  bannerCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#F9D976',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: ds.radius.pill,
    minHeight: 40,
  },
  ctaText: { fontFamily: ds.font.bodyBold, fontSize: 13, color: ds.color.deepMaroon },
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
