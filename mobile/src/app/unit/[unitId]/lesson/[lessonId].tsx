import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Mic, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { LessonCompleteView, UpNext } from '@/components/lesson/LessonComplete';
import { LessonIntro } from '@/components/lesson/LessonIntro';
import { LessonPlayer } from '@/components/lesson/LessonPlayer';
import { UnitNotFound } from '@/components/units/UnitNotFound';
import type { Unit, UnitLesson } from '@/content/lessons/types';
import { findUnit, UNITS } from '@/content/lessons/units';
import { cityName, useCities } from '@/hooks/useCities';
import { usePack } from '@/hooks/usePack';
import { stopPlayback } from '@/lib/audio';
import { isCheckpointDone, isLessonDone, isUnitDone, nextUnit } from '@/lib/course';
import { nextLesson } from '@/lib/lessons';
import { localUnitNotes } from '@/lib/localCourse';
import { recordLesson, setLastUnit, useUnitProgress } from '@/lib/unitProgress';
import { colors } from '@/theme/theme';

/** Back to the unit screen. */
function exitToUnit(unitId: string) {
  stopPlayback();
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/unit/[unitId]', params: { unitId } });
}

export default function UnitLessonScreen() {
  const { unitId, lessonId } = useLocalSearchParams<{ unitId: string; lessonId: string }>();
  const unit = findUnit(unitId);
  const lessonIndex = unit ? unit.lessons.findIndex((lesson) => lesson.id === lessonId) : -1;
  const cityPack = usePack();
  const { cities } = useCities();

  useEffect(() => () => stopPlayback(), []);
  useEffect(() => {
    if (unit) setLastUnit(unit.id);
  }, [unit]);

  // A local practice lesson (local-<city>-<unit>, issue #40) comes from the city pack, not the course.
  if (unit && lessonId?.startsWith('local-')) {
    const local = localUnitNotes(cityPack.pack, unit.id)?.lesson;
    if (local && local.id === lessonId && cityPack.city) {
      return <LocalLessonFlow key={local.id} unit={unit} lesson={local} city={cityName(cities, cityPack.city)} />;
    }
    if (cityPack.arriving) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.sky600} size="large" />
        </View>
      );
    }
    return <UnitNotFound />;
  }

  if (!unit || lessonIndex < 0) return <UnitNotFound />;

  // Keyed so moving to the next lesson starts from a clean slate.
  const lesson = unit.lessons[lessonIndex];
  return <UnitLessonFlow key={lesson.id} unit={unit} lesson={lesson} number={lessonIndex + 1} />;
}

function UnitLessonFlow({ unit, lesson, number }: { unit: Unit; lesson: UnitLesson; number: number }) {
  const progress = useUnitProgress();
  // Whether the unit was already done before this lesson, so "Unit complete!" only shows once.
  const [unitWasDone, setUnitWasDone] = useState(false);

  const openLesson = (target: UnitLesson) => {
    stopPlayback();
    router.replace({ pathname: '/unit/[unitId]/lesson/[lessonId]', params: { unitId: unit.id, lessonId: target.id } });
  };
  const openCheckpoint = () => {
    stopPlayback();
    router.replace({ pathname: '/unit/[unitId]/checkpoint', params: { unitId: unit.id } });
  };
  const openUnit = (target: Unit) => {
    stopPlayback();
    router.replace({ pathname: '/unit/[unitId]', params: { unitId: target.id } });
  };
  const openEncounter = () => {
    stopPlayback();
    router.replace({ pathname: '/encounter/[id]', params: { id: unit.encounterId ?? '' } });
  };

  return (
    <LessonPlayer
      title={lesson.title}
      exercises={lesson.exercises}
      renderLearn={(onAudioError) => (
        <LessonIntro lesson={lesson} number={number} total={unit.lessons.length} onAudioError={onAudioError} />
      )}
      action={
        unit.encounterId
          ? { label: 'Encounter', icon: Mic, hint: 'Leaves the lesson and opens the matching encounter', onPress: openEncounter }
          : undefined
      }
      exitHint="Goes back to the unit"
      onExit={() => exitToUnit(unit.id)}
      onFinished={(firstTry, total) => {
        setUnitWasDone(isUnitDone(unit, progress));
        recordLesson(unit.id, lesson.id, firstTry, total);
      }}
      renderDone={({ firstTry, total, bottomInset }) => {
        // `progress` already includes this lesson here.
        const next = nextLesson(unit.lessons, lesson.id, (id) => isLessonDone(progress, unit.id, id));
        const checkpointDone = isCheckpointDone(progress, unit.id);
        const following = nextUnit(UNITS, unit.id, progress);
        const unitComplete = !unitWasDone && isUnitDone(unit, progress);
        return (
          <LessonCompleteView
            heading={unitComplete ? 'Unit complete!' : 'Lesson complete!'}
            title={lesson.title}
            firstTry={firstTry}
            total={total}
            bottomInset={bottomInset}>
            {next ? (
              <>
                <UpNext title={next.title} />
                <Button label="Next lesson" icon={ArrowRight} iconPosition="right" onPress={() => openLesson(next)} />
              </>
            ) : null}
            {!next && !checkpointDone ? (
              <>
                <UpNext title="Checkpoint: review the unit" />
                <Button label="Start checkpoint" icon={Trophy} onPress={openCheckpoint} />
              </>
            ) : null}
            {!next && checkpointDone && following ? (
              <>
                <UpNext title={following.title} />
                <Button label="Next unit" icon={ArrowRight} iconPosition="right" onPress={() => openUnit(following)} />
              </>
            ) : null}
            {unit.encounterId ? (
              <Button label="Now try it for real" icon={Mic} variant="secondary" onPress={openEncounter} />
            ) : null}
            <Button label="Back to the unit" icon={ArrowLeft} variant="ghost" size="md" onPress={() => exitToUnit(unit.id)} />
          </LessonCompleteView>
        );
      }}
    />
  );
}

/**
 * A city pack's practice lesson in the same player. Its tick is saved like any lesson's, but it isn't in
 * the unit's lessons, so it never counts toward finishing the unit and isn't in the checkpoint.
 */
function LocalLessonFlow({ unit, lesson, city }: { unit: Unit; lesson: UnitLesson; city: string }) {
  return (
    <LessonPlayer
      title={lesson.title}
      exercises={lesson.exercises}
      renderLearn={(onAudioError) => (
        <LessonIntro
          lesson={lesson}
          number={1}
          total={1}
          eyebrow={`LOCAL PRACTICE · ${city.toUpperCase()}`}
          onAudioError={onAudioError}
        />
      )}
      exitHint="Goes back to the unit"
      onExit={() => exitToUnit(unit.id)}
      onFinished={(firstTry, total) => recordLesson(unit.id, lesson.id, firstTry, total)}
      renderDone={({ firstTry, total, bottomInset }) => (
        <LessonCompleteView heading="Lesson complete!" title={lesson.title} firstTry={firstTry} total={total} bottomInset={bottomInset}>
          <Button label="Back to the unit" icon={ArrowLeft} onPress={() => exitToUnit(unit.id)} />
        </LessonCompleteView>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
