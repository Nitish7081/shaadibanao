import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../constants/theme';
import { loadSessionFromStorage, hasActiveSession, getSessionUser, syncCurrentUserWithBackend } from '../services/authSession';
import { getNextRouteForUser } from '../navigation/authRouting';
import { ShaadiBanaoLogo } from '../components/royal/ShaadiBanaoLogo';
import { VedicDivider } from '../components/royal/VedicOrnament';
import { hasChosenLanguage } from '../i18n';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const WELCOME_MESSAGES_EN = [
  'Connecting sacred hearts & families...',
  'Authentic Vedic Kundli & Muhurat matching...',
  'Safe, verified & private Sanatan matrimony...',
];

const WELCOME_MESSAGES_HI = [
  'पवित्र पारिवारिक रिश्तों की मंगल शुरुआत...',
  'प्रामाणिक वैदिक कुंडली एवं शुभ मुहूर्त मिलान...',
  'सुरक्षित, सत्यापित एवं मर्यादित सनातन विवाह...',
];

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';
  const messages = isHindi ? WELCOME_MESSAGES_HI : WELCOME_MESSAGES_EN;

  const [messageIndex, setMessageIndex] = useState(0);

  // Smooth Animations: Pulse & Fade
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in whole screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // Gentle pulsing loop for the royal emblem
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Message rotation timer
    const interval = setInterval(() => {
      Animated.timing(textFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }, 1800);

    return () => {
      pulseLoop.stop();
      clearInterval(interval);
    };
  }, [messages.length]);

  useEffect(() => {
    let isMounted = true;

    // Non-blocking server health ping
    fetch('https://shaadibanao.onrender.com/api/v1/health').catch(() => {});

    const checkAuthAndNavigate = async () => {
      // 1. Fast O(1) Session & Profile Recovery from Cache
      const hasStoredSession = await loadSessionFromStorage();

      // 2. Non-blocking asynchronous sync with MongoDB in the background
      if (hasStoredSession && hasActiveSession()) {
        syncCurrentUserWithBackend().catch(() => {});
      }

      // 3. Smooth automatic navigation as soon as cache hydration is complete
      setTimeout(() => {
        if (!isMounted) return;
        if (hasStoredSession && hasActiveSession()) {
          const user = getSessionUser();
          const next = getNextRouteForUser(user);
          if (next.screen === 'IdentityVerification') {
            navigation.replace('IdentityVerification', next.params);
          } else {
            navigation.replace(next.screen);
          }
        } else {
          navigation.replace(hasChosenLanguage() ? 'Welcome' : 'LanguageSelection');
        }
      }, 250);
    };

    checkAuthAndNavigate();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Background Decorative Radial Glow */}
      <View style={styles.radialGlow} />

      {/* ShaadiBanao Matrimonial Emblem with Subtle Pulsing */}
      <Animated.View style={[styles.emblemContainer, { transform: [{ scale: pulseAnim }] }]}>
        <ShaadiBanaoLogo size="large" />
      </Animated.View>

      <Text style={styles.brandTitle}>ShaadiBanao</Text>
      <Text style={styles.tagline}>{t('splash.tagline', 'Rishton ki nayi shuruaat')}</Text>

      <VedicDivider color="rgba(212, 175, 55, 0.45)" style={styles.divider} />

      {/* Rotating Auspicious Vedic Message */}
      <Animated.View style={[styles.messageBox, { opacity: textFadeAnim }]}>
        <Text style={styles.rotatingMessage}>{messages[messageIndex]}</Text>
      </Animated.View>

      {/* Subtle Loading Dots */}
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, messageIndex === 0 ? styles.dotActive : null]} />
        <View style={[styles.dot, messageIndex === 1 ? styles.dotActive : null]} />
        <View style={[styles.dot, messageIndex === 2 ? styles.dotActive : null]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('splash.subtitle', 'Sacred Sanatan Matrimony & Vedic Services')}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.royalMaroon,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    position: 'relative',
  },
  radialGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  emblemContainer: {
    marginBottom: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.lightGold,
    fontStyle: 'italic',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  divider: {
    maxWidth: 200,
    marginBottom: spacing.md,
  },
  messageBox: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  rotatingMessage: {
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing.xxs,
  },
  dotActive: {
    backgroundColor: colors.royalGold,
    width: 14,
    borderRadius: 7,
  },
  footer: {
    position: 'absolute',
    bottom: spacing['2xl'],
  },
  footerText: {
    fontSize: 11,
    color: colors.lightGold,
    letterSpacing: 0.8,
    opacity: 0.85,
  },
});
