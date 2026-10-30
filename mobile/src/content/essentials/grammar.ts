import type { GrammarPoint } from './types';

export const GRAMMAR_POINTS: GrammarPoint[] = [
  {
    id: 'shi',
    title: 'A 是 B: saying what something is',
    pattern: { hanzi: 'A 是 B', pinyin: 'A shì B', english: 'A is B', audio: '是' },
    explanation:
      '是 (shì) joins two nouns, like “am”, “is” or “are” in English. It never changes, whoever you talk about. Don’t use it before describing words: say 我很好 wǒ hěn hǎo (I’m good), not 我是好.',
    examples: [
      { hanzi: '我是美国人。', pinyin: 'Wǒ shì Měiguó rén.', english: 'I’m American.' },
      { hanzi: '她是老师。', pinyin: 'Tā shì lǎoshī.', english: 'She’s a teacher.' },
      { hanzi: '这是我的酒店。', pinyin: 'Zhè shì wǒ de jiǔdiàn.', english: 'This is my hotel.' },
    ],
  },
  {
    id: 'ma',
    title: 'Yes/no questions with 吗',
    pattern: { hanzi: '……吗？', pinyin: '… ma?', english: 'Statement + 吗 = question', audio: '吗' },
    explanation:
      'Put 吗 (ma) at the end of a statement to make a yes/no question. The word order stays the same. To answer “yes”, repeat the verb: 是 shì (yes, I am), 要 yào (yes, I want it).',
    examples: [
      { hanzi: '你好吗？', pinyin: 'Nǐ hǎo ma?', english: 'How are you?' },
      { hanzi: '你是美国人吗？', pinyin: 'Nǐ shì Měiguó rén ma?', english: 'Are you American?' },
      { hanzi: '有水吗？', pinyin: 'Yǒu shuǐ ma?', english: 'Is there any water?' },
    ],
  },
  {
    id: 'bu',
    title: 'Saying no with 不',
    pattern: { hanzi: '不 + verb', pinyin: 'bù + verb', english: 'not (do something)', audio: '不' },
    explanation:
      'Put 不 (bù) right before a verb or describing word to make it “not”. Before a fourth-tone word, 不 is said bú: 不要 bú yào (don’t want), 不是 bú shì (isn’t).',
    examples: [
      { hanzi: '我不要辣。', pinyin: 'Wǒ bú yào là.', english: 'No spice for me.' },
      { hanzi: '我不是老师。', pinyin: 'Wǒ bú shì lǎoshī.', english: 'I’m not a teacher.' },
      { hanzi: '这个不贵。', pinyin: 'Zhège bú guì.', english: 'This one isn’t expensive.' },
    ],
  },
];

export function findGrammarPoint(id: string | undefined): GrammarPoint | undefined {
  return GRAMMAR_POINTS.find((point) => point.id === id);
}
