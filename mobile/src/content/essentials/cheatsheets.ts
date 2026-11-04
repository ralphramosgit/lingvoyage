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
  {
    id: 'quick-answers',
    title: 'Quick answers',
    description: 'Yes, no, maybe, and “I don’t speak Chinese”.',
    groups: [
      {
        heading: 'Yes',
        entries: [
          { hanzi: '对', pinyin: 'duì', english: 'Yes, that’s right' },
          { hanzi: '是', pinyin: 'shì', english: 'Yes, it is', note: 'To say yes, repeat the verb from the question.' },
          { hanzi: '要', pinyin: 'yào', english: 'Yes, I want it' },
          { hanzi: '有', pinyin: 'yǒu', english: 'Yes, there is / I have it' },
          { hanzi: '好的', pinyin: 'hǎo de', english: 'OK, sure' },
          { hanzi: '可以', pinyin: 'kěyǐ', english: 'Sure, you can' },
          { hanzi: '没问题', pinyin: 'méi wèntí', english: 'No problem' },
        ],
      },
      {
        heading: 'No',
        entries: [
          { hanzi: '不是', pinyin: 'bú shì', english: 'No, it isn’t' },
          { hanzi: '不对', pinyin: 'bú duì', english: 'No, that’s not right' },
          { hanzi: '不要，谢谢', pinyin: 'bú yào, xièxie', english: 'No, thank you' },
          { hanzi: '没有', pinyin: 'méiyǒu', english: 'No, there isn’t / I don’t have it', note: 'The “no” for 有 is 没有, never 不有.' },
          { hanzi: '不用了', pinyin: 'bú yòng le', english: 'No need, thanks' },
          { hanzi: '不会', pinyin: 'bú huì', english: 'No, I can’t' },
        ],
      },
      {
        heading: 'Not sure',
        entries: [
          { hanzi: '我不知道', pinyin: 'wǒ bù zhīdào', english: 'I don’t know' },
          { hanzi: '我不确定', pinyin: 'wǒ bú quèdìng', english: 'I’m not sure' },
          { hanzi: '可能吧', pinyin: 'kěnéng ba', english: 'Maybe' },
          { hanzi: '等一下', pinyin: 'děng yíxià', english: 'Just a moment' },
          { hanzi: '我想想', pinyin: 'wǒ xiǎngxiang', english: 'Let me think' },
        ],
      },
      {
        heading: 'About you',
        entries: [
          { hanzi: '我不会说中文', pinyin: 'wǒ bú huì shuō Zhōngwén', english: 'I don’t speak Chinese' },
          { hanzi: '我只会说一点中文', pinyin: 'wǒ zhǐ huì shuō yìdiǎn Zhōngwén', english: 'I only speak a little Chinese' },
          { hanzi: '我的母语是英语', pinyin: 'wǒ de mǔyǔ shì Yīngyǔ', english: 'My native language is English' },
          { hanzi: '我是外国人', pinyin: 'wǒ shì wàiguó rén', english: 'I’m a foreigner' },
          { hanzi: '我是游客', pinyin: 'wǒ shì yóukè', english: 'I’m a tourist' },
          { hanzi: '你会说英语吗？', pinyin: 'nǐ huì shuō Yīngyǔ ma?', english: 'Do you speak English?' },
        ],
      },
    ],
  },
];

export function findCheatSheet(id: string | undefined): CheatSheet | undefined {
  return CHEAT_SHEETS.find((sheet) => sheet.id === id);
}
