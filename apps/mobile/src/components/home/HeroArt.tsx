import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

/**
 * Self-made wedding artwork: gold mandala, kalash with leaves and a lit diya.
 * Pure SVG (no external images).
 */
export const HeroArt: React.FC<{ size?: number }> = ({ size = 170 }) => {
  const petals = Array.from({ length: 12 }).map((_, i) => i * 30);
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <SvgGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FBE49A" />
          <Stop offset="0.55" stopColor="#D4AF37" />
          <Stop offset="1" stopColor="#A87B14" />
        </SvgGradient>
      </Defs>

      {/* Mandala */}
      <G opacity={0.55}>
        <Circle cx="100" cy="100" r="92" stroke="#F9D976" strokeWidth="1.2" fill="none" strokeDasharray="2 5" />
        <Circle cx="100" cy="100" r="76" stroke="#F9D976" strokeWidth="1" fill="none" />
        {petals.map((deg) => (
          <Ellipse
            key={deg}
            cx="100"
            cy="38"
            rx="7"
            ry="20"
            fill="none"
            stroke="#F9D976"
            strokeWidth="1.2"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
        <Circle cx="100" cy="100" r="44" stroke="#F9D976" strokeWidth="1" fill="none" />
      </G>

      {/* Kalash */}
      <G>
        <Path d="M78 118 Q74 150 100 156 Q126 150 122 118 Z" fill="url(#gold)" />
        <Path d="M82 112 H118 L122 120 H78 Z" fill="#B8861B" />
        <Ellipse cx="100" cy="112" rx="18" ry="5" fill="#8C5F0E" />
        {/* leaves */}
        <Path d="M100 108 Q82 96 84 78 Q98 84 100 108 Z" fill="#7BC47F" />
        <Path d="M100 108 Q118 96 116 78 Q102 84 100 108 Z" fill="#5FAE67" />
        <Path d="M100 106 Q94 88 100 70 Q106 88 100 106 Z" fill="#8FD694" />
        {/* coconut */}
        <Circle cx="100" cy="72" r="9" fill="url(#gold)" />
        <Path d="M100 61 Q96 56 100 52 Q104 56 100 61 Z" fill="#D8315B" />
      </G>

      {/* Diya */}
      <G>
        <Path d="M132 164 Q150 178 170 164 Q166 172 151 176 Q138 174 132 164 Z" fill="url(#gold)" />
        <Path d="M151 160 Q143 148 151 134 Q159 148 151 160 Z" fill="#FFB020" />
        <Path d="M151 157 Q147 150 151 143 Q155 150 151 157 Z" fill="#FFF1B8" />
      </G>
      <G>
        <Path d="M30 164 Q48 178 68 164 Q64 172 49 176 Q36 174 30 164 Z" fill="url(#gold)" />
        <Path d="M49 160 Q41 148 49 134 Q57 148 49 160 Z" fill="#FFB020" />
        <Path d="M49 157 Q45 150 49 143 Q53 150 49 157 Z" fill="#FFF1B8" />
      </G>
    </Svg>
  );
};
