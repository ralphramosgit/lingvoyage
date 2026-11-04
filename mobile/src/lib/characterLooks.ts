import { sceneKind } from '@/lib/scenarioVisuals';
import type { Scenario } from '@/types/api';

export type HairStyle = 'short' | 'side' | 'bob' | 'long' | 'ponytail' | 'bun';
export type Outfit =
  | 'blazer'
  | 'suit'
  | 'uniform'
  | 'apron'
  | 'chef'
  | 'vest'
  | 'polo'
  | 'guide'
  | 'hoodie'
  /** A collared shirt and tie, like a city taxi driver's. */
  | 'shirt'
  /** A T-shirt with a panda on it, like the ones sold at a market stall. */
  | 'tee';
export type Hat = 'none' | 'cap' | 'chef' | 'bandana' | 'bucket';

export type ChibiLook = {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  outfit: Outfit;
  /** The outfit's main color. */
  color: string;
  /** Tie, scarf, apron or trim. */
  accent: string;
  hat: Hat;
  glasses: boolean;
  elder: boolean;
};

const SKINS = ['#FFE3CC', '#FAD6B8', '#F3C6A0', '#E9B48A'];
const HAIR_COLORS = ['#1F1B24', '#2B2027', '#3B2A25', '#4A3326'];
const GRAY_HAIR = '#8A8F98';

// The built-in scenes get hand-picked looks.
const BUILT_IN: Record<string, ChibiLook> = {
  taxi: {
    skin: SKINS[3], hair: 'side', hairColor: GRAY_HAIR, outfit: 'shirt', color: '#DCEBFA', accent: '#1E3A8A',
    hat: 'none', glasses: false, elder: true,
  },
  shopping: {
    skin: SKINS[0], hair: 'bob', hairColor: HAIR_COLORS[2], outfit: 'tee', color: '#E5484D', accent: '#FFFFFF',
    hat: 'none', glasses: false, elder: false,
  },
  airport: {
    skin: SKINS[0], hair: 'ponytail', hairColor: HAIR_COLORS[0], outfit: 'blazer', color: '#1E3A5F', accent: '#0EA5E9',
    hat: 'none', glasses: false, elder: false,
  },
  restaurant: {
    skin: SKINS[2], hair: 'bun', hairColor: '#4B4650', outfit: 'apron', color: '#FFF4E0', accent: '#E5484D',
    hat: 'none', glasses: false, elder: true,
  },
  train: {
    skin: SKINS[1], hair: 'short', hairColor: HAIR_COLORS[1], outfit: 'uniform', color: '#1E3A5F', accent: '#E5484D',
    hat: 'cap', glasses: false, elder: false,
  },
  hotel: {
    skin: SKINS[1], hair: 'side', hairColor: '#4B4650', outfit: 'suit', color: '#334155', accent: '#0284C7',
    hat: 'none', glasses: true, elder: true,
  },
};

function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return value;
}

const FEMININE = /auntie|aunt\b|granny|grandma|grandmother|madam|waitress|hostess|stewardess|\bms\.?\b|\bmrs\.?\b|\bmiss\b|lady|sister|阿姨|大妈|奶奶|婆婆|姐|女士|小姐|妹/i;
const MASCULINE = /uncle|grandpa|grandfather|\bmr\.?\b|brother|大爷|大叔|叔|爷爷|伯|先生|哥|师傅/i;
const ELDER = /auntie|aunt\b|granny|grandma|grandpa|grandfather|uncle|阿姨|大妈|奶奶|婆婆|大爷|大叔|爷爷|伯|老/i;

/**
 * How a scene's character is drawn. Built-in scenes have fixed looks; a city pack's characters get one from
 * their gender and age (the same ones that pick their voice on the server), their role and setting (outfit, hat)
 * and a hash of the name for the rest, so the same character always looks the same.
 */
export function lookFor(scenario: Pick<Scenario, 'id' | 'icon' | 'character'>): ChibiLook {
  const fixed = BUILT_IN[scenario.id];
  if (fixed) return fixed;

  const { character } = scenario;
  const names = `${character.name_english} ${character.name_hanzi} ${character.role}`;
  const role = character.role.toLowerCase();
  const seed = hash(character.name_hanzi + character.name_english);
  const pick = <T,>(items: readonly T[], salt: number) => items[(seed >>> salt) % items.length];

  // Servers before issue #56 don't send a gender and age: guess them from the name and role.
  const feminine = character.gender
    ? character.gender === 'female'
    : FEMININE.test(names) || (!MASCULINE.test(names) && seed % 2 === 0);
  const elder = character.age
    ? character.age === 'older'
    : ELDER.test(`${character.name_english} ${character.name_hanzi}`) || /owner|boss|老板/.test(role);
  const hair: HairStyle = elder
    ? feminine
      ? 'bun'
      : 'side'
    : feminine
      ? pick(['bob', 'long', 'ponytail'] as const, 3)
      : pick(['short', 'side'] as const, 3);

  let outfit: Outfit = 'hoodie';
  let hat: Hat = 'none';
  let color = pick(['#0284C7', '#14B8A6', '#6366F1', '#F97316'], 5);
  let accent = '#FACC15';

  const kind = sceneKind(scenario.icon);
  if (/chef|cook|厨/.test(role)) {
    outfit = 'chef';
    hat = 'chef';
    color = '#FFFFFF';
    accent = '#E5484D';
  } else if (/waiter|waitress|server|服务/.test(role)) {
    outfit = 'vest';
    color = '#FFFFFF';
    accent = '#1F2937';
  } else if (/driver|司机/.test(role) || kind === 'taxi') {
    outfit = 'polo';
    hat = 'cap';
    color = '#16A34A';
    accent = '#FACC15';
  } else if (/guide|导游/.test(role) || kind === 'landmark') {
    outfit = 'guide';
    hat = 'bucket';
    color = '#E5484D';
    accent = '#FACC15';
  } else if (kind === 'shop' || /shop assistant|sales|店员|售货/.test(role)) {
    outfit = 'tee';
    accent = '#FFFFFF';
  } else if (/vendor|seller|shopkeeper|owner|stall|老板/.test(role) || kind === 'market' || kind === 'restaurant') {
    outfit = 'apron';
    hat = elder || seed % 3 !== 0 ? 'none' : 'bandana';
    color = '#FFF4E0';
    accent = kind === 'market' ? '#16A34A' : '#E5484D';
  } else if (/manager|receptionist|front desk|concierge|clerk/.test(role) || kind === 'hotel') {
    outfit = 'suit';
    color = '#334155';
    accent = '#0284C7';
  } else if (kind === 'train' || /conductor|attendant|railway|station/.test(role)) {
    outfit = 'uniform';
    hat = 'cap';
    color = '#1E3A5F';
    accent = '#E5484D';
  } else if (kind === 'airport' || /staff|officer|agent|security/.test(role)) {
    outfit = 'blazer';
    color = '#1E3A5F';
    accent = '#0EA5E9';
  }

  return {
    skin: pick(SKINS, 7),
    hair,
    hairColor: elder ? GRAY_HAIR : pick(HAIR_COLORS, 9),
    outfit,
    color,
    accent,
    hat,
    glasses: elder ? seed % 2 === 0 : seed % 4 === 1,
    elder,
  };
}
