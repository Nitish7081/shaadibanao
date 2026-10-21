import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, fonts } from '../../constants/theme';

interface ProfileCompletionCardProps {
  percentage: number;
  onCompletePress: () => void;
  style?: ViewStyle;
}

export const ProfileCompletionCard: React.FC<ProfileCompletionCardProps> = ({
  percentage,
  onCompletePress,
  style,
}) => {
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const isHigh = safePercentage >= 80;

  const animatedWidth = useRef(new Animated.Value(safePercentage)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: safePercentage,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [safePercentage]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <View style={styles.headingRow}>
            <Ionicons
              name={isHigh ? 'shield-checkmark' : 'sparkles'}
              size={17}
              color={isHigh ? colors.verifiedGreen : colors.royalMaroon}
            />
            <Text style={styles.headingText}>
              Profile {safePercentage}% Complete
            </Text>
          </View>
          <Text style={styles.subtext}>
            {safePercentage >= 90
              ? 'Excellent! Your matrimonial profile is thoroughly detailed.'
              : safePercentage >= 60
              ? 'Add your family background and verified photos to boost visibility.'
              : 'Complete key details & photos to activate your profile.'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={onCompletePress}
          accessibilityRole="button"
          accessibilityLabel="Complete Profile"
        >
          <Text style={styles.actionBtnText}>Complete</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.royalMaroon} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      {/* Animated Progress Track & Fill */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: widthInterpolation },
            isHigh && styles.fillHigh,
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#EFE6D8',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  leftCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headingText: {
    fontSize: 14,
    fontFamily: fonts.headingSemiBold,
    fontWeight: '700',
    color: colors.charcoal,
  },
  subtext: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    color: colors.bodyText,
    marginTop: 3,
    lineHeight: 16,
  },
  actionBtn: {
    backgroundColor: '#FAF5ED',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: fonts.headingBold,
    fontWeight: '700',
    color: colors.royalMaroon,
  },
  track: {
    height: 7,
    backgroundColor: '#F5EFEB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.royalMaroon,
    borderRadius: 4,
  },
  fillHigh: {
    backgroundColor: '#1E824C',
  },
});

