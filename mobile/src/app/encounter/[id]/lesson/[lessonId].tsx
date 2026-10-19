import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronLeft, Mic, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { ExerciseStep } from '@/components/lesson/ExerciseStep';
import { LessonComplete } from '@/components/lesson/LessonComplete';
import { LessonIntro } from '@/components/lesson/LessonIntro';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useScenario } from '@/hooks/useScenarios';
import { stopPlayback } from '@/lib/audio';
import { markLessonFinished, useLessonFinished } from '@/lib/lessonProgress';
import { nextLesson } from '@/lib/lessons';
import { useSettings } from '@/lib/settings';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';
import type { Lesson, Scenario } from '@/types/api';

/** Back to the encounter screen (with the lesson list and key phrases). */
function exitLesson(scenarioId: string) {
  stopPlayback();
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/encounter/[id]', params: { id: scenarioId } });
}

export default function LessonScreen() {
  const { id, lessonId } = useLocalSearchParams<{ id: string; lessonId: string }>();
  const { scenario, loading, error, reload, notFound } = useScenario(id);
  const lessons = scenario?.lessons ?? [];
  const lessonIndex = lessons.findIndex((item) => item.id === lessonId);

  useEffect(() => () => stopPlayback(), []);

  if (!scenario || lessonIndex < 0) {
    return (
      <Screen
        header={
          <View style={styles.backRow}>
            <IconButton
              icon={ChevronLeft}
              accessibilityLabel="Back"
              onPress={() => exitLesson(id ?? '')}
              variant="surface"
              iconSize={22}
            />
          </View>
        }
        contentStyle={styles.center}>
        {loading ? <ActivityIndicator color={colors.sky600} size="large" /> : null}
        {error ? <ErrorState title="Couldn't load this lesson" message={error} onRetry={reload} /> : null}
        {notFound || (scenario && lessonIndex < 0) ? (
          <Text variant="body" align="center" color={colors.inkMuted}>
            This lesson isn&apos;t available anymore.
          </Text>
        ) : null}
      </Screen>
    );
  }

  // Keyed so moving to the next lesson starts from a clean slate.
  return (
    <LessonFlow
      key={lessons[lessonIndex].id}
      scenario={scenario}
      lessons={lessons}
      lesson={lessons[lessonIndex]}
      number={lessonIndex + 1}
    />
  );
}

type Phase = 'learn' | 'practice' | 'done';

function LessonFlow({
  scenario,
  lessons,
  lesson,
  number,
}: {
  scenario: Scenario;
  lessons: Lesson[];
  lesson: Lesson;
  number: number;
}) {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const isFinished = useLessonFinished(scenario.id);

  const [phase, setPhase] = useState<Phase>('learn');
  const [index, setIndex] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [next, setNext] = useState<Lesson | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const total = lesson.exercises.length;
  let progress = 0;
  if (phase === 'practice') progress = index / total;
  else if (phase === 'done') progress = 1;

  const startEncounter = () => {
    stopPlayback();
    // Replace the lesson, so leaving the encounter goes back to the encounter screen.
    router.replace({ pathname: '/encounter/[id]/talk', params: { id: scenario.id } });
  };

  const openLesson = (target: Lesson) => {
    stopPlayback();
    router.replace({ pathname: '/encounter/[id]/lesson/[lessonId]', params: { id: scenario.id, lessonId: target.id } });
  };

  const onExerciseDone = (rightFirstTime: boolean) => {
    stopPlayback();
    setAudioError(null);
    if (rightFirstTime) setFirstTry((count) => count + 1);
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    markLessonFinished(scenario.id, lesson.id);
    setNext(nextLesson(lessons, lesson.id, isFinished));
    setPhase('done');
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={[styles.column, styles.headerRow]}>
          <IconButton
            icon={X}
            accessibilityLabel="Exit lesson"
            accessibilityHint="Goes back to the encounter page"
            onPress={() => exitLesson(scenario.id)}
            iconSize={24}
            color={colors.ink}
          />
          <Text variant="subheading" numberOfLines={1} style={styles.flex}>
            {lesson.title}
          </Text>
          {phase === 'done' ? null : (
            <PressableScale
              onPress={startEncounter}
              accessibilityRole="button"
              accessibilityLabel="Start encounter"
              accessibilityHint="Leaves the lesson and starts talking with the character"
              style={styles.skip}>
              <Mic size={16} color={colors.sky700} strokeWidth={2.4} />
              <Text variant="label" color={colors.sky700} numberOfLines={1}>
                Start encounter
              </Text>
            </PressableScale>
          )}
        </View>
        <View style={[styles.column, styles.progressRow]}>
          <ProgressBar value={progress} />
          <Text variant="tiny" color={colors.inkMuted} style={styles.progressText}>
            {phase === 'learn' ? 'Learn' : `${phase === 'done' ? total : index + 1}/${total}`}
          </Text>
        </View>
        {audioError ? (
          <View style={[styles.column, styles.audioError]}>
            <FormMessage message={audioError} />
          </View>
        ) : null}
      </View>

      {phase === 'learn' ? (
        <>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.column, styles.learnBody]}
            showsVerticalScrollIndicator={false}>
            <LessonIntro lesson={lesson} number={number} total={lessons.length} onAudioError={setAudioError} />
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
          exercise={lesson.exercises[index]}
          isLast={index + 1 === total}
          showPinyin={settings.showPinyin}
          bottomInset={insets.bottom}
          onAudioError={setAudioError}
          onDone={onExerciseDone}
        />
      ) : null}

      {phase === 'done' ? (
        <LessonComplete
          lesson={lesson}
          firstTry={firstTry}
          total={total}
          next={next}
          characterName={scenario.character.name_english}
          bottomInset={insets.bottom}
          onNext={() => next && openLesson(next)}
          onStartEncounter={startEncounter}
          onBack={() => exitLesson(scenario.id)}
        />
      ) : null}
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
  center: { justifyContent: 'center', alignItems: 'stretch' },
  backRow: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
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
  skip: {
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
