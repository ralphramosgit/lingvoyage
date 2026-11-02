import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii, spacing } from '@/theme/theme';

import { Card } from './Card';

function Bone({ width, height = 12 }: { width: number | `${number}%`; height?: number }) {
  return <View style={[styles.bone, { width, height, borderRadius: radii.input / 2 }]} />;
}

/** Placeholder shaped like a scene card (picture on top, title below), with a soft pulse while content loads. */
export function SkeletonCard() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.5, { duration: 700 }), -1, true));
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Card accessibilityLabel="Loading" padded={false} style={styles.card}>
      <Animated.View style={pulse}>
        <View style={styles.art} />
        <View style={styles.lines}>
          <Bone width="62%" height={16} />
          <Bone width="34%" />
        </View>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderWidth: 0 },
  art: { height: 128, backgroundColor: colors.sky100 },
  lines: { gap: spacing.sm + 2, padding: spacing.lg },
  bone: { backgroundColor: '#E6EEF6' },
});
