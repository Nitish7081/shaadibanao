import React from 'react';
import { Image, StyleSheet, StyleProp, ImageStyle } from 'react-native';

interface ShaadiBanaoLogoProps {
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ImageStyle>;
}

const logoSource = require('../../../assets/logo.png');

export const ShaadiBanaoLogo: React.FC<ShaadiBanaoLogoProps> = ({ size = 'medium', style }) => {
  const dimensions = {
    small: { width: 35, height: 24 },
    medium: { width: 50, height: 34 },
    large: { width: 95, height: 64 },
  }[size];

  return (
    <Image
      source={logoSource}
      style={[
        styles.logoImage,
        {
          width: dimensions.width,
          height: dimensions.height,
        },
        style,
      ]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="ShaadiBanao Logo"
    />
  );
};

const styles = StyleSheet.create({
  logoImage: {
    backgroundColor: 'transparent',
  },
});

