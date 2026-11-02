import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme/theme';

/** A color per tone, so a tone's shape, mark and dots match everywhere. Each reads on white (4.5:1+). */
export const TONE_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: colors.sky700,
  2: '#15803D',
  3: '#A16207',
  4: '#6D28D9',
  5: colors.inkMuted,
};

// Pitch on the 1 (low) to 5 (high) scale teachers use, drawn in a 40 x 40 box.
const y = (level: number) => 36 - (level - 1) * 8;

// 1st 55, 2nd 35, 3rd 214, 4th 51. The neutral tone is a short, light dot.
const PATHS: Record<1 | 2 | 3 | 4, string> = {
  1: `M6 ${y(5)} L34 ${y(5)}`,
  2: `M6 ${y(3)} Q22 ${y(3) + 2} 34 ${y(5)}`,
  3: `M6 ${y(2)} Q14 ${y(1)} 20 ${y(1)} Q28 ${y(1)} 34 ${y(4)}`,
  4: `M6 ${y(5)} Q18 ${y(5)} 34 ${y(1)}`,
};

/** The shape a tone's pitch takes, from left to right. Decorative: the tone's name or mark says it in words. */
export function ToneContour({
  tone,
  size = 32,
  color,
}: {
  tone: 1 | 2 | 3 | 4 | 5;
  size?: number;
  /** Defaults to the tone's color. */
  color?: string;
}) {
  const stroke = color ?? TONE_COLORS[tone];
  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {tone === 5 ? (
          <Circle cx={20} cy={y(2)} r={4} fill={stroke} />
        ) : (
          <Path d={PATHS[tone]} stroke={stroke} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )}
      </Svg>
    </View>
  );
}
