import { ArrowRight, type LucideIcon, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { UnitExercise } from '@/content/lessons/types';
import { stopPlayback } from '@/lib/audio';
import { useSettings } from '@/lib/settings';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';

import { ExerciseStep } from './ExerciseStep';

type Phase = 'learn' | 'practice' | 'done';

/** A shortcut pill in the header, like "Start encounter". */
export type PlayerAction = {
  label: string;
  icon: LucideIcon;
  hint: string;
  onPress: () => void;
};

/**
 * Runs a lesson: the learn step (if there is one), the questions one at a time with a
 * progress bar, then the wrap-up. Used by the encounter practice lessons and the Lessons tab.
 * Mount it with a `key` per lesson so moving to the next one starts from a clean slate.
 */
export function LessonPlayer({
  title,
  exercises,
  renderLearn,
  action,
  exitHint,
  onExit,
  onFinished,
  renderDone,
}: {
  title: string;
  exercises: UnitExercise[];
  /** The learn step. Leave it out to go straight to the questions, like a checkpoint. */
  renderLearn?: (onAudioError: (message: string) => void) => ReactNode;
  /** Hidden on the wrap-up. */
  action?: PlayerAction;
  exitHint: string;
  onExit: () => void;
  /** Called once, as the last question is done. */
  onFinished: (firstTry: number, total: number) => void;
  renderDone: (result: { firstTry: number; total: number; bottomInset: number }) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();

  const [phase, setPhase] = useState<Phase>(renderLearn ? 'learn' : 'practice');
  const [index, setIndex] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const total = exercises.length;
  let progress = 0;
  if (phase === 'practice') progress = index / total;
  else if (phase === 'done') progress = 1;

  let progressLabel = `${index + 1}/${total}`;
  if (phase === 'learn') progressLabel = 'Learn';
  else if (phase === 'done') progressLabel = `${total}/${total}`;

  const onExerciseDone = (rightFirstTime: boolean) => {
    stopPlayback();
    setAudioError(null);
    const score = rightFirstTime ? firstTry + 1 : firstTry;
    setFirstTry(score);
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    onFinished(score, total);
    setPhase('done');
  };

  const ActionIcon = action?.icon;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={[styles.column, styles.headerRow]}>
          <IconButton
            icon={X}
            accessibilityLabel="Exit lesson"
            accessibilityHint={exitHint}
            onPress={onExit}
            iconSize={24}
            color={colors.ink}
          />
          <Text variant="subheading" numberOfLines={1} style={styles.flex}>
            {title}
          </Text>
          {action && ActionIcon && phase !== 'done' ? (
            <PressableScale
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={action.hint}
              style={styles.action}>
              <ActionIcon size={16} color={colors.sky700} strokeWidth={2.4} />
              <Text variant="label" color={colors.sky700} numberOfLines={1}>
                {action.label}
              </Text>
            </PressableScale>
          ) : null}
        </View>
        <View style={[styles.column, styles.progressRow]}>
          <ProgressBar value={progress} />
          <Text variant="tiny" color={colors.inkMuted} style={styles.progressText}>
            {progressLabel}
          </Text>
        </View>
        {audioError ? (
          <View style={[styles.column, styles.audioError]}>
            <FormMessage message={audioError} />
          </View>
        ) : null}
      </View>

      {phase === 'learn' && renderLearn ? (
        <>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.column, styles.learnBody]}
            showsVerticalScrollIndicator={false}>
            {renderLearn(setAudioError)}
          </ScrollView>
          <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
            <View style={styles.column}>
              <Button
                label="Start practice"
                icon={ArrowRight}
                iconPosition="right"
                accessibilityHint={`${total} questions`}
                onPress={() => {
                  stopPlayback();
                  setAudioError(null);
                  setPhase('practice');
                }}
              />
            </View>
          </View>
        </>
      ) : null}

      {phase === 'practice' ? (
        <ExerciseStep
          key={index}
          exercise={exercises[index]}
          isLast={index + 1 === total}
          showPinyin={settings.showPinyin}
          bottomInset={insets.bottom}
          onAudioError={setAudioError}
          onDone={onExerciseDone}
        />
      ) : null}

      {phase === 'done' ? renderDone({ firstTry, total, bottomInset: insets.bottom }) : null}
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = useSharedValue(value);

  useEffect(() => {
    width.set(withTiming(value, { duration: motion.slow }));
  }, [value, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  header: {
    backgroundColor: colors.bg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.sky50,
    borderWidth: 1,
    borderColor: colors.sky100,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progressText: { minWidth: 36, textAlign: 'right' },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.success },
  audioError: { paddingTop: spacing.xs },
  learnBody: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  dock: {
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
