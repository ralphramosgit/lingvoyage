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

function Bone({ width, height = 12, round = false }: { width: number | `${number}%`; height?: number; round?: boolean }) {
  return <View style={[styles.bone, { width, height, borderRadius: round ? radii.full : 6 }]} />;
}

/** Placeholder shaped like a scenario card, with a soft pulse while content loads. */
export function SkeletonCard() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(withRepeat(withTiming(0.5, { duration: 700 }), -1, true));
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Card accessibilityLabel="Loading">
      <Animated.View style={[styles.row, pulse]}>
        <View style={styles.tile} />
        <View style={styles.lines}>
          <Bone width="70%" height={16} />
          <Bone width="50%" />
          <View style={styles.chips}>
            <Bone width={72} height={22} round />
            <Bone width={56} height={22} round />
          </View>
        </View>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  tile: { width: 56, height: 56, borderRadius: radii.card, backgroundColor: colors.sky100 },
  lines: { flex: 1, gap: spacing.sm + 2, paddingTop: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  bone: { backgroundColor: '#E6EEF6' },
});
