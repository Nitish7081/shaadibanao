import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';

interface VedicServiceCardsProps {
  onBookPanditPress: () => void;
  onKundliMilanPress: () => void;
  style?: ViewStyle;
}

export const VedicServiceCards: React.FC<VedicServiceCardsProps> = ({
  onBookPanditPress,
  onKundliMilanPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Card A: Book a Pandit */}
      <TouchableOpacity
        style={[styles.card, styles.cardLeft]}
        activeOpacity={0.85}
        onPress={onBookPanditPress}
        accessibilityRole="button"
        accessibilityLabel="Book a Pandit for weddings, puja and muhurat"
      >
        <View style={styles.topAccentMaroon} />
        <View style={styles.iconCircleMaroon}>
          <MaterialCommunityIcons name="om" size={22} color={colors.royalMaroon} />
        </View>

        <Text style={styles.cardTitle}>Book a Pandit</Text>
        <Text style={styles.cardDesc}>
          Weddings, Puja & Muhurat
        </Text>

        <View style={styles.actionRow}>
          <Text style={styles.actionTextMaroon}>Find Pandits</Text>
          <Ionicons name="arrow-forward-circle" size={16} color={colors.royalMaroon} />
        </View>
      </TouchableOpacity>

      {/* Card B: Kundli Milan */}
      <TouchableOpacity
        style={[styles.card, styles.cardRight]}
        activeOpacity={0.85}
        onPress={onKundliMilanPress}
        accessibilityRole="button"
        accessibilityLabel="Kundli Milan for Vedic horoscope compatibility"
      >
        <View style={styles.topAccentGold} />
        <View style={styles.iconCircleGold}>
          <Ionicons name="planet" size={21} color="#99731E" />
        </View>

        <Text style={styles.cardTitle}>Kundli Milan</Text>
        <Text style={styles.cardDesc}>
          Vedic compatibility
        </Text>

        <View style={styles.actionRow}>
          <Text style={styles.actionTextGold}>Check Compatibility</Text>
          <Ionicons name="arrow-forward-circle" size={16} color={colors.royalGold} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.base,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.card,
  },
  cardLeft: {
    borderColor: '#ECDED2',
  },
  cardRight: {
    borderColor: '#EDE4CB',
  },
  topAccentMaroon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: colors.royalMaroon,
  },
  topAccentGold: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: colors.royalGold,
  },
  iconCircleMaroon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDF0F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircleGold: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDF4DC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconSymbol: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.royalMaroon,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.bodyText,
    lineHeight: 16,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5EFEB',
  },
  actionTextMaroon: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.royalMaroon,
  },
  actionTextGold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#99731E',
  },
});
