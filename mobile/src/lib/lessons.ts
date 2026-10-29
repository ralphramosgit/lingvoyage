import type { BuildExercise, Lesson } from '@/types/api';

/** Marks the gap in a fill-in-the-blank question (BLANK in backend app/lessons.py). */
export const BLANK = '＿＿';

export function hasBlank(hanzi: string) {
  return hanzi.includes(BLANK);
}

/** A shuffled copy (Fisher-Yates). */
export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickOne(messages: readonly string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

export const RIGHT_MESSAGES = ['Nice work!', 'You got it!', "That's right!", 'Great job!', '太好了! Perfect!'] as const;

export const WRONG_MESSAGES = [
  "Not quite, but you're close!",
  'Almost! Have another go.',
  'Good try! Give it one more shot.',
] as const;

export function isBuildRight(exercise: BuildExercise, built: readonly string[]) {
  return built.join('') === exercise.tiles.map((tile) => tile.hanzi).join('');
}

/** The lesson to suggest next: the first unfinished one after `currentId`, then any unfinished one. */
export function nextLesson<T extends Pick<Lesson, 'id'>>(lessons: T[], currentId: string, isFinished: (id: string) => boolean): T | null {
  const start = lessons.findIndex((lesson) => lesson.id === currentId);
  const ordered = [...lessons.slice(start + 1), ...lessons.slice(0, Math.max(start, 0))];
  return ordered.find((lesson) => !isFinished(lesson.id)) ?? null;
}

/** Encouraging wrap-up for the end of a lesson. */
export function lessonSummary(firstTry: number, total: number): string {
  if (firstTry === total) return 'Every answer right on the first try. You’re ready for this!';
  if (firstTry * 2 >= total) return `${firstTry} of ${total} right on the first try, and you worked out the rest. Great job!`;
  return 'You worked through every question. Mistakes are how it sticks, and you’ll hear these again in the encounter.';
}
