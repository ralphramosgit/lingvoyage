import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radii } from '@/theme/theme';

import { PressableScale } from './PressableScale';

type Variant = 'plain' | 'tinted' | 'surface' | 'sun' | 'primary';

export type IconButtonProps = {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: Variant;
  /** Visual size of the button; the touch target is always at least 44x44. */
  size?: number;
  iconSize?: number;
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  active?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  plain: { bg: 'transparent', fg: colors.inkMuted, border: 'transparent' },
  tinted: { bg: colors.sky50, fg: colors.sky700, border: colors.sky100 },
  surface: { bg: colors.surface, fg: colors.ink, border: colors.line },
  sun: { bg: colors.sun400, fg: colors.ink, border: colors.sun400 },
  primary: { bg: colors.sky600, fg: '#FFFFFF', border: colors.sky600 },
};

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  onLongPress,
  variant = 'plain',
  size = layout.minTouchTarget,
  iconSize = 20,
  color,
  loading = false,
  disabled = false,
  active,
  accessibilityHint,
  style,
}: IconButtonProps) {
  const palette = VARIANTS[variant];
  const fg = color ?? palette.fg;
  const visual = Math.max(size, 28);
  const hitSlop = Math.max(0, (layout.minTouchTarget - visual) / 2);

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || loading}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading, selected: active }}
      scaleTo={0.92}
      style={[
        styles.base,
        { width: visual, height: visual, backgroundColor: palette.bg, borderColor: palette.border },
        disabled ? styles.disabled : null,
        style,
      ]}>
      {loading ? <ActivityIndicator size="small" color={fg} /> : <Icon size={iconSize} color={fg} strokeWidth={2.25} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});
