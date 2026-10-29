import { match } from '@/content/lessons/build';
import type { Unit, UnitExercise, UnitLesson } from '@/content/lessons/types';
import type { KeyPhrase } from '@/types/api';

import { shuffled } from './lessons';
import { lessonKey, type UnitProgress } from './unitProgress';

export function isLessonDone(progress: UnitProgress, unitId: string, lessonId: string) {
  return lessonKey(unitId, lessonId) in progress.lessons;
}

export function isCheckpointDone(progress: UnitProgress, unitId: string) {
  return unitId in progress.checkpoints;
}

export function lessonsDone(unit: Unit, progress: UnitProgress) {
  return unit.lessons.filter((lesson) => isLessonDone(progress, unit.id, lesson.id)).length;
}

/** Every lesson and the checkpoint. */
export function isUnitDone(unit: Unit, progress: UnitProgress) {
  return unit.lessons.length > 0 && lessonsDone(unit, progress) === unit.lessons.length && isCheckpointDone(progress, unit.id);
}

export function firstUnfinished(unit: Unit, progress: UnitProgress): UnitLesson | undefined {
  return unit.lessons.find((lesson) => !isLessonDone(progress, unit.id, lesson.id));
}

export type ContinueTarget =
  | { kind: 'lesson'; unit: Unit; lesson: UnitLesson; number: number; firstEver: boolean }
  | { kind: 'checkpoint'; unit: Unit }
  | { kind: 'complete' };

/**
 * What the Continue card offers: the unit opened most recently (its next lesson, then its
 * checkpoint), then the first unfinished lesson in course order, then any checkpoint left.
 */
export function continueTarget(units: Unit[], progress: UnitProgress): ContinueTarget {
  const open = units.filter((unit) => unit.lessons.length > 0);
  const firstEver = Object.keys(progress.lessons).length === 0 && Object.keys(progress.checkpoints).length === 0;
  const lessonIn = (unit: Unit): ContinueTarget | null => {
    const lesson = firstUnfinished(unit, progress);
    return lesson ? { kind: 'lesson', unit, lesson, number: unit.lessons.indexOf(lesson) + 1, firstEver } : null;
  };

  const last = open.find((unit) => unit.id === progress.lastUnitId);
  if (last) {
    const target = lessonIn(last);
    if (target) return target;
    if (!isCheckpointDone(progress, last.id)) return { kind: 'checkpoint', unit: last };
  }
  for (const unit of open) {
    const target = lessonIn(unit);
    if (target) return target;
  }
  const unit = open.find((item) => !isCheckpointDone(progress, item.id));
  return unit ? { kind: 'checkpoint', unit } : { kind: 'complete' };
}

/** The unit to suggest after this one: the next one that isn't done, in course order. */
export function nextUnit(units: Unit[], currentId: string, progress: UnitProgress): Unit | null {
  const open = units.filter((unit) => unit.lessons.length > 0);
  const start = open.findIndex((unit) => unit.id === currentId);
  const ordered = [...open.slice(start + 1), ...open.slice(0, Math.max(start, 0))];
  return ordered.find((unit) => !isUnitDone(unit, progress)) ?? null;
}

const CHECKPOINT_SIZE = 9;

/** Short, distinct words from the unit's lessons, for a match-the-pairs warm-up. */
function matchableWords(unit: Unit): KeyPhrase[] {
  const hanzi = new Set<string>();
  const english = new Set<string>();
  const words: KeyPhrase[] = [];
  for (const word of unit.lessons.flatMap((lesson) => lesson.words)) {
    if (word.english.startsWith('(') || word.english.length > 24) continue;
    if (hanzi.has(word.hanzi) || english.has(word.english)) continue;
    hanzi.add(word.hanzi);
    english.add(word.english);
    words.push(word);
  }
  return words;
}

/**
 * A unit review: a match-the-pairs warm-up from the unit's words, then questions from its
 * lessons, at least one from each, in a new random order every time.
 */
export function checkpointExercises(unit: Unit): UnitExercise[] {
  const perLesson = unit.lessons.map((lesson) => shuffled(lesson.exercises.filter((exercise) => exercise.kind !== 'match')));
  const firsts = perLesson.flatMap((list) => list.slice(0, 1));
  const rest = shuffled(perLesson.flatMap((list) => list.slice(1)));

  const words = matchableWords(unit);
  const warmUp = words.length >= 4 ? [match(shuffled(words).slice(0, 5), 'Every word here is from this unit.', 'Warm up: match the pairs')] : [];
  const picked = [...firsts, ...rest].slice(0, Math.max(firsts.length, CHECKPOINT_SIZE - warmUp.length));
  return [...warmUp, ...shuffled(picked)];
}
