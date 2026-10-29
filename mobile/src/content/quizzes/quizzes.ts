import { PARTS, UNITS } from '@/content/lessons/units';
import { checkpointExercises } from '@/lib/course';

import type { Quiz, QuizSection, QuizSectionId } from './types';

export const QUIZ_SECTIONS: QuizSection[] = [
  { id: 'units', tab: 'Units', title: 'By unit', summary: 'Quizzes on one unit at a time.' },
  { id: 'mixed', tab: 'Mixed', title: 'Mixed review', summary: 'Questions from across the course, to see what stuck.' },
  { id: 'skills', tab: 'Skills', title: 'Skill drills', summary: 'One skill at a time, across every unit.' },
];

// Placeholders until the real quizzes are planned, once the lessons are final: one practice
// quiz per unit, picked from its lessons' questions the same way as a checkpoint.
const UNIT_QUIZZES: Quiz[] = UNITS.filter((unit) => unit.lessons.length > 0).map(
  (unit): Quiz => ({
    id: `${unit.id}-practice`,
    section: 'units',
    unitId: unit.id,
    title: `${unit.title}: practice quiz`,
    summary: 'Questions from every lesson in the unit.',
    icon: unit.icon,
    exercises: checkpointExercises(unit),
  }),
);

const MIXED_QUIZZES: Quiz[] = [
  {
    id: 'everything',
    section: 'mixed',
    title: 'Everything so far',
    summary: "Questions from every lesson you've finished.",
    icon: 'Shuffle',
    exercises: [],
  },
  ...PARTS.map(
    (part): Quiz => ({
      id: `part-${part.id}`,
      section: 'mixed',
      title: `${part.tab} test`,
      summary: `Every unit in "${part.title}".`,
      icon: 'Layers',
      exercises: [],
    }),
  ),
];

const SKILL_QUIZZES: Quiz[] = [
  { id: 'tones', section: 'skills', title: 'Tones', summary: 'Hear a syllable, pick its tone.', icon: 'AudioLines', exercises: [] },
  { id: 'listening', section: 'skills', title: 'Listening', summary: 'Understand it without seeing it.', icon: 'Ear', exercises: [] },
  { id: 'numbers-prices', section: 'skills', title: 'Numbers and prices', summary: 'Prices, times and room numbers.', icon: 'Hash', exercises: [] },
  { id: 'reading', section: 'skills', title: 'Reading characters', summary: 'Characters with the pinyin hidden.', icon: 'Languages', exercises: [] },
];

export const QUIZZES: Quiz[] = [...UNIT_QUIZZES, ...MIXED_QUIZZES, ...SKILL_QUIZZES];

if (__DEV__) {
  const ids = new Set<string>();
  for (const quiz of QUIZZES) {
    if (ids.has(quiz.id)) throw new Error(`Two quizzes have the id "${quiz.id}"`);
    ids.add(quiz.id);
  }
}

export function findQuiz(id: string | undefined): Quiz | undefined {
  return QUIZZES.find((quiz) => quiz.id === id);
}

/** The Mixed or Skills section's quizzes. */
export function quizzesIn(section: QuizSectionId): Quiz[] {
  return QUIZZES.filter((quiz) => quiz.section === section);
}

export function unitQuizzes(unitId: string): Quiz[] {
  return QUIZZES.filter((quiz) => quiz.unitId === unitId);
}

/** Quizzes with questions, not "coming soon" ones. */
export function readyQuizzes(unitId: string): number {
  return unitQuizzes(unitId).filter((quiz) => quiz.exercises.length > 0).length;
}
