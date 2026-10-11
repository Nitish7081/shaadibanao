import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, typography, spacing } from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    // 2-second timeout per blueprint S-00 rule (max 2 seconds then auto-moves ahead)
    const timer = setTimeout(() => {
      navigation.replace('LanguageSelection');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Brand Emblem: Golden Setu (Bridge) representing two families joined */}
      <View style={styles.emblemContainer}>
        <View style={styles.bridgeArch}>
          <View style={styles.bridgePillarsContainer}>
            <View style={styles.bridgePillar} />
            <View style={styles.bridgePillar} />
            <View style={styles.bridgePillar} />
            <View style={styles.bridgePillar} />
          </View>
        </View>
        <View style={styles.bridgeBase} />
      </View>

      <Text style={styles.brandTitle}>BandhanSetu</Text>
      <Text style={styles.tagline}>Where trust meets togetherness</Text>

      {/* Loading dots */}
      <View style={styles.dotsContainer}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made in India with care</Text>
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
  },
  emblemContainer: {
    width: 110,
    height: 65,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bridgeArch: {
    width: 100,
    height: 50,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    borderWidth: 3.5,
    borderColor: colors.softGold,
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bridgePillarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    height: 30,
  },
  bridgePillar: {
    width: 2.5,
    height: '100%',
    backgroundColor: colors.softGold,
  },
  bridgeBase: {
    width: 110,
    height: 4,
    backgroundColor: colors.softGold,
    borderRadius: 2,
    marginTop: 2,
  },
  brandTitle: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.fontSizes.sm,
    color: colors.warmGrey,
    letterSpacing: 0.5,
    marginBottom: spacing['3xl'],
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing.xxs,
  },
  dotActive: {
    backgroundColor: colors.softGold,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  footer: {
    position: 'absolute',
    bottom: spacing['2xl'],
  },
  footerText: {
    fontSize: typography.fontSizes.xs,
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
  },
});
