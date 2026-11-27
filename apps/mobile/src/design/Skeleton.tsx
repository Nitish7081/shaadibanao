import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { ds } from './tokens';
import { useReducedMotion } from './useReducedMotion';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Soft pulsing placeholder shown while data loads (respects OS Reduce Motion). */
export const Skeleton: React.FC<Props> = ({ width = '100%', height = 16, radius = 10, style }) => {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(reducedMotion ? 0.75 : 0.55)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.75);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: ds.color.skeleton, opacity: pulse }, style]}
    />
  );
};
