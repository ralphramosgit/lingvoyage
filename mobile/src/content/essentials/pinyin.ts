import type { PinyinGuide } from './types';

export const PINYIN: PinyinGuide = {
  intro:
    "Chinese has no alphabet. Pinyin writes its sounds with Latin letters, and the mark over a vowel shows the tone. The same syllable in a different tone is a different word, so the tones matter as much as the letters.",
  tones: [
    {
      number: 1,
      name: 'First tone',
      howItSounds: 'High and flat, like holding a note when you sing.',
      example: { hanzi: '妈', pinyin: 'mā', english: 'mom' },
    },
    {
      number: 2,
      name: 'Second tone',
      howItSounds: 'Rises, like asking “Huh?”',
      example: { hanzi: '麻', pinyin: 'má', english: 'numbing (as in Sichuan pepper)' },
    },
    {
      number: 3,
      name: 'Third tone',
      howItSounds: 'Low. It dips down and comes back up when said on its own.',
      example: { hanzi: '马', pinyin: 'mǎ', english: 'horse' },
    },
    {
      number: 4,
      name: 'Fourth tone',
      howItSounds: 'Falls sharply, like a firm “No!”',
      example: { hanzi: '骂', pinyin: 'mà', english: 'to scold' },
    },
    {
      number: 5,
      name: 'Neutral tone',
      howItSounds: 'Light and short, with no mark. Small words at the end of a sentence often use it.',
      example: { hanzi: '吗', pinyin: 'ma', english: 'question word: makes a yes/no question' },
    },
  ],
  initials: [
    {
      sound: 'zh',
      howItSounds: 'Like the “j” in “jam”, with the tip of your tongue curled back.',
      example: { hanzi: '中', pinyin: 'zhōng', english: 'middle (as in 中国 China)' },
    },
    {
      sound: 'x',
      howItSounds: 'Like “sh”, but smile and keep your tongue flat behind your bottom teeth.',
      example: { hanzi: '谢', pinyin: 'xiè', english: 'to thank (as in 谢谢)' },
    },
    {
      sound: 'q',
      howItSounds: 'Like the “ch” in “cheese”, with your tongue flat. Never like the English “q”.',
      example: { hanzi: '去', pinyin: 'qù', english: 'to go' },
    },
    {
      sound: 'c',
      howItSounds: 'Like the “ts” at the end of “cats”, with a puff of air.',
      example: { hanzi: '菜', pinyin: 'cài', english: 'dish, vegetable' },
    },
  ],
  finals: [
    {
      sound: 'ü',
      howItSounds: 'Say “ee”, then round your lips as if for “oo” without moving your tongue.',
      example: {
        hanzi: '女',
        pinyin: 'nǚ',
        english: 'female',
        note: 'After j, q, x and y the dots are dropped: 去 qù has this sound too.',
      },
    },
  ],
};
