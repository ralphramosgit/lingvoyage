// Shorthand for writing lesson content. In every helper the first option is the right one:
// the app shuffles options, so content can always list the answer first.

import { BLANK } from '@/lib/lessons';
import type { BuildExercise, ChoiceExercise, KeyPhrase, LessonOption, Tile } from '@/types/api';

import type { ListenExercise, MatchExercise } from './types';

export function p(hanzi: string, pinyin: string, english: string): KeyPhrase {
  return { hanzi, pinyin, english };
}

function en(english: string): LessonOption {
  return { hanzi: '', pinyin: '', english };
}

/** "八 bā" → a Chinese option. The hanzi is everything before the first space. */
function zh(spec: string): LessonOption {
  const space = spec.indexOf(' ');
  return { hanzi: spec.slice(0, space), pinyin: spec.slice(space + 1), english: '' };
}

/** "我 wǒ|要 yào|wifi" → tiles. A tile with no pinyin (like "wifi") shows as written. */
export function tiles(spec: string): Tile[] {
  return spec.split('|').map((part) => {
    const [hanzi, ...pinyin] = part.trim().split(' ');
    return { hanzi, pinyin: pinyin.join(' ') || hanzi };
  });
}

/** `__` in content marks the gap. */
const withBlank = (text: string) => text.replace('__', BLANK);

/** Chinese on screen, English options. */
export function meaning(
  word: KeyPhrase,
  wrong: string[],
  hint: string,
  prompt = 'What does this mean?',
): ChoiceExercise {
  return {
    kind: 'choice',
    prompt,
    hanzi: word.hanzi,
    pinyin: word.pinyin,
    options: [en(word.english), ...wrong.map(en)],
    answer: 0,
    hint,
    solution: word,
  };
}

/** An English question, Chinese options ("hanzi pinyin"). */
export function which(word: KeyPhrase, wrong: string[], hint: string, prompt?: string): ChoiceExercise {
  return {
    kind: 'choice',
    prompt: prompt ?? `How do you say “${word.english}”?`,
    hanzi: '',
    pinyin: '',
    options: [{ hanzi: word.hanzi, pinyin: word.pinyin, english: '' }, ...wrong.map(zh)],
    answer: 0,
    hint,
    solution: word,
  };
}

/** Someone says something (shown, with a play button). Pick what to say back. */
export function reply(prompt: string, said: KeyPhrase, answer: KeyPhrase, wrong: string[], hint: string): ChoiceExercise {
  return {
    kind: 'choice',
    prompt,
    hanzi: said.hanzi,
    pinyin: said.pinyin,
    options: [{ hanzi: answer.hanzi, pinyin: answer.pinyin, english: '' }, ...wrong.map(zh)],
    answer: 0,
    hint,
    solution: answer,
  };
}

/** Fill the gap. `hanzi` and `pinyin` mark it with `__`; options are "hanzi pinyin". */
export function gap(
  english: string,
  hanzi: string,
  pinyin: string,
  options: string[],
  hint: string,
  solution: KeyPhrase,
): ChoiceExercise {
  return {
    kind: 'choice',
    prompt: `Fill in the blank: “${english}”`,
    hanzi: withBlank(hanzi),
    pinyin: withBlank(pinyin),
    options: options.map(zh),
    answer: 0,
    hint,
    solution,
  };
}

/** A question in English with English answers, no Chinese on screen: culture and "what would you do?". */
export function quiz(prompt: string, options: string[], hint: string, solution: KeyPhrase): ChoiceExercise {
  return { kind: 'choice', prompt, hanzi: '', pinyin: '', options: options.map(en), answer: 0, hint, solution };
}

/** Tap the tiles into order to build `solution`. `answer` and `extra` use the tiles() format. */
export function build(
  answer: string,
  extra: string,
  hint: string,
  solution: KeyPhrase,
  prompt = `Build this sentence: “${solution.english}”`,
): BuildExercise {
  return {
    kind: 'build',
    prompt,
    tiles: tiles(answer),
    extra_tiles: extra ? tiles(extra) : [],
    hint,
    solution,
  };
}

/** Hear it, then pick the English. */
export function listen(phrase: KeyPhrase, wrong: string[], hint: string, prompt = 'What did you hear?'): ListenExercise {
  return { kind: 'listen', prompt, audio: phrase.hanzi, options: [en(phrase.english), ...wrong.map(en)], answer: 0, hint, solution: phrase };
}

/** Hear it, then pick the Chinese ("hanzi pinyin"). For tones and sounds. */
export function listenFor(phrase: KeyPhrase, wrong: string[], hint: string, prompt = 'Which one did you hear?'): ListenExercise {
  return {
    kind: 'listen',
    prompt,
    audio: phrase.hanzi,
    options: [{ hanzi: phrase.hanzi, pinyin: phrase.pinyin, english: '' }, ...wrong.map(zh)],
    answer: 0,
    hint,
    solution: phrase,
  };
}

export function match(pairs: KeyPhrase[], hint: string, prompt = 'Match the pairs'): MatchExercise {
  return { kind: 'match', prompt, pairs, hint };
}
