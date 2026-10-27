import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { ds } from './tokens';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Soft pulsing placeholder shown while data loads (no layout jump when content arrives). */
export const Skeleton: React.FC<Props> = ({ width = '100%', height = 16, radius = 10, style }) => {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: ds.color.skeleton, opacity: pulse }, style]}
    />
  );
};
