import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../constants/theme';

interface VedicDividerProps {
  color?: string;
  style?: ViewStyle;
}

export const VedicDivider: React.FC<VedicDividerProps> = ({
  color = colors.royalGold,
  style,
}) => {
  return (
    <View style={[styles.dividerRow, style]}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <View style={styles.diamondWrap}>
        <View style={[styles.diamond, { borderColor: color }]} />
        <Text style={[styles.mandalaSymbol, { color }]}>✦</Text>
        <View style={[styles.diamond, { borderColor: color }]} />
      </View>
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  );
};

export const VedicCornerMotif: React.FC<{ size?: number; color?: string; style?: ViewStyle }> = ({
  size = 24,
  color = colors.royalGold,
  style,
}) => {
  return (
    <View style={[styles.cornerContainer, { width: size, height: size }, style]}>
      <View style={[styles.cornerBorderH, { borderColor: color, width: size }]} />
      <View style={[styles.cornerBorderV, { borderColor: color, height: size }]} />
      <Text style={[styles.cornerStar, { color, fontSize: size * 0.45 }]}>❖</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    width: '100%',
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    opacity: 0.45,
  },
  diamondWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  diamond: {
    width: 5,
    height: 5,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
    opacity: 0.7,
  },
  mandalaSymbol: {
    fontSize: 12,
    lineHeight: 14,
  },
  cornerContainer: {
    position: 'relative',
    opacity: 0.6,
  },
  cornerBorderH: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderTopWidth: 1.5,
  },
  cornerBorderV: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderLeftWidth: 1.5,
  },
  cornerStar: {
    position: 'absolute',
    top: 2,
    left: 2,
  },
});
