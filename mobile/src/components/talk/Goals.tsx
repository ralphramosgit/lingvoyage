import { Check, ChevronDown, Circle, Target } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, fonts, motion, radii, spacing } from '@/theme/theme';
import type { Goal } from '@/types/api';

export function GoalsPill({
  done,
  total,
  open,
  onPress,
}: {
  done: number;
  total: number;
  open: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withTiming(open ? 180 : 0, { duration: reduceMotion ? 0 : motion.base }));
  }, [open, reduceMotion, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  const allDone = total > 0 && done === total;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Goals: ${done} of ${total} done`}
      accessibilityHint={open ? 'Hides the goals' : 'Shows the goals'}
      accessibilityState={{ expanded: open }}
      style={[styles.pill, allDone ? styles.pillDone : null]}>
      <Target size={16} color={allDone ? colors.success : colors.sky700} strokeWidth={2.4} />
      {/* Re-keyed on each new goal so the count pops. */}
      <Animated.View key={done} entering={reduceMotion ? undefined : ZoomIn.duration(motion.base)}>
        <Text style={[styles.count, { color: allDone ? colors.success : colors.sky700 }]}>
          {done}/{total}
        </Text>
      </Animated.View>
      <Animated.View style={chevronStyle}>
        <ChevronDown size={16} color={allDone ? colors.success : colors.sky700} />
      </Animated.View>
    </PressableScale>
  );
}

/** Goals checklist that opens and closes with an animated height. */
export function GoalsPanel({ open, goals, completedIds }: { open: boolean; goals: Goal[]; completedIds: string[] }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, { duration: reduceMotion ? 0 : motion.base }));
  }, [open, progress, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    height: contentHeight.get() * progress.get(),
    opacity: progress.get(),
  }));

  return (
    <Animated.View
      style={[styles.panel, containerStyle]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
      <View style={styles.measure} onLayout={(event) => contentHeight.set(event.nativeEvent.layout.height)}>
        <View style={styles.list}>
          {goals.map((goal) => {
            const done = completedIds.includes(goal.id);
            return (
              <View
                key={goal.id}
                style={styles.row}
                accessible
                accessibilityLabel={`${goal.label}, ${done ? 'done' : 'not done yet'}`}>
                {done ? (
                  <Animated.View
                    entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
                    style={styles.check}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </Animated.View>
                ) : (
                  <Circle size={22} color={colors.line} strokeWidth={2.5} />
                )}
                <Text variant="bodyMedium" color={done ? colors.inkMuted : colors.ink} style={styles.label}>
                  {goal.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.sky100,
  },
  pillDone: { backgroundColor: '#DCFCE7' },
  count: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  panel: { overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, right: 0, top: 0 },
  list: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
