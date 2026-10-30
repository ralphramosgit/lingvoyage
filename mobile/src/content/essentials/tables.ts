import type { ReferenceTable } from './types';

export const TABLES: ReferenceTable[] = [
  {
    id: 'numbers',
    title: 'Numbers 0–10',
    description: 'For prices, rooms, times and phone numbers.',
    rows: [
      { hanzi: '零', pinyin: 'líng', english: '0' },
      { hanzi: '一', pinyin: 'yī', english: '1' },
      { hanzi: '二', pinyin: 'èr', english: '2' },
      { hanzi: '三', pinyin: 'sān', english: '3' },
      { hanzi: '四', pinyin: 'sì', english: '4' },
      { hanzi: '五', pinyin: 'wǔ', english: '5' },
      { hanzi: '六', pinyin: 'liù', english: '6' },
      { hanzi: '七', pinyin: 'qī', english: '7' },
      { hanzi: '八', pinyin: 'bā', english: '8' },
      { hanzi: '九', pinyin: 'jiǔ', english: '9' },
      { hanzi: '十', pinyin: 'shí', english: '10' },
    ],
  },
  {
    id: 'pronouns',
    title: 'Pronouns',
    description: 'Add 们 (men) to make them plural.',
    rows: [
      { hanzi: '我', pinyin: 'wǒ', english: 'I, me' },
      { hanzi: '你', pinyin: 'nǐ', english: 'you' },
      { hanzi: '他', pinyin: 'tā', english: 'he, him' },
      { hanzi: '她', pinyin: 'tā', english: 'she, her' },
      { hanzi: '我们', pinyin: 'wǒmen', english: 'we, us' },
      { hanzi: '你们', pinyin: 'nǐmen', english: 'you (more than one)' },
      { hanzi: '他们', pinyin: 'tāmen', english: 'they, them' },
    ],
  },
];

export function findTable(id: string | undefined): ReferenceTable | undefined {
  return TABLES.find((table) => table.id === id);
}
