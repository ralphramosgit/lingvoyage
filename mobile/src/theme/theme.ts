import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  sky500: '#0EA5E9', // brand, gradients, highlights
  sky600: '#0284C7', // primary buttons (white text, bold, 16+)
  sky700: '#0369A1', // links, pressed states
  sky100: '#E0F2FE', // learner bubble, selected backgrounds
  sky50: '#F0F9FF',
  sun400: '#FACC15', // mic button, accents
  sun300: '#FDE047',
  sun100: '#FEF9C3', // feedback card background
  ink: '#0B1F33', // primary text, icon on yellow
  inkMuted: '#4B5D70', // secondary text, pinyin
  line: '#D9E6F2', // borders, dividers
  surface: '#FFFFFF',
  bg: '#F5FAFF',
  success: '#16A34A',
  danger: '#DC2626',
} as const;

/** Extra tints derived from the palette, for icon tiles and status surfaces. */
export const tints = {
  sky: { bg: colors.sky100, fg: colors.sky700, gradient: [colors.sky100, colors.bg] },
  sun: { bg: colors.sun100, fg: '#A16207', gradient: [colors.sun100, colors.bg] },
  mint: { bg: '#DCFCE7', fg: '#15803D', gradient: ['#DCFCE7', colors.bg] },
} as const satisfies Record<string, { bg: string; fg: string; gradient: readonly [string, string] }>;

export type TintName = keyof typeof tints;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  input: 12,
  card: 16,
  sheet: 24,
  full: 999,
} as const;

export const layout = {
  maxContentWidth: 640,
  minTouchTarget: 44,
  screenPadding: spacing.xl,
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
  title: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  subheading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  // Hanzi uses the system font (PingFang on iOS); sized up with generous line height.
  hanziLarge: { fontSize: 24, lineHeight: 34 },
  hanzi: { fontSize: 20, lineHeight: 29 },
  hanziSmall: { fontSize: 17, lineHeight: 24 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const shadows = {
  card: {
    shadowColor: '#0B1F33',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0B1F33',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;

export const motion = {
  fast: 150,
  base: 250,
  slow: 350,
  stagger: 60,
} as const;
