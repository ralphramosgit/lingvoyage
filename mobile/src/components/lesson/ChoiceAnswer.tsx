import { Check, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, motion, radii, spacing } from '@/theme/theme';
import type { ChoiceExercise, LessonOption } from '@/types/api';

type OptionState = 'idle' | 'selected' | 'missed' | 'right';

const OPTION_STYLES: Record<OptionState, { bg: string; border: string }> = {
  idle: { bg: colors.surface, border: colors.line },
  selected: { bg: colors.sky50, border: colors.sky500 },
  missed: { bg: '#FFFBEB', border: '#FCE7A5' },
  right: { bg: '#F0FDF4', border: colors.success },
};

/** Multiple-choice options. `order` is the shuffled order of option indexes. */
export function ChoiceAnswer({
  exercise,
  order,
  selected,
  missed,
  locked,
  showRight,
  showPinyin,
  onSelect,
}: {
  exercise: ChoiceExercise;
  order: number[];
  selected: number | null;
  /** Options already tried that weren't right. */
  missed: number[];
  locked: boolean;
  /** Highlight the right option (after a right answer, or once it's revealed). */
  showRight: boolean;
  showPinyin: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {order.map((optionIndex, position) => {
        const option = exercise.options[optionIndex];
        let state: OptionState = 'idle';
        if (showRight && optionIndex === exercise.answer) state = 'right';
        else if (missed.includes(optionIndex)) state = 'missed';
        else if (selected === optionIndex) state = 'selected';
        const palette = OPTION_STYLES[state];
        const disabled = locked || state === 'missed';

        return (
          <Animated.View key={optionIndex} entering={FadeInDown.duration(motion.base).delay(position * motion.stagger)}>
            <PressableScale
              onPress={() => onSelect(optionIndex)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={optionLabel(option)}
              accessibilityHint={state === 'missed' ? 'Already tried' : undefined}
              accessibilityState={{ selected: selected === optionIndex, disabled, checked: state === 'right' }}
              style={[styles.option, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <View style={[styles.flex, state === 'missed' ? styles.faded : null]}>
                {option.hanzi ? (
                  <>
                    <Text variant="hanzi">{option.hanzi}</Text>
                    {showPinyin && option.pinyin ? (
                      <Text variant="label" color={colors.inkMuted}>
                        {option.pinyin}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text variant="bodyStrong">{option.english}</Text>
                )}
              </View>
              {state === 'right' ? (
                <View style={[styles.mark, styles.markRight]}>
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
              {state === 'missed' ? (
                <View style={[styles.mark, styles.markMissed]}>
                  <X size={14} color="#A16207" strokeWidth={3} />
                </View>
              ) : null}
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

function optionLabel(option: LessonOption) {
  if (!option.hanzi) return option.english;
  return option.pinyin ? `${option.hanzi}, ${option.pinyin}` : option.hanzi;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    borderWidth: 2,
  },
  faded: { opacity: 0.55 },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markRight: { backgroundColor: colors.success },
  markMissed: { backgroundColor: colors.sun100 },
});
