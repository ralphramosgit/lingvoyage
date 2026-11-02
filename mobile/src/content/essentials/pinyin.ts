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
  tonePairs: [
    {
      first: 1,
      words: [
        { hanzi: '飞机', pinyin: 'fēijī', english: 'airplane' },
        { hanzi: '中国', pinyin: 'Zhōngguó', english: 'China' },
        { hanzi: '机场', pinyin: 'jīchǎng', english: 'airport' },
        { hanzi: '车站', pinyin: 'chēzhàn', english: 'station' },
        { hanzi: '东西', pinyin: 'dōngxi', english: 'things, stuff' },
      ],
    },
    {
      first: 2,
      words: [
        { hanzi: '昨天', pinyin: 'zuótiān', english: 'yesterday' },
        { hanzi: '银行', pinyin: 'yínháng', english: 'bank' },
        { hanzi: '苹果', pinyin: 'píngguǒ', english: 'apple' },
        { hanzi: '学校', pinyin: 'xuéxiào', english: 'school' },
        { hanzi: '朋友', pinyin: 'péngyou', english: 'friend' },
      ],
    },
    {
      first: 3,
      words: [
        { hanzi: '北京', pinyin: 'Běijīng', english: 'Beijing' },
        { hanzi: '旅游', pinyin: 'lǚyóu', english: 'to travel' },
        { hanzi: '你好', pinyin: 'nǐ hǎo', english: 'hello (said ní hǎo)' },
        { hanzi: '好看', pinyin: 'hǎokàn', english: 'good-looking' },
        { hanzi: '姐姐', pinyin: 'jiějie', english: 'older sister' },
      ],
    },
    {
      first: 4,
      words: [
        { hanzi: '面包', pinyin: 'miànbāo', english: 'bread' },
        { hanzi: '问题', pinyin: 'wèntí', english: 'question, problem' },
        { hanzi: '饭馆', pinyin: 'fànguǎn', english: 'restaurant' },
        { hanzi: '再见', pinyin: 'zàijiàn', english: 'goodbye' },
        { hanzi: '谢谢', pinyin: 'xièxie', english: 'thank you' },
      ],
    },
  ],
  toneChanges: [
    {
      label: '3+3',
      title: 'Two 3rd tones in a row',
      rule: 'The first one rises like a 2nd tone. Pinyin still writes both as 3rd tones.',
      example: { hanzi: '你好', pinyin: 'nǐ hǎo', english: 'hello', note: 'Said ní hǎo.' },
    },
    {
      label: '3+',
      title: 'A 3rd tone before any other tone',
      rule: 'It stays low and doesn’t come back up. The full dip is for a 3rd tone on its own or at the end.',
      example: { hanzi: '好吃', pinyin: 'hǎochī', english: 'delicious' },
    },
    {
      label: '不',
      title: '不 (bù) before a 4th tone',
      rule: 'It becomes bú. This app writes it the way it’s said.',
      example: { hanzi: '不要', pinyin: 'bú yào', english: 'don’t want' },
    },
    {
      label: '一',
      title: '一 (yī) next to other words',
      rule: 'It becomes yí before a 4th tone and yì before the others. Counting, or at the end, it stays yī.',
      example: { hanzi: '一个', pinyin: 'yí gè', english: 'one (of something)', note: 'And 一点 yìdiǎn, a little.' },
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
