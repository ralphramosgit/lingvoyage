import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const PERIOD = 120;
const PERIODS = 8; // wider than any phone, plus one period to slide through

function wavePath(height: number, amplitude: number): string {
  const mid = amplitude;
  let d = `M0 ${mid}`;
  for (let index = 0; index < PERIODS; index += 1) {
    const x = index * PERIOD;
    d += ` Q${x + PERIOD / 4} ${mid - amplitude} ${x + PERIOD / 2} ${mid} T${x + PERIOD} ${mid}`;
  }
  return `${d} L${PERIOD * PERIODS} ${height} L0 ${height} Z`;
}

export type WavesProps = {
  color: string;
  height?: number;
  amplitude?: number;
  /** Milliseconds to drift one wavelength; negative drifts left to right. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/** A band of sea along the bottom of its parent that drifts sideways forever (still with Reduce Motion on). */
export function Waves({ color, height = 40, amplitude = 6, duration = 3200, style }: WavesProps) {
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.set(withRepeat(withTiming(1, { duration: Math.abs(duration), easing: Easing.linear }), -1, false));
  }, [drift, duration, reduceMotion]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: duration > 0 ? -PERIOD * drift.get() : -PERIOD + PERIOD * drift.get() }],
  }));

  return (
    <View pointerEvents="none" style={[styles.band, { height }, style]}>
      <Animated.View style={[styles.strip, slide]}>
        <Svg width={PERIOD * PERIODS} height={height}>
          <Path d={wavePath(height, amplitude)} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  strip: { position: 'absolute', left: 0, top: 0 },
});
