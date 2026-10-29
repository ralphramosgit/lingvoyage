import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Mic } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { IconButton } from '@/components/IconButton';
import { LessonComplete } from '@/components/lesson/LessonComplete';
import { LessonIntro } from '@/components/lesson/LessonIntro';
import { LessonPlayer } from '@/components/lesson/LessonPlayer';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useScenario } from '@/hooks/useScenarios';
import { stopPlayback } from '@/lib/audio';
import { markLessonFinished, useLessonFinished } from '@/lib/lessonProgress';
import { nextLesson } from '@/lib/lessons';
import { colors, spacing } from '@/theme/theme';
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
  const isFinished = useLessonFinished(scenario.id);
  const [next, setNext] = useState<Lesson | null>(null);

  const startEncounter = () => {
    stopPlayback();
    // Replace the lesson, so leaving the encounter goes back to the encounter screen.
    router.replace({ pathname: '/encounter/[id]/talk', params: { id: scenario.id } });
  };

  const openLesson = (target: Lesson) => {
    stopPlayback();
    router.replace({ pathname: '/encounter/[id]/lesson/[lessonId]', params: { id: scenario.id, lessonId: target.id } });
  };

  return (
    <LessonPlayer
      title={lesson.title}
      exercises={lesson.exercises}
      renderLearn={(onAudioError) => (
        <LessonIntro lesson={lesson} number={number} total={lessons.length} onAudioError={onAudioError} />
      )}
      action={{
        label: 'Start encounter',
        icon: Mic,
        hint: 'Leaves the lesson and starts talking with the character',
        onPress: startEncounter,
      }}
      exitHint="Goes back to the encounter page"
      onExit={() => exitLesson(scenario.id)}
      onFinished={() => {
        markLessonFinished(scenario.id, lesson.id);
        setNext(nextLesson(lessons, lesson.id, isFinished));
      }}
      renderDone={({ firstTry, total, bottomInset }) => (
        <LessonComplete
          lesson={lesson}
          firstTry={firstTry}
          total={total}
          next={next}
          characterName={scenario.character.name_english}
          bottomInset={bottomInset}
          onNext={() => next && openLesson(next)}
          onStartEncounter={startEncounter}
          onBack={() => exitLesson(scenario.id)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'stretch' },
  backRow: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
});
