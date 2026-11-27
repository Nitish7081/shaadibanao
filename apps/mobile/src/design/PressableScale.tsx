import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
}

/** Pressable that gently scales down while pressed (native-driven spring, respects Reduce Motion). */
export const PressableScale: React.FC<Props> = ({
  style,
  containerStyle,
  scaleTo = 0.96,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}) => {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) => {
    if (reducedMotion || disabled) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(e) => {
        animate(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, disabled ? { opacity: 0.6 } : undefined, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
