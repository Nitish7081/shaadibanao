import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ds } from './tokens';

interface Props {
  size?: number;
  /** Final image URL (already passed through cloudinaryUrl). Empty/undefined => initials. */
  uri?: string;
  /** Server flagged this photo as blurred: keep it blurred. */
  blurred?: boolean;
  initials?: string;
  /** Gold ring (active story) vs muted ring. */
  active?: boolean;
  /** Show the small "+" badge (used for "Your profile"). */
  plus?: boolean;
  /** Render as a friendly empty placeholder (no person data). */
  placeholder?: boolean;
}

export const GradientRingAvatar: React.FC<Props> = ({
  size = 66,
  uri,
  blurred = false,
  initials,
  active = true,
  plus = false,
  placeholder = false,
}) => {
  const [failed, setFailed] = useState(false);
  const inner = size - 8;
  const showImage = !!uri && !failed && !placeholder;

  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={active && !placeholder ? ds.gradient.goldRing : ds.gradient.goldRingIdle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={[styles.gap, { width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }]}>
          {showImage ? (
            <Image
              source={{ uri }}
              style={{ width: inner, height: inner, borderRadius: inner / 2 }}
              blurRadius={blurred ? 18 : 0}
              onError={() => setFailed(true)}
            />
          ) : (
            <View style={[styles.fallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
              {placeholder || !initials ? (
                <Ionicons name="person-outline" size={inner * 0.42} color={ds.color.goldDeep} />
              ) : (
                <Text style={[styles.initials, { fontSize: inner * 0.34 }]}>{initials}</Text>
              )}
            </View>
          )}
        </View>
      </LinearGradient>
      {plus && (
        <View style={styles.plus}>
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  gap: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  fallback: { backgroundColor: ds.color.surfaceWarm, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: ds.font.headingBold, color: ds.color.maroon },
  plus: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ds.color.maroon,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
