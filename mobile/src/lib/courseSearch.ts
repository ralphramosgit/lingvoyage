import type { Unit, UnitLesson } from '@/content/lessons/types';
import type { KeyPhrase } from '@/types/api';

const TONE_MARKS: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'u', ǘ: 'u', ǚ: 'u', ǜ: 'u', ü: 'u',
};

/** Lowercase, without tone marks, so "duoshao" finds "duōshao". */
function fold(text: string) {
  return text.toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, (mark) => TONE_MARKS[mark]).replace(/\s+/g, ' ');
}

const HANZI = /[㐀-鿿]/;

/** Long enough to search: two letters, or one character. */
export function isSearchable(query: string) {
  const text = query.trim();
  return text.length >= 2 || HANZI.test(text);
}

function matches(text: string, query: string) {
  return fold(text).includes(query);
}

/** Pinyin is spaced differently from lesson to lesson ("duōshao qián", "duō shao"), so spaces don't count. */
function matchesPhrase(phrase: KeyPhrase, query: string) {
  const spaceless = query.replace(/ /g, '');
  return (
    phrase.hanzi.includes(query) ||
    fold(phrase.pinyin).replace(/ /g, '').includes(spaceless) ||
    matches(phrase.english, query)
  );
}

export type UnitHit = { unit: Unit; number: number };

export type LessonHit = {
  unit: Unit;
  lesson: UnitLesson;
  /** The lesson's number in its unit. */
  number: number;
  /** The word or sentence that matched, when it wasn't the lesson's title or summary. */
  phrase?: KeyPhrase;
};

export type SearchResults = { units: UnitHit[]; lessons: LessonHit[] };

/** Units and lessons that mention the query, in course order. Units that are coming soon are left out. */
export function searchCourse(units: Unit[], query: string): SearchResults {
  const folded = fold(query.trim());
  const unitHits: UnitHit[] = [];
  const lessonHits: LessonHit[] = [];

  units.forEach((unit, unitIndex) => {
    if (unit.lessons.length === 0) return;
    if (matches(unit.title, folded) || matches(unit.summary, folded) || unit.canDo.some((line) => matches(line, folded))) {
      unitHits.push({ unit, number: unitIndex + 1 });
    }
    unit.lessons.forEach((lesson, index) => {
      const hit = { unit, lesson, number: index + 1 };
      if (matches(lesson.title, folded) || matches(lesson.summary, folded)) {
        lessonHits.push(hit);
        return;
      }
      const phrases = [...lesson.words, ...(lesson.pattern ? [lesson.pattern] : []), ...lesson.examples];
      const phrase = phrases.find((item) => matchesPhrase(item, folded));
      if (phrase) lessonHits.push({ ...hit, phrase });
    });
  });

  return { units: unitHits, lessons: lessonHits };
}
