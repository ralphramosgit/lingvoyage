import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { Unit } from '@/content/lessons/types';
import type { QuizSection, QuizSectionId } from '@/content/quizzes/types';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';

import { SectionTabs } from './SectionTabs';

/** The top of the Quiz tab: the title, the section tabs, and (on Units) which unit's quizzes to show. */
export function QuizNavBar({
  sections,
  section,
  onSelectSection,
  unit,
  unitNumber,
  menuOpen,
  onToggleMenu,
  onPrevious,
  onNext,
}: {
  sections: QuizSection[];
  section: QuizSectionId;
  onSelectSection: (id: QuizSectionId) => void;
  unit: Unit;
  unitNumber: number;
  menuOpen: boolean;
  onToggleMenu: () => void;
  /** Left out at the first unit. */
  onPrevious?: () => void;
  /** Left out at the last unit. */
  onNext?: () => void;
}) {
  return (
    <View style={styles.nav}>
      <Text variant="title" accessibilityRole="header">
        Quiz
      </Text>
      <SectionTabs sections={sections} selected={section} onSelect={onSelectSection} />
      {section === 'units' ? (
        <View style={styles.picker}>
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Previous unit"
            onPress={onPrevious}
            disabled={!onPrevious}
            variant="surface"
            iconSize={22}
          />
          <UnitButton unit={unit} number={unitNumber} open={menuOpen} onPress={onToggleMenu} />
          <IconButton
            icon={ChevronRight}
            accessibilityLabel="Next unit"
            onPress={onNext}
            disabled={!onNext}
            variant="surface"
            iconSize={22}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The current unit; opens the list of units. */
function UnitButton({ unit, number, open, onPress }: { unit: Unit; number: number; open: boolean; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withTiming(open ? 180 : 0, { duration: reduceMotion ? 0 : motion.base }));
  }, [open, reduceMotion, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Unit ${number}: ${unit.title}`}
      accessibilityHint={open ? 'Closes the list of units' : 'Opens a list of every unit to pick from'}
      accessibilityState={{ expanded: open }}
      style={[styles.unitButton, open ? styles.unitButtonOpen : null]}>
      <View style={styles.unitText}>
        <Text variant="tiny" color={colors.sky700}>
          UNIT {number}
        </Text>
        <Text variant="bodyStrong" numberOfLines={1}>
          {unit.title}
        </Text>
      </View>
      <Animated.View style={chevronStyle}>
        <ChevronDown size={18} color={colors.sky700} strokeWidth={2.4} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  nav: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md },
  picker: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.input,
    borderWidth: 1.5,
    borderColor: colors.sky100,
    backgroundColor: colors.sky50,
  },
  unitButtonOpen: { borderColor: colors.sky500 },
  unitText: { flex: 1 },
});
