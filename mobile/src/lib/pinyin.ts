const MARKS: Record<string, string> = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };

/**
 * Pinyin with its tone mark: ("ma", 3) is "mǎ". The mark goes on a or e if there is one, on the o
 * of "ou", and otherwise on the last vowel ("liù", "guì"). Tone 5 (neutral) has no mark.
 */
export function withToneMark(syllable: string, tone: number): string {
  if (tone < 1 || tone > 4) return syllable;
  let index = syllable.indexOf('a');
  if (index < 0) index = syllable.indexOf('e');
  if (index < 0) index = syllable.indexOf('ou');
  if (index < 0) {
    for (let i = syllable.length - 1; i >= 0 && index < 0; i -= 1) {
      if (MARKS[syllable[i]]) index = i;
    }
  }
  if (index < 0) return syllable;
  return syllable.slice(0, index) + MARKS[syllable[index]][tone - 1] + syllable.slice(index + 1);
}
