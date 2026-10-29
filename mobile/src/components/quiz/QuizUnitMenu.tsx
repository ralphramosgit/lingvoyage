import { Check } from 'lucide-react-native';
import { Fragment, useEffect, useRef } from 'react';
import { BackHandler, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { Part, Unit } from '@/content/lessons/types';
import { readyQuizzes } from '@/content/quizzes/quizzes';
import { PART_TINTS, UnitIcon } from '@/lib/unitVisuals';
import { colors, layout, motion, radii, shadows, spacing, tints } from '@/theme/theme';

const ROW_HEIGHT = 52;

/**
 * The unit dropdown on the Quiz tab: every unit, grouped by part, to pick whose quizzes to show.
 * Drops down from `top` (the bottom of the nav bar) over the rest of the screen, like UnitMenu.
 */
export function QuizUnitMenu({
  parts,
  units,
  selectedId,
  top,
  onPick,
  onClose,
}: {
  parts: Part[];
  units: Unit[];
  selectedId: string;
  top: number;
  onPick: (unit: Unit) => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);

  // Android's back button closes the list rather than leaving the tab.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  // Opens with the selected unit in view, a row's height below the top so the one above it shows too.
  const scrollToSelected = (y: number) => {
    if (scrolled.current) return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - ROW_HEIGHT), animated: false });
  };

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
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {/* Headings and rows side by side, so each row's layout y is its place in the list. */}
            {parts.map((part) => (
              <Fragment key={part.id}>
                <Text variant="tiny" color={colors.inkMuted} style={styles.partTitle}>
                  {part.title.toUpperCase()}
                </Text>
                {units
                  .filter((unit) => unit.part === part.id)
                  .map((unit) => (
                    <View
                      key={unit.id}
                      onLayout={unit.id === selectedId ? (event) => scrollToSelected(event.nativeEvent.layout.y) : undefined}>
                      <MenuRow
                        unit={unit}
                        number={units.indexOf(unit) + 1}
                        selected={unit.id === selectedId}
                        onPress={() => onPick(unit)}
                      />
                    </View>
                  ))}
              </Fragment>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function MenuRow({ unit, number, selected, onPress }: { unit: Unit; number: number; selected: boolean; onPress: () => void }) {
  const palette = tints[PART_TINTS[unit.part]];
  const count = readyQuizzes(unit.id);
  const status = count === 0 ? 'Soon' : `${count} ${count === 1 ? 'quiz' : 'quizzes'}`;

  // Units without quizzes can still be picked: they say when their quizzes will come.
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Unit ${number}: ${unit.title}. ${count === 0 ? 'Quizzes coming soon' : status}.`}
      accessibilityHint="Shows this unit's quizzes"
      accessibilityState={{ selected }}
      style={[styles.row, selected ? styles.rowSelected : null]}>
      <View style={[styles.tile, { backgroundColor: count === 0 ? colors.bg : palette.bg }]}>
        <UnitIcon name={unit.icon} size={18} color={count === 0 ? colors.inkMuted : palette.fg} strokeWidth={2} />
      </View>
      <Text variant="bodyMedium" color={count === 0 ? colors.inkMuted : colors.ink} style={styles.flex}>
        {number}. {unit.title}
      </Text>
      {selected ? (
        <Check size={18} color={colors.sky700} strokeWidth={2.6} />
      ) : (
        <Text variant="tiny" color={colors.inkMuted}>
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
    minHeight: ROW_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowSelected: { backgroundColor: colors.sky50 },
  tile: { width: 34, height: 34, borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
});
