import type { CheatSheet } from './types';

export const CHEAT_SHEETS: CheatSheet[] = [
  {
    id: 'survival',
    title: 'Survival phrases',
    description: 'The handful of phrases to know before you land.',
    groups: [
      {
        heading: 'Being polite',
        entries: [
          { hanzi: '你好', pinyin: 'nǐ hǎo', english: 'Hello' },
          { hanzi: '谢谢', pinyin: 'xièxie', english: 'Thank you' },
          { hanzi: '不客气', pinyin: 'bú kèqi', english: 'You’re welcome' },
          { hanzi: '对不起', pinyin: 'duìbuqǐ', english: 'Sorry' },
        ],
      },
      {
        heading: 'Shopping',
        entries: [{ hanzi: '多少钱？', pinyin: 'duōshao qián?', english: 'How much is it?' }],
      },
      {
        heading: 'When you’re stuck',
        entries: [
          { hanzi: '我听不懂', pinyin: 'wǒ tīng bu dǒng', english: 'I don’t understand' },
          { hanzi: '请再说一遍', pinyin: 'qǐng zài shuō yí biàn', english: 'Please say it again' },
        ],
      },
    ],
  },
];

export function findCheatSheet(id: string | undefined): CheatSheet | undefined {
  return CHEAT_SHEETS.find((sheet) => sheet.id === id);
}
