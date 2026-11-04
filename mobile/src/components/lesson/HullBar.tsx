import { LifeBuoy, Wrench } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { HULL, LOW_HULL } from '@/lib/voyage';
import { colors, motion, radii, spacing, tints } from '@/theme/theme';

function plankColor(hull: number) {
  if (hull > LOW_HULL) return colors.success;
  return hull === LOW_HULL ? colors.sun400 : colors.danger;
}

/** Challenge mode's HP bar: one plank per point of hull. Shakes on a hit, and says so when a leak is patched. */
export function HullBar({ hull, hits, patches }: { hull: number; hits: number; patches: number }) {
  const reduceMotion = useReducedMotion();
  const shake = useSharedValue(0);
  const color = plankColor(hull);

  useEffect(() => {
    if (hits === 0 || reduceMotion) return;
    shake.set(
      withSequence(withTiming(-5, { duration: 50 }), withTiming(5, { duration: 50 }), withTiming(-3, { duration: 50 }), withTiming(0, { duration: 50 })),
    );
  }, [hits, reduceMotion, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  return (
    <View style={styles.row} accessible accessibilityLabel={`Hull: ${hull} of ${HULL}`}>
      <LifeBuoy size={16} color={colors.inkMuted} strokeWidth={2.4} />
      <Text variant="tiny" color={colors.inkMuted}>
        HULL
      </Text>
      <Animated.View style={[styles.planks, shakeStyle]}>
        {Array.from({ length: HULL }, (_, index) => (
          <View key={index} style={[styles.plank, { backgroundColor: index < hull ? color : colors.line }]} />
        ))}
      </Animated.View>
      {/* Keyed so each patch shows its own note. */}
      {patches > 0 ? <PatchNote key={patches} /> : null}
    </View>
  );
}

/** "Leak patched!", which fades in and back out on its own. */
function PatchNote() {
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.set(withSequence(withTiming(1, { duration: motion.base }), withDelay(1600, withTiming(0, { duration: motion.slow }))));
  }, [fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: (1 - fade.get()) * 4 }] }));

  return (
    <Animated.View style={[styles.patch, fadeStyle]}>
      <Wrench size={12} color={tints.mint.fg} strokeWidth={2.6} />
      <Text variant="tiny" color={tints.mint.fg}>
        Leak patched! +1
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 22 },
  planks: { flexDirection: 'row', gap: 3 },
  plank: { width: 20, height: 9, borderRadius: 3 },
  patch: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: tints.mint.bg,
  },
});
