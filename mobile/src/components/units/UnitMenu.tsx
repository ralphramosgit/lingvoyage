import { CircleCheck, Lock } from 'lucide-react-native';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { Part, Unit } from '@/content/lessons/types';
import { isUnitDone, lessonsDone } from '@/lib/course';
import type { UnitProgress } from '@/lib/unitProgress';
import { PART_TINTS, UnitIcon } from '@/lib/unitVisuals';
import { colors, layout, motion, radii, shadows, spacing, tints } from '@/theme/theme';

/**
 * The "Units" dropdown on the Lessons tab: every unit, grouped by part, to jump straight to one.
 * Drops down from `top` (the bottom of the nav bar) over the rest of the screen.
 */
export function UnitMenu({
  parts,
  units,
  progress,
  upNextId,
  top,
  onPick,
  onClose,
}: {
  parts: Part[];
  units: Unit[];
  progress: UnitProgress;
  /** The unit the Continue card points at. */
  upNextId?: string;
  top: number;
  onPick: (unit: Unit) => void;
  onClose: () => void;
}) {
  // Android's back button closes the list rather than leaving the tab.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  return (
    <Animated.View exiting={FadeOut.duration(motion.fast)} style={[StyleSheet.absoluteFill, { top }]}>
      <Animated.View entering={FadeIn.duration(motion.fast)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close the list of units"
        />
      </Animated.View>
      <Animated.View entering={FadeInUp.duration(motion.base)} style={styles.dock} pointerEvents="box-none">
        <View style={styles.panel} onAccessibilityEscape={onClose}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {parts.map((part) => (
              <View key={part.id}>
                <Text variant="tiny" color={colors.inkMuted} style={styles.partTitle}>
                  {part.title.toUpperCase()}
                </Text>
                {units
                  .filter((unit) => unit.part === part.id)
                  .map((unit) => (
                    <MenuRow
                      key={unit.id}
                      unit={unit}
                      number={units.indexOf(unit) + 1}
                      progress={progress}
                      upNext={unit.id === upNextId}
                      onPress={() => onPick(unit)}
                    />
                  ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function MenuRow({
  unit,
  number,
  progress,
  upNext,
  onPress,
}: {
  unit: Unit;
  number: number;
  progress: UnitProgress;
  upNext: boolean;
  onPress: () => void;
}) {
  const palette = tints[PART_TINTS[unit.part]];
  const total = unit.lessons.length;
  const done = lessonsDone(unit, progress);
  const complete = isUnitDone(unit, progress);

  if (total === 0) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`Unit ${number}: ${unit.title}, coming soon`}>
        <View style={[styles.tile, styles.lockedTile]}>
          <UnitIcon name={unit.icon} size={18} color={colors.inkMuted} strokeWidth={2} />
        </View>
        <Text variant="bodyMedium" color={colors.inkMuted} style={styles.flex}>
          {number}. {unit.title}
        </Text>
        <Lock size={16} color={colors.inkMuted} />
      </View>
    );
  }

  let status = `${done}/${total}`;
  if (complete) status = 'Done';
  else if (upNext) status = 'Up next';

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Unit ${number}: ${unit.title}. ${complete ? 'Done' : `${done} of ${total} lessons done`}.${upNext ? ' Up next.' : ''}`}
      accessibilityHint="Opens the unit"
      style={[styles.row, upNext ? styles.rowUpNext : null]}>
      <View style={[styles.tile, { backgroundColor: palette.bg }]}>
        <UnitIcon name={unit.icon} size={18} color={palette.fg} strokeWidth={2} />
      </View>
      <Text variant="bodyMedium" style={styles.flex}>
        {number}. {unit.title}
      </Text>
      {complete ? (
        <CircleCheck size={18} color={colors.success} strokeWidth={2.4} />
      ) : (
        <Text variant="tiny" color={upNext ? colors.sky700 : colors.inkMuted}>
          {status}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,31,51,0.35)' },
  dock: {
    position: 'absolute',
    top: spacing.xs,
    right: 0,
    bottom: spacing.xxl,
    left: 0,
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  panel: {
    width: '100%',
    maxWidth: layout.maxContentWidth - layout.screenPadding * 2,
    maxHeight: '100%',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  // Only as tall as the list, and scrolls once that's taller than the screen.
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingVertical: spacing.sm },
  partTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowUpNext: { backgroundColor: colors.sky50 },
  tile: { width: 34, height: 34, borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
  lockedTile: { backgroundColor: colors.bg },
});
