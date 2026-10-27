import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { PressableScale, ds } from '../../design';

interface Props {
  percentage: number;
  onCompletePress: () => void;
}

const SIZE = 64;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Slim progress card with a circular gradient ring and a "Complete now" action. */
export const CompletionCard: React.FC<Props> = ({ percentage, onCompletePress }) => {
  const pct = Math.max(0, Math.min(100, Math.round(percentage || 0)));
  const done = pct >= 100;
  return (
    <View style={styles.card}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <SvgGradient id="prog" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#D4AF37" />
              <Stop offset="1" stopColor="#D8315B" />
            </SvgGradient>
          </Defs>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={ds.color.skeleton} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="url(#prog)"
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C}`}
            strokeDashoffset={C * (1 - pct / 100)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.pctWrap} pointerEvents="none">
          <Text style={styles.pct}>{pct}%</Text>
        </View>
      </View>

      <View style={styles.text}>
        <Text style={ds.type.h3}>{done ? 'Profile complete' : 'Complete your profile'}</Text>
        <Text style={[ds.type.body, { marginTop: 2 }]} numberOfLines={2}>
          {done ? 'Great! Your profile is ready to get noticed.' : 'A complete profile gets more interests.'}
        </Text>
      </View>

      <PressableScale
        onPress={onCompletePress}
        accessibilityRole="button"
        accessibilityLabel={done ? 'Edit profile' : 'Complete profile now'}
        style={styles.btn}
      >
        <Text style={styles.btnText}>{done ? 'Edit' : 'Complete now'}</Text>
      </PressableScale>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ds.space.md,
    backgroundColor: ds.color.surface,
    borderRadius: ds.radius.lg,
    padding: ds.space.lg,
    borderWidth: 1,
    borderColor: ds.color.border,
    marginBottom: ds.space.lg,
    ...ds.shadow.soft,
  },
  pctWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pct: { fontFamily: ds.font.headingBold, fontSize: 15, color: ds.color.text },
  text: { flex: 1 },
  btn: {
    backgroundColor: ds.color.maroon,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: ds.radius.pill,
    minHeight: 40,
    justifyContent: 'center',
  },
  btnText: { fontFamily: ds.font.bodyBold, fontSize: 13, color: '#FFFFFF' },
});
