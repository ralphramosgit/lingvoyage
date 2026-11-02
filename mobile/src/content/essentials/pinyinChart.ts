import { SYLLABLE_TONES } from './pinyinSyllables';
import type { ChartInitial, ToneSlots } from './types';

/** The pinyin chart's columns, in the usual order. The last one is for syllables with no initial. */
export const CHART_INITIALS: ChartInitial[] = [
  { id: 'b', label: 'b', hint: 'Like the p in “spin”: no puff of air.' },
  { id: 'p', label: 'p', hint: 'Like the p in “pie”, with a strong puff of air.' },
  { id: 'm', label: 'm', hint: 'Like the English m.' },
  { id: 'f', label: 'f', hint: 'Like the English f.' },
  { id: 'd', label: 'd', hint: 'Like the t in “stop”: no puff of air.' },
  { id: 't', label: 't', hint: 'Like the t in “top”, with a strong puff of air.' },
  { id: 'n', label: 'n', hint: 'Like the English n.' },
  { id: 'l', label: 'l', hint: 'Like the English l.' },
  { id: 'g', label: 'g', hint: 'Like the k in “skin”: no puff of air.' },
  { id: 'k', label: 'k', hint: 'Like the k in “kite”, with a strong puff of air.' },
  { id: 'h', label: 'h', hint: 'Made further back than the English h, with a light rasp, a bit like the ch in “loch”.' },
  {
    id: 'j',
    label: 'j',
    hint: 'Like the j in “jeep”, with your tongue flat behind your bottom teeth. Only comes before i and ü, and the dots are dropped: ju is jü.',
  },
  {
    id: 'q',
    label: 'q',
    hint: 'Like the ch in “cheap”, with your tongue flat and a puff of air. Only comes before i and ü: qu is qü.',
  },
  {
    id: 'x',
    label: 'x',
    hint: 'Between s and sh: smile, with your tongue flat behind your bottom teeth. Only comes before i and ü: xu is xü.',
  },
  {
    id: 'zh',
    label: 'zh',
    hint: 'Like the j in “jam”, with the tip of your tongue curled back. In zhi, the i isn’t “ee”: just hold the zh.',
  },
  {
    id: 'ch',
    label: 'ch',
    hint: 'Like the ch in “church”, tongue curled back, with a puff of air. In chi, just hold the ch.',
  },
  { id: 'sh', label: 'sh', hint: 'Like the sh in “shoe”, with your tongue curled back. In shi, just hold the sh.' },
  { id: 'r', label: 'r', hint: 'Like the s in “pleasure”, with your tongue curled back. In ri, just hold the r.' },
  { id: 'z', label: 'z', hint: 'Like the ds in “kids”. In zi, the i isn’t “ee”: just hold the buzz.' },
  { id: 'c', label: 'c', hint: 'Like the ts in “cats”, with a puff of air. In ci, just hold the ts.' },
  { id: 's', label: 's', hint: 'Like the English s. In si, just hold the hiss.' },
  {
    id: '',
    label: 'No initial',
    hint: 'Syllables that start with a vowel. When they start with i, u or ü, pinyin writes y or w instead: i is yi, u is wu, ü is yu.',
  },
];

// The chart's rows, in the usual order. "-i" is the buzzing i after zh, ch, sh, r, z, c and s; "i" is "ee".
const FINALS = [
  'a', 'o', 'e', '-i', 'er', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong',
  'i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong',
  'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang', 'ueng',
  'ü', 'üe', 'üan', 'ün',
];

const BUZZ_INITIALS = new Set(['zh', 'ch', 'sh', 'r', 'z', 'c', 's']);
const J_Q_X = new Set(['j', 'q', 'x']);

/** With no initial, i, u and ü are written with y and w. */
const Y_W: Record<string, string> = {
  i: 'yi', ia: 'ya', ie: 'ye', iao: 'yao', iou: 'you', ian: 'yan', in: 'yin', iang: 'yang', ing: 'ying', iong: 'yong',
  u: 'wu', ua: 'wa', uo: 'wo', uai: 'wai', uei: 'wei', uan: 'wan', uen: 'wen', uang: 'wang', ueng: 'weng',
  ü: 'yu', üe: 'yue', üan: 'yuan', ün: 'yun',
};

/** How pinyin writes an initial + final, or null if they can't go together. */
function spell(initial: string, final: string): string | null {
  if (final === '-i') return BUZZ_INITIALS.has(initial) ? `${initial}i` : null;
  if (final === 'i' && BUZZ_INITIALS.has(initial)) return null;
  if (!initial) return Y_W[final] ?? final;
  // j, q and x only take i and ü finals, and drop the dots: ju, quan, xun.
  if (J_Q_X.has(initial)) {
    if (final.startsWith('u')) return null;
    if (final.startsWith('ü')) return `${initial}u${final.slice(1)}`;
  }
  const short = final === 'iou' ? 'iu' : final === 'uei' ? 'ui' : final === 'uen' ? 'un' : final;
  return initial + short;
}

export type ChartSyllable = { syllable: string; tones: ToneSlots };

/** Each initial's syllables, in chart order. Only syllables with an everyday character are included. */
export const CHART_ROWS: Record<string, ChartSyllable[]> = Object.fromEntries(
  CHART_INITIALS.map((initial) => [
    initial.id,
    FINALS.flatMap((final) => {
      const syllable = spell(initial.id, final);
      const tones = syllable ? SYLLABLE_TONES[syllable] : undefined;
      return syllable && tones ? [{ syllable, tones }] : [];
    }),
  ]),
);

// Every syllable in the data has to land in exactly one cell, with real characters. Checked in
// development so a typo throws straight away.
if (__DEV__) {
  const placed = Object.values(CHART_ROWS).flat();
  const seen = new Set<string>();
  for (const { syllable, tones } of placed) {
    if (seen.has(syllable)) throw new Error(`Pinyin chart: "${syllable}" is in two cells`);
    seen.add(syllable);
    if (tones.every((slot) => !slot)) throw new Error(`Pinyin chart: "${syllable}" has no tones`);
    for (const slot of tones) {
      if (slot && ([...slot[0]].length !== 1 || !slot[1].trim())) {
        throw new Error(`Pinyin chart: "${syllable}" needs one character and a meaning per tone`);
      }
    }
  }
  const missing = Object.keys(SYLLABLE_TONES).filter((syllable) => !seen.has(syllable));
  if (missing.length > 0) throw new Error(`Pinyin chart: no cell for ${missing.join(', ')}`);
}
