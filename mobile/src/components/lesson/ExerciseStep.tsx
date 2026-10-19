import * as Haptics from 'expo-haptics';
import { ArrowRight, BookOpen, CircleCheck, Lightbulb, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import { hasBlank, isBuildRight, pickOne, RIGHT_MESSAGES, shuffled, WRONG_MESSAGES } from '@/lib/lessons';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';
import type { Exercise, KeyPhrase } from '@/types/api';

import { BuildAnswer } from './BuildAnswer';
import { ChoiceAnswer } from './ChoiceAnswer';

/** After this many misses the answer is shown, so nobody gets stuck. */
const MISSES_BEFORE_REVEAL = 2;

type Status = 'answering' | 'missed' | 'right' | 'revealed';

const PANELS = {
  right: { bg: '#F0FDF4', border: '#BBF7D0', fg: '#166534', icon: CircleCheck },
  missed: { bg: colors.sun100, border: '#FDF0A6', fg: '#854D0E', icon: Lightbulb },
  revealed: { bg: colors.sky50, border: colors.sky100, fg: colors.sky700, icon: BookOpen },
} as const;

/**
 * One question: the prompt, the answer area, and a bottom panel with Hint / Check, then
 * friendly feedback. Mount it with a `key` per question so its state starts fresh.
 */
export function ExerciseStep({
  exercise,
  isLast,
  showPinyin,
  bottomInset,
  onAudioError,
  onDone,
}: {
  exercise: Exercise;
  isLast: boolean;
  showPinyin: boolean;
  bottomInset: number;
  onAudioError: (message: string) => void;
  /** Called on Continue, with whether the first check was right. */
  onDone: (firstTry: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>('answering');
  const [misses, setMisses] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [message, setMessage] = useState('');

  // Choice: options in a shuffled order. Build: answer and extra tiles shuffled together.
  const [order] = useState(() =>
    exercise.kind === 'choice' ? shuffled(exercise.options.map((_, index) => index)) : [],
  );
  const [bank] = useState(() => (exercise.kind === 'build' ? shuffled([...exercise.tiles, ...exercise.extra_tiles]) : []));
  const [selected, setSelected] = useState<number | null>(null);
  const [missedOptions, setMissedOptions] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);

  const answering = status === 'answering';
  const ready = exercise.kind === 'choice' ? selected !== null : picked.length > 0;

  const check = () => {
    if (!ready || !answering) return;
    const right =
      exercise.kind === 'choice'
        ? selected === exercise.answer
        : isBuildRight(
            exercise,
            picked.map((index) => bank[index].hanzi),
          );

    if (right) {
      const cheer = pickOne(RIGHT_MESSAGES);
      setMessage(cheer);
      setStatus('right');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(cheer);
      return;
    }

    const nextMisses = misses + 1;
    setMisses(nextMisses);
    setHintShown(true);
    if (exercise.kind === 'choice' && selected !== null) setMissedOptions((current) => [...current, selected]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (nextMisses >= MISSES_BEFORE_REVEAL) {
      setMessage("Here's the answer");
      setStatus('revealed');
      AccessibilityInfo.announceForAccessibility(`Here's the answer: ${exercise.solution.english}`);
    } else {
      const nudge = pickOne(WRONG_MESSAGES);
      setMessage(nudge);
      setStatus('missed');
      AccessibilityInfo.announceForAccessibility(`${nudge} Hint: ${exercise.hint}`);
    }
  };

  const tryAgain = () => {
    setSelected(null);
    setStatus('answering');
  };

  let lineState: 'building' | 'right' | 'missed' = 'building';
  if (status === 'right') lineState = 'right';
  else if (status === 'missed' || status === 'revealed') lineState = 'missed';

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.column, styles.body]}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.question}>
          <Text variant="heading" accessibilityRole="header">
            {exercise.prompt}
          </Text>
          {exercise.kind === 'choice' && exercise.hanzi ? (
            <View style={styles.questionCard}>
              <View style={styles.flex}>
                <Text variant="hanziLarge">{exercise.hanzi}</Text>
                {showPinyin && exercise.pinyin ? (
                  <Text variant="label" color={colors.inkMuted}>
                    {exercise.pinyin}
                  </Text>
                ) : null}
              </View>
              {hasBlank(exercise.hanzi) ? null : (
                <SpeakerButton text={exercise.hanzi} label="Play it" size={44} onError={onAudioError} />
              )}
            </View>
          ) : null}
        </Animated.View>

        {exercise.kind === 'choice' ? (
          <ChoiceAnswer
            exercise={exercise}
            order={order}
            selected={selected}
            missed={missedOptions}
            locked={!answering}
            showRight={status === 'right' || status === 'revealed'}
            showPinyin={showPinyin}
            onSelect={setSelected}
          />
        ) : (
          <BuildAnswer
            bank={bank}
            picked={picked}
            state={lineState}
            locked={!answering}
            showPinyin={showPinyin}
            onPick={(index) => setPicked((current) => [...current, index])}
            onUnpick={(index) => setPicked((current) => current.filter((item) => item !== index))}
          />
        )}

        {hintShown && answering ? (
          <Animated.View entering={FadeIn.duration(motion.base)} style={styles.hint} accessibilityLiveRegion="polite">
            <Lightbulb size={18} color="#A16207" />
            <Text variant="caption" style={styles.flex}>
              {exercise.hint}
            </Text>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, spacing.md) + spacing.sm }]}>
        <View style={styles.column}>
          {answering ? (
            <View style={styles.actions}>
              {hintShown ? null : (
                <Button
                  label="Hint"
                  icon={Lightbulb}
                  variant="secondary"
                  size="md"
                  onPress={() => setHintShown(true)}
                  accessibilityHint="Shows a clue for this question"
                />
              )}
              <Button label="Check" size="md" disabled={!ready} onPress={check} style={styles.flex} />
            </View>
          ) : (
            <FeedbackPanel
              status={status}
              message={message}
              hint={exercise.hint}
              solution={exercise.solution}
              isLast={isLast}
              onAudioError={onAudioError}
              onTryAgain={tryAgain}
              onContinue={() => onDone(misses === 0)}
            />
          )}
        </View>
      </View>
    </>
  );
}

function FeedbackPanel({
  status,
  message,
  hint,
  solution,
  isLast,
  onAudioError,
  onTryAgain,
  onContinue,
}: {
  status: Exclude<Status, 'answering'>;
  message: string;
  hint: string;
  solution: KeyPhrase;
  isLast: boolean;
  onAudioError: (message: string) => void;
  onTryAgain: () => void;
  onContinue: () => void;
}) {
  const panel = PANELS[status];
  const Icon = panel.icon;
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)}
      style={[styles.panel, { backgroundColor: panel.bg, borderColor: panel.border }]}>
      <View style={styles.panelTitle}>
        <Icon size={22} color={panel.fg} strokeWidth={2.4} />
        <Text variant="subheading" color={panel.fg} style={styles.flex}>
          {message}
        </Text>
      </View>

      {status === 'missed' ? (
        <Text variant="body">
          <Text variant="bodyStrong">Hint: </Text>
          {hint}
        </Text>
      ) : (
        <>
          {status === 'revealed' ? (
            <Text variant="caption" color={colors.inkMuted}>
              This one was tricky. Have a listen, and you&apos;ll have it next time.
            </Text>
          ) : null}
          <View style={styles.solution}>
            <View style={styles.flex}>
              <Text variant="hanzi">{solution.hanzi}</Text>
              <Text variant="label" color={colors.inkMuted}>
                {solution.pinyin}
              </Text>
              <Text variant="caption">{solution.english}</Text>
            </View>
            <SpeakerButton text={solution.hanzi} label={`Play ${solution.english}`} size={44} onError={onAudioError} />
          </View>
        </>
      )}

      {status === 'missed' ? (
        <Button label="Try again" icon={RotateCcw} size="md" onPress={onTryAgain} />
      ) : (
        <Button
          label={isLast ? 'Finish lesson' : 'Continue'}
          icon={ArrowRight}
          iconPosition="right"
          size="md"
          onPress={onContinue}
        />
      )}
    </Animated.View>
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
  body: { gap: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  question: { gap: spacing.md },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hint: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.sun100,
  },
  dock: {
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  panel: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.card, borderWidth: 1.5 },
  panelTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  solution: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
