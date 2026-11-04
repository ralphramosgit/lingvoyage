import * as Haptics from 'expo-haptics';
import { ArrowRight, type LucideIcon, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { UnitExercise } from '@/content/lessons/types';
import { stopPlayback } from '@/lib/audio';
import { useSettings } from '@/lib/settings';
import { playSound } from '@/lib/sounds';
import { hit, HULL, HullLeftContext, NEW_VOYAGE, retryOrder, sailOn } from '@/lib/voyage';
import { colors, layout, radii, spacing } from '@/theme/theme';
import type { KeyPhrase } from '@/types/api';

import { ExerciseStep } from './ExerciseStep';
import { HullBar } from './HullBar';
import { Shipwreck } from './Shipwreck';
import { VoyageTrack } from './VoyageTrack';

/** sunk: challenge mode only, when the hull runs out. */
type Phase = 'learn' | 'practice' | 'sunk' | 'done';

/** Queued after whatever is being read out, like the question's own feedback. */
function announce(message: string) {
  AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
}

/** A shortcut pill in the header, like "Start encounter". */
export type PlayerAction = {
  label: string;
  icon: LucideIcon;
  hint: string;
  onPress: () => void;
};

/**
 * Runs a lesson: the learn step (if there is one), the questions one at a time with the boat
 * sailing toward port, then the wrap-up. Used by the encounter practice lessons, the Lessons tab
 * and the Quiz tab. With challenge mode on (issue #61) the boat has a hull: each miss costs some,
 * and if it sinks the learner sees what sank it and sets sail again.
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
  const challenge = settings.challengeMode;

  const [phase, setPhase] = useState<Phase>(renderLearn ? 'learn' : 'practice');
  const [index, setIndex] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  // Challenge mode: the hull and what's been missed. A retry is a new round, with the missed questions first.
  const [voyage, setVoyage] = useState(NEW_VOYAGE);
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<number[] | null>(null);

  const total = exercises.length;
  // The question being asked, as an index into `exercises`.
  const current = order?.[index] ?? index;
  let progress = 0;
  if (phase === 'practice' || phase === 'sunk') progress = index / total;
  else if (phase === 'done') progress = 1;

  let progressLabel = `${index + 1}/${total}`;
  if (phase === 'learn') progressLabel = 'Learn';
  else if (phase === 'done') progressLabel = `${total}/${total}`;

  const onExerciseDone = (rightFirstTime: boolean) => {
    stopPlayback();
    setAudioError(null);
    const score = rightFirstTime ? firstTry + 1 : firstTry;
    setFirstTry(score);
    if (challenge) {
      const next = sailOn(voyage, rightFirstTime);
      if (next.patches > voyage.patches) {
        playSound('patch');
        announce(`Leak patched! Hull ${next.hull} of ${HULL}.`);
      }
      setVoyage(next);
    }
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    onFinished(score, total);
    playSound('complete');
    setPhase('done');
  };

  const onMiss = (phrase: KeyPhrase) => {
    if (!challenge) return;
    const next = hit(voyage, current, phrase);
    setVoyage(next);
    // This question had already cost its most.
    if (next.hits === voyage.hits) return;
    if (next.hull > 0) {
      playSound('hullHit');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      announce(`The boat took a hit. Hull ${next.hull} of ${HULL}.`);
      return;
    }
    playSound('sink');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    announce("The boat sank! Have a look at what sank it, then retry when you're ready.");
    setPhase('sunk');
  };

  /** After a sinking: a full hull and the missed questions first, from the learn step or straight to the questions. */
  const setSail = (from: 'learn' | 'practice') => {
    stopPlayback();
    setAudioError(null);
    setOrder(retryOrder(total, voyage.missed));
    setVoyage(NEW_VOYAGE);
    setIndex(0);
    setFirstTry(0);
    setRound((count) => count + 1);
    setPhase(from);
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
          <VoyageTrack progress={progress} hull={challenge ? voyage.hull : null} hits={voyage.hits} sunk={phase === 'sunk'} />
          <Text variant="tiny" color={colors.inkMuted} style={styles.progressText}>
            {progressLabel}
          </Text>
        </View>
        {challenge ? (
          <View style={styles.column}>
            <HullBar hull={voyage.hull} hits={voyage.hits} patches={voyage.patches} />
          </View>
        ) : null}
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
          key={`${round}/${index}`}
          exercise={exercises[current]}
          isLast={index + 1 === total}
          showPinyin={settings.showPinyin}
          tapToHear={settings.tapToHear}
          bottomInset={insets.bottom}
          onAudioError={setAudioError}
          onMiss={onMiss}
          onDone={onExerciseDone}
        />
      ) : null}

      {phase === 'sunk' ? (
        <Shipwreck
          reached={index}
          total={total}
          wrecks={voyage.wrecks}
          bottomInset={insets.bottom}
          exitHint={exitHint}
          onAudioError={setAudioError}
          onRetry={() => setSail('practice')}
          onReview={renderLearn ? () => setSail('learn') : undefined}
          onExit={onExit}
        />
      ) : null}

      {phase === 'done' ? (
        <HullLeftContext value={challenge ? voyage.hull : null}>
          {renderDone({ firstTry, total, bottomInset: insets.bottom })}
        </HullLeftContext>
      ) : null}
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
  audioError: { paddingTop: spacing.xs },
  learnBody: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  dock: {
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
