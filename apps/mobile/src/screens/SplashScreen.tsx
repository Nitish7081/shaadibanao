import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing } from '../constants/theme';
import { loadSessionFromStorage, hasActiveSession, getSessionUser, syncCurrentUserWithBackend } from '../services/authSession';
import { ShaadiBanaoLogo } from '../components/royal/ShaadiBanaoLogo';
import { VedicDivider } from '../components/royal/VedicOrnament';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    let isMounted = true;

    const checkAuthAndNavigate = async () => {
      const startTime = Date.now();
      const hasStoredSession = await loadSessionFromStorage();

      if (hasStoredSession && hasActiveSession()) {
        // Fetch latest approval status from MongoDB
        await syncCurrentUserWithBackend();
      }

      // Ensure 1.2s - 1.5s splash display for smooth brand experience
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 1400 - elapsed);

      setTimeout(() => {
        if (!isMounted) return;
        if (hasStoredSession && hasActiveSession()) {
          const user = getSessionUser();
          if (user?.approvalStatus && user.approvalStatus !== 'approved') {
            navigation.replace('ApprovalPending');
          } else {
            navigation.replace('MainTabs');
          }
        } else {
          navigation.replace('LanguageSelection');
        }
      }, delay);
    };

    checkAuthAndNavigate();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Background Decorative Glow */}
      <View style={styles.radialGlow} />

      {/* ShaadiBanao Matrimonial Emblem */}
      <View style={styles.emblemContainer}>
        <ShaadiBanaoLogo size="large" />
      </View>

      <Text style={styles.brandTitle}>ShaadiBanao</Text>
      <Text style={styles.tagline}>Rishton ki nayi shuruaat</Text>

      <VedicDivider color="rgba(212, 175, 55, 0.45)" style={styles.divider} />

      {/* Loading dots */}
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Sacred Sanatan Matrimony & Vedic Services</Text>
      </View>
    </View>
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
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
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
    marginBottom: spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing.xxs,
  },
  dotActive: {
    backgroundColor: colors.royalGold,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  footer: {
    position: 'absolute',
    bottom: spacing['2xl'],
  },
  footerText: {
    fontSize: 11,
    color: colors.lightGold,
    letterSpacing: 0.8,
    opacity: 0.8,
  },
});
