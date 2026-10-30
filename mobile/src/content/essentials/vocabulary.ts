import type { VocabGroup } from './types';

export const VOCAB_GROUPS: VocabGroup[] = [
  {
    id: 'nouns',
    title: 'Nouns',
    description: 'People, places and things.',
    words: [
      { hanzi: '水', pinyin: 'shuǐ', english: 'water' },
      { hanzi: '茶', pinyin: 'chá', english: 'tea' },
      { hanzi: '酒店', pinyin: 'jiǔdiàn', english: 'hotel' },
      { hanzi: '机场', pinyin: 'jīchǎng', english: 'airport' },
      { hanzi: '火车', pinyin: 'huǒchē', english: 'train' },
    ],
  },
  {
    id: 'verbs',
    title: 'Verbs',
    description: 'Doing words. They never change form: no “-s”, “-ed” or “-ing”.',
    words: [
      { hanzi: '要', pinyin: 'yào', english: 'to want' },
      { hanzi: '去', pinyin: 'qù', english: 'to go' },
      { hanzi: '吃', pinyin: 'chī', english: 'to eat' },
      { hanzi: '喝', pinyin: 'hē', english: 'to drink' },
      { hanzi: '买', pinyin: 'mǎi', english: 'to buy' },
    ],
  },
  {
    id: 'adjectives',
    title: 'Adjectives',
    description: 'Describing words.',
    words: [
      { hanzi: '好', pinyin: 'hǎo', english: 'good' },
      { hanzi: '贵', pinyin: 'guì', english: 'expensive' },
      { hanzi: '大', pinyin: 'dà', english: 'big' },
      { hanzi: '小', pinyin: 'xiǎo', english: 'small' },
      { hanzi: '热', pinyin: 'rè', english: 'hot' },
    ],
  },
  {
    id: 'pronouns',
    title: 'Pronouns',
    description: 'I, you, he, she, we. The same word works for “I” and “me”.',
    words: [
      { hanzi: '我', pinyin: 'wǒ', english: 'I, me' },
      { hanzi: '你', pinyin: 'nǐ', english: 'you' },
      { hanzi: '您', pinyin: 'nín', english: 'you (polite)' },
      { hanzi: '他', pinyin: 'tā', english: 'he, him' },
      { hanzi: '她', pinyin: 'tā', english: 'she, her' },
    ],
  },
  {
    id: 'questions',
    title: 'Question words',
    description: 'They sit where the answer would go, not at the start of the sentence.',
    words: [
      { hanzi: '什么', pinyin: 'shénme', english: 'what' },
      { hanzi: '哪里', pinyin: 'nǎlǐ', english: 'where' },
      { hanzi: '谁', pinyin: 'shéi', english: 'who' },
      { hanzi: '多少', pinyin: 'duōshao', english: 'how many, how much' },
      { hanzi: '几', pinyin: 'jǐ', english: 'how many', note: 'For small numbers, usually under ten.' },
    ],
  },
  {
    id: 'measure-words',
    title: 'Measure words',
    description: 'Go between a number and a noun, like “a cup of” in English.',
    words: [
      { hanzi: '个', pinyin: 'gè', english: 'general measure word', note: 'For people and most things. Use it when unsure.' },
      { hanzi: '杯', pinyin: 'bēi', english: 'cup, glass (of)' },
      { hanzi: '张', pinyin: 'zhāng', english: 'for flat things', note: 'Tickets, tables, photos.' },
      { hanzi: '本', pinyin: 'běn', english: 'for books' },
      { hanzi: '块', pinyin: 'kuài', english: 'yuan (money), piece', note: 'Everyday word for the Chinese yuan.' },
    ],
  },
];

export function findVocabGroup(id: string | undefined): VocabGroup | undefined {
  return VOCAB_GROUPS.find((group) => group.id === id);
}
