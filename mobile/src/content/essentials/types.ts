/**
 * Essentials: the study reference. Beginner Mandarin only: simplified characters, pinyin with
 * tone marks (tone changes for 一 and 不 written as said), and plain English.
 */

/** One Chinese item. Every entry shows all three and gets a speaker button. */
export type Entry = {
  hanzi: string;
  pinyin: string;
  english: string;
  note?: string;
  /** What the speaker plays when it isn't `hanzi`, e.g. 是 for the pattern "A 是 B". Characters, never pinyin. */
  audio?: string;
};

/** 1 to 4 are the four tones; 5 is the neutral tone. */
export type Tone = { number: 1 | 2 | 3 | 4 | 5; name: string; howItSounds: string; example: Entry };

/** An initial or final that sounds different from English, with a character to hear it in. */
export type Sound = { sound: string; howItSounds: string; example: Entry };

export type PinyinGuide = { intro: string; tones: Tone[]; initials: Sound[]; finals: Sound[] };

export type VocabGroup = { id: string; title: string; description: string; words: Entry[] };

export type GrammarPoint = { id: string; title: string; pattern: Entry; explanation: string; examples: Entry[] };

export type ReferenceTable = { id: string; title: string; description: string; rows: Entry[] };

export type CheatSheet = {
  id: string;
  title: string;
  description: string;
  groups: { heading: string; entries: Entry[] }[];
};
