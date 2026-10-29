import type { UnitExercise } from '@/content/lessons/types';

export type QuizSectionId = 'units' | 'mixed' | 'skills';

export type QuizSection = {
  id: QuizSectionId;
  title: string;
  /** The short name on the Quiz tab's section tabs. */
  tab: string;
  summary: string;
};

export type Quiz = {
  /** Unique across the tab, and permanent once shipped: scores will be saved by it later. */
  id: string;
  section: QuizSectionId;
  /** Units section only: the unit it belongs to. */
  unitId?: string;
  title: string;
  summary: string;
  /** A lucide icon name, see quizIcon. */
  icon: string;
  /** [] = coming soon. */
  exercises: UnitExercise[];
};
