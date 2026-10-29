import type { LessonOption } from '@/types/api';

import type { Unit, UnitExercise } from './types';

// The same checks the backend runs on its lessons (backend/app/lessons.py), plus the
// Lessons tab's own question types. Run in development so a typo throws straight away
// instead of showing up as a broken question.

const NOT_A_WORD = /[\s，。？！、,.?!…]/g;
const MAX_AUDIO = 200; // POST /tts limit

function checkOptions(options: LessonOption[], answer: number, fail: (problem: string) => never) {
  if (options.length < 2 || options.length > 4) fail('needs 2 to 4 options');
  if (answer < 0 || answer >= options.length) fail(`answer ${answer} is not one of the options`);
  const labels = options.map((option) => option.hanzi || option.english);
  if (!labels.every(Boolean) || new Set(labels).size !== labels.length) fail('every option needs its own hanzi or english');
}

function checkExercise(exercise: UnitExercise, fail: (problem: string) => never) {
  switch (exercise.kind) {
    case 'choice':
      checkOptions(exercise.options, exercise.answer, fail);
      return;
    case 'listen':
      checkOptions(exercise.options, exercise.answer, fail);
      if (!exercise.audio.trim() || exercise.audio.length > MAX_AUDIO) fail(`audio must be 1 to ${MAX_AUDIO} characters`);
      return;
    case 'build': {
      if (exercise.tiles.length < 2) fail('needs at least 2 tiles');
      const built = exercise.tiles.map((tile) => tile.hanzi).join('');
      const target = exercise.solution.hanzi.replace(NOT_A_WORD, '');
      if (built !== target) fail(`tiles spell ${built}, not ${target}`);
      const answerTiles = new Set(exercise.tiles.map((tile) => tile.hanzi));
      if (exercise.extra_tiles.some((tile) => answerTiles.has(tile.hanzi))) fail('an extra tile repeats an answer tile');
      return;
    }
    case 'match': {
      if (exercise.pairs.length < 4 || exercise.pairs.length > 5) fail('needs 4 or 5 pairs');
      const hanzi = new Set(exercise.pairs.map((pair) => pair.hanzi));
      const english = new Set(exercise.pairs.map((pair) => pair.english));
      if (hanzi.size !== exercise.pairs.length || english.size !== exercise.pairs.length) fail('pairs repeat a word');
      return;
    }
  }
}

/** Throws on the first problem, naming the unit, lesson and question. */
export function validateUnits(units: Unit[]) {
  const unitIds = new Set<string>();
  for (const unit of units) {
    const failUnit = (problem: string): never => {
      throw new Error(`Lessons content, unit "${unit.id}": ${problem}`);
    };
    if (unitIds.has(unit.id)) failUnit('two units share this id');
    unitIds.add(unit.id);
    if (unit.lessons.length > 0 && (unit.canDo.length < 2 || unit.canDo.length > 4)) failUnit('needs 2 to 4 canDo lines');

    const lessonIds = new Set<string>();
    for (const lesson of unit.lessons) {
      if (lessonIds.has(lesson.id)) failUnit(`two lessons share the id "${lesson.id}"`);
      lessonIds.add(lesson.id);
      if (lesson.exercises.length === 0) failUnit(`lesson "${lesson.id}" has no questions`);
      lesson.exercises.forEach((exercise, index) => {
        checkExercise(exercise, (problem) =>
          failUnit(`lesson "${lesson.id}", question ${index + 1} (${exercise.prompt}): ${problem}`),
        );
      });
    }
  }
  for (const unit of units) {
    for (const id of unit.buildsOn ?? []) {
      if (!unitIds.has(id)) throw new Error(`Lessons content, unit "${unit.id}": buildsOn names a unit that doesn't exist: "${id}"`);
    }
  }
}
