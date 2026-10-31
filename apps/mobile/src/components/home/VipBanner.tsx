import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale, ds } from '../../design';

interface Props {
  onUpgradePress: () => void;
}

export const VipBanner: React.FC<Props> = ({ onUpgradePress }) => (
  <LinearGradient
    colors={ds.gradient.vip}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.card}
  >
    <View style={styles.row}>
      <View style={styles.crown}>
        <MaterialCommunityIcons name="crown" size={26} color={ds.color.deepMaroon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>VIP MEMBERSHIP</Text>
        <Text style={styles.title}>Direct Contact & Horoscope Matching</Text>
      </View>
    </View>
    <Text style={styles.desc}>Unlock premium features and get closer to your perfect match.</Text>
    <PressableScale
      onPress={onUpgradePress}
      accessibilityRole="button"
      accessibilityLabel="Explore Membership Plans"
      style={styles.btn}
    >
      <Text style={styles.btnText}>Explore Membership Plans</Text>
      <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
    </PressableScale>
  </LinearGradient>
);

const styles = StyleSheet.create({
  card: { borderRadius: ds.radius.xl, padding: ds.space.lg + 2, marginBottom: 0, ...ds.shadow.lift },
  row: { flexDirection: 'row', alignItems: 'center', gap: ds.space.md },
  crown: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { fontFamily: ds.font.bodyBold, fontSize: 12, letterSpacing: 1.2, color: ds.color.deepMaroon },
  title: { fontFamily: ds.font.headingBold, fontSize: 17, lineHeight: 23, color: '#2B0B12', marginTop: 2 },
  desc: { ...ds.type.body, color: '#3B2A10', marginTop: ds.space.md, marginBottom: ds.space.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ds.color.deepMaroon,
    borderRadius: ds.radius.pill,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  btnText: { fontFamily: ds.font.bodyBold, fontSize: 15, color: '#FFFFFF' },
});
