import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

interface AnimatedPageProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  offsetY?: number;
}

/**
 * Smooth 300ms ease-out page transition (opacity + translateY via native driver).
 * Immediately settles without motion when OS Reduce Motion is enabled.
 */
export const AnimatedPage: React.FC<AnimatedPageProps> = ({
  children,
  style,
  duration = 300,
  offsetY = 12,
}) => {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : offsetY)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [duration, opacity, reducedMotion, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

interface AnimatedStaggerItemProps {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  staggerMs?: number;
  maxAnimatedIndex?: number;
}

/**
 * Staggered list item entrance (~50ms per visible item, capped at first batch so FlatList stays 60fps).
 * Uses GPU transform + opacity only.
 */
export const AnimatedStaggerItem: React.FC<AnimatedStaggerItemProps> = ({
  index,
  children,
  style,
  staggerMs = 50,
  maxAnimatedIndex = 8,
}) => {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = !reducedMotion && index <= maxAnimatedIndex;
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(shouldAnimate ? 12 : 0)).current;

  useEffect(() => {
    if (!shouldAnimate) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const delay = Math.max(0, index) * staggerMs;
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [index, opacity, shouldAnimate, staggerMs, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

interface AnimatedModalSurfaceProps {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * GPU-composited modal card entrance (scale + translateY + opacity) respecting Reduce Motion.
 */
export const AnimatedModalSurface: React.FC<AnimatedModalSurfaceProps> = ({
  visible,
  children,
  style,
}) => {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.95);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 24,
        bounciness: 5,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, reducedMotion, scale, visible]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};
