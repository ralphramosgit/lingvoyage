import { createContext } from 'react';

import { MISSES_BEFORE_REVEAL } from '@/lib/lessons';
import type { KeyPhrase } from '@/types/api';

/**
 * Challenge mode (issue #61): a round of questions is a voyage. The boat starts with a full hull,
 * each miss costs one, and at zero it sinks and the round starts over. Off by default: lessons stay
 * encouraging unless the learner asks for the challenge.
 */
export const HULL = 5;

/** A question costs at most this much hull: the misses before its answer is shown. */
export const MAX_DAMAGE_PER_QUESTION = MISSES_BEFORE_REVEAL;

/** Right-first-time answers in a row that patch one leak. */
export const REPAIR_STREAK = 3;

/** At or below this the seagull gets worried and the hull bar turns yellow, then red. */
export const LOW_HULL = 2;

export type Voyage = {
  hull: number;
  /** Right-first-time answers in a row since the last miss or patch. */
  streak: number;
  /** Hull the current question has cost so far. */
  questionDamage: number;
  /** Count up on every hit and every patch, so the boat and the hull bar can react to each one. */
  hits: number;
  patches: number;
  /** Questions missed this round (indexes into the lesson's questions), in the order they were missed. */
  missed: number[];
  /** The Chinese that was missed, for the review after a sinking. */
  wrecks: KeyPhrase[];
};

export const NEW_VOYAGE: Voyage = { hull: HULL, streak: 0, questionDamage: 0, hits: 0, patches: 0, missed: [], wrecks: [] };

/** A miss on question `question`: the hull takes a hit, unless that question has already cost its most. */
export function hit(voyage: Voyage, question: number, phrase: KeyPhrase): Voyage {
  const damaging = voyage.questionDamage < MAX_DAMAGE_PER_QUESTION;
  return {
    ...voyage,
    hull: damaging ? voyage.hull - 1 : voyage.hull,
    streak: 0,
    questionDamage: damaging ? voyage.questionDamage + 1 : voyage.questionDamage,
    hits: damaging ? voyage.hits + 1 : voyage.hits,
    missed: voyage.missed.includes(question) ? voyage.missed : [...voyage.missed, question],
    wrecks: voyage.wrecks.some((item) => item.hanzi === phrase.hanzi) ? voyage.wrecks : [...voyage.wrecks, phrase],
  };
}

/** A question done. Right first time builds the streak, and every REPAIR_STREAK in a row patches a leak. */
export function sailOn(voyage: Voyage, rightFirstTime: boolean): Voyage {
  const streak = rightFirstTime ? voyage.streak + 1 : 0;
  const patch = streak >= REPAIR_STREAK && voyage.hull < HULL;
  return {
    ...voyage,
    hull: patch ? voyage.hull + 1 : voyage.hull,
    streak: streak >= REPAIR_STREAK ? 0 : streak,
    questionDamage: 0,
    patches: patch ? voyage.patches + 1 : voyage.patches,
  };
}

/** The question order for a retry: the missed ones first, while their answers are fresh, then the rest in order. */
export function retryOrder(total: number, missed: readonly number[]): number[] {
  const rest = Array.from({ length: total }, (_, index) => index).filter((index) => !missed.includes(index));
  return [...missed, ...rest];
}

/** The hull left at the end of a challenge-mode round, for the wrap-up. null outside challenge mode. */
export const HullLeftContext = createContext<number | null>(null);
