import type { Quiz } from '@/content/quizzes/types';
import type { LocalPack, LocalQuiz, LocalUnitNotes } from '@/types/api';

/**
 * What the learner's city pack adds to the Lessons and Quiz tabs (issue #40), on top of the course:
 * a unit's "In Chengdu" notes and local practice lesson, and the city's quizzes. Nothing here changes
 * the course itself, its checkpoints or how a unit is finished.
 */

/** The pack's notes for a unit, if it has any. */
export function localUnitNotes(pack: LocalPack | null, unitId: string | undefined): LocalUnitNotes | null {
  return pack?.unit_notes.find((notes) => notes.unit_id === unitId) ?? null;
}

/** A local quiz as the app's Quiz, so the Quiz tab's cards and player work on it unchanged. */
export function toQuiz(quiz: LocalQuiz): Quiz {
  return { id: quiz.id, section: 'local', title: quiz.title, summary: quiz.summary, icon: quiz.icon, exercises: quiz.exercises };
}

export function localQuizzes(pack: LocalPack | null): Quiz[] {
  return (pack?.quizzes ?? []).map(toQuiz);
}
