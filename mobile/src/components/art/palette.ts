import { colors } from '@/theme/theme';

/** Colors for the illustrations (the seagull, the characters, the scenes): the brand's sky and sun, plus a few naturals. */
export const art = {
  outline: '#28405A',
  white: '#FFFFFF',
  eye: '#1B2A3A',
  blush: '#F9A8B4',
  shine: 'rgba(255,255,255,0.85)',

  skyTop: '#BAE6FD',
  skyLow: '#E0F2FE',
  cloud: '#FFFFFF',
  sun: colors.sun400,
  sail: '#FEF08A',
  sea: '#38BDF8',
  seaDeep: colors.sky500,
  seaFoam: '#E0F2FE',
  sand: '#F6DDA8',

  gullWing: '#C9D7E5',
  gullTip: '#43566C',
  gullBelly: '#EEF4FA',
  beak: colors.sun400,
  beakShade: '#EAB308',
  feet: '#F5A524',
  scarf: colors.sky600,
  scarfLight: colors.sky500,

  wood: '#C98B55',
  woodDark: '#A86B3C',
  woodLight: '#E3B07E',
  lantern: '#E5484D',
  lanternDark: '#B92F35',
  gold: '#F2B33D',
  leaf: '#4CAF7A',
  leafDark: '#2F8A5B',
  grass: '#BFE3B4',
  stone: '#D7E0E8',
  stoneDark: '#AAB8C6',
  board: '#1E3350',
} as const;
