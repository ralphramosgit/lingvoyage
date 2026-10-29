import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Mic } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { LessonCompleteView, UpNext } from '@/components/lesson/LessonComplete';
import { LessonPlayer } from '@/components/lesson/LessonPlayer';
import { UnitNotFound } from '@/components/units/UnitNotFound';
import type { Unit, UnitLesson } from '@/content/lessons/types';
import { findUnit, UNITS } from '@/content/lessons/units';
import { stopPlayback } from '@/lib/audio';
import { checkpointExercises, firstUnfinished, isUnitDone, nextUnit } from '@/lib/course';
import { recordCheckpoint, setLastUnit, useUnitProgress } from '@/lib/unitProgress';

function exitToUnit(unitId: string) {
  stopPlayback();
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/unit/[unitId]', params: { unitId } });
}

export default function CheckpointScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const unit = findUnit(unitId);

  useEffect(() => () => stopPlayback(), []);
  useEffect(() => {
    if (unit) setLastUnit(unit.id);
  }, [unit]);

  if (!unit || unit.lessons.length === 0) return <UnitNotFound />;
  return <CheckpointFlow key={unit.id} unit={unit} />;
}

function CheckpointFlow({ unit }: { unit: Unit }) {
  const progress = useUnitProgress();
  // Picked once, so the questions don't reshuffle while the learner is answering them.
  const [exercises] = useState(() => checkpointExercises(unit));
  const [unitWasDone, setUnitWasDone] = useState(false);

  const openLesson = (target: UnitLesson) => {
    stopPlayback();
    router.replace({ pathname: '/unit/[unitId]/lesson/[lessonId]', params: { unitId: unit.id, lessonId: target.id } });
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
      title={`Checkpoint: ${unit.title}`}
      exercises={exercises}
      exitHint="Goes back to the unit"
      onExit={() => exitToUnit(unit.id)}
      onFinished={(firstTry, total) => {
        setUnitWasDone(isUnitDone(unit, progress));
        recordCheckpoint(unit.id, firstTry, total);
      }}
      renderDone={({ firstTry, total, bottomInset }) => {
        const unfinished = firstUnfinished(unit, progress);
        const following = nextUnit(UNITS, unit.id, progress);
        const unitComplete = !unitWasDone && isUnitDone(unit, progress);
        return (
          <LessonCompleteView
            heading={unitComplete ? 'Unit complete!' : 'Checkpoint done!'}
            title={unit.title}
            firstTry={firstTry}
            total={total}
            bottomInset={bottomInset}>
            {unfinished ? (
              <>
                <UpNext title={unfinished.title} />
                <Button label="Finish the lessons" icon={ArrowRight} iconPosition="right" onPress={() => openLesson(unfinished)} />
              </>
            ) : null}
            {!unfinished && following ? (
              <>
                <UpNext title={following.title} />
                <Button label="Next unit" icon={ArrowRight} iconPosition="right" onPress={() => openUnit(following)} />
              </>
            ) : null}
            {unit.encounterId ? (
              <Button
                label="Now try it for real"
                icon={Mic}
                variant={unfinished || following ? 'secondary' : 'primary'}
                onPress={openEncounter}
              />
            ) : null}
            <Button label="Back to the unit" icon={ArrowLeft} variant="ghost" size="md" onPress={() => exitToUnit(unit.id)} />
          </LessonCompleteView>
        );
      }}
    />
  );
}
