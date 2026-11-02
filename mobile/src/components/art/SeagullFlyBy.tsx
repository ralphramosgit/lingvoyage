import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Seagull } from './Seagull';

export type SeagullFlyByProps = {
  /** Distance from the top of the parent. */
  top: number;
  size?: number;
  /** Wait before the first crossing. */
  delay?: number;
  /** Cross again after this long; omit to fly across once. */
  every?: number;
  duration?: number;
};

/** The seagull flies across its parent, left to right, gliding up and down. Skipped with Reduce Motion on. */
export function SeagullFlyBy({ top, size = 56, delay = 300, every, duration = 2600 }: SeagullFlyByProps) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const cross = withTiming(1, { duration, easing: Easing.inOut(Easing.sin) });
    if (every) {
      progress.set(withDelay(delay, withRepeat(withSequence(withTiming(0, { duration: 0 }), cross, withDelay(every, withTiming(1, { duration: 0 }))), -1, false)));
      return undefined;
    }
    progress.set(withDelay(delay, cross));
    // A single crossing unmounts the bird once it's off screen.
    const timer = setTimeout(() => setDone(true), delay + duration + 100);
    return () => clearTimeout(timer);
  }, [delay, duration, every, progress, reduceMotion]);

  const flight = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1,
      transform: [
        { translateX: -size + (width + size * 2) * t },
        { translateY: Math.sin(t * Math.PI * 2) * size * 0.35 },
        { rotate: `${Math.cos(t * Math.PI * 2) * -6}deg` },
      ],
    };
  });

  if (reduceMotion || done) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.bird, { top }, flight]}>
      <Seagull pose="fly" size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bird: { position: 'absolute', left: 0 },
});
