import type { Href } from 'expo-router';

import type { Exercise, KeyPhrase, Lesson, LessonOption } from '@/types/api';

/** Hear Chinese with no text on screen, then pick what it was. The text shows once it's answered. */
export type ListenExercise = {
  kind: 'listen';
  prompt: string;
  /** The Chinese to play: characters, not pinyin, at most 200. */
  audio: string;
  options: LessonOption[];
  /** Index of the right option; the app shuffles them. */
  answer: number;
  hint: string;
  solution: KeyPhrase;
};

/** Tap the Chinese and the English that go together, until every pair is matched. */
export type MatchExercise = {
  kind: 'match';
  prompt: string;
  /** 4 or 5 pairs. */
  pairs: KeyPhrase[];
  hint: string;
};

/** The backend's question types (encounter practice lessons), plus the ones only the Lessons tab uses. */
export type UnitExercise = Exercise | ListenExercise | MatchExercise;

/** A short note on how things are done in China, shown in the learn step. */
export type CultureNote = {
  title: string;
  body: string;
};

export type UnitLesson = Omit<Lesson, 'exercises'> & {
  exercises: UnitExercise[];
  culture?: CultureNote;
};

export type PartId = 'basics' | 'trip' | 'culture';

export type Part = {
  id: PartId;
  title: string;
  /** The short name on the Lessons tab's part tabs. */
  tab: string;
  summary: string;
};

export type Unit = {
  /** Progress is saved by unit and lesson id, so ids never change once shipped. Titles can. */
  id: string;
  part: PartId;
  title: string;
  summary: string;
  /** A lucide icon name, see UnitIcon. */
  icon: string;
  /** Sets the scene on the unit screen: where you are and what's going on. */
  scene?: string;
  /** "You'll be able to" lines, 2 to 4. */
  canDo: string[];
  /** Unit ids this one reuses words and patterns from. */
  buildsOn?: string[];
  /** The matching encounter, e.g. 'airport'. */
  encounterId?: string;
  /** An Essentials page with the reference for this unit. */
  essentials?: { label: string; href: Href };
  /** [] = coming soon. */
  lessons: UnitLesson[];
};
