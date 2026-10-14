import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme/theme';

import { Text } from './Text';

type Tone = 'sky' | 'sun' | 'success' | 'neutral' | 'onDark';

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  sky: { bg: colors.sky100, fg: colors.sky700, border: colors.sky100 },
  sun: { bg: colors.sun100, fg: '#854D0E', border: '#FDF0A6' },
  success: { bg: '#DCFCE7', fg: '#166534', border: '#DCFCE7' },
  neutral: { bg: colors.surface, fg: colors.inkMuted, border: colors.line },
  onDark: { bg: 'rgba(255,255,255,0.18)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.28)' },
};

export type PillProps = {
  label: string;
  icon?: LucideIcon;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, icon: Icon, tone = 'sky', style }: PillProps) {
  const palette = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      {Icon ? <Icon size={14} color={palette.fg} strokeWidth={2.4} /> : null}
      <Text variant="tiny" color={palette.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.full,
    borderWidth: 1,
  },
});
