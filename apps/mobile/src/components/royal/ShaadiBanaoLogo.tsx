import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

interface ShaadiBanaoLogoProps {
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export const ShaadiBanaoLogo: React.FC<ShaadiBanaoLogoProps> = ({ size = 'medium', style }) => {
  const dimensions = {
    small: { outer: 36, inner: 30, text: 13, icon: 10 },
    medium: { outer: 46, inner: 38, text: 16, icon: 12 },
    large: { outer: 64, inner: 54, text: 22, icon: 16 },
  }[size];

  return (
    <View
      style={[
        styles.outerRing,
        {
          width: dimensions.outer,
          height: dimensions.outer,
          borderRadius: dimensions.outer / 2,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.innerRing,
          {
            width: dimensions.inner,
            height: dimensions.inner,
            borderRadius: dimensions.inner / 2,
          },
        ]}
      >
        {/* Vedic Monogram SB with Royal Gold Accents */}
        <View style={styles.contentWrap}>
          <Text style={[styles.monogramText, { fontSize: dimensions.text }]}>SB</Text>
          <View style={styles.sparkleWrap}>
            <Ionicons name="sparkles" size={dimensions.icon} color={colors.royalGold} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerRing: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
    borderWidth: 1.5,
    borderColor: colors.royalGold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.deepMaroon,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  innerRing: {
    backgroundColor: colors.deepMaroon,
    borderWidth: 1,
    borderColor: colors.brightGold,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  contentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    color: '#FFF8E7',
    fontWeight: '900',
    letterSpacing: 0.5,
    fontFamily: undefined,
  },
  sparkleWrap: {
    position: 'absolute',
    top: -4,
    right: -7,
  },
});
