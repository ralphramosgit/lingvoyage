import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, layout, radii, spacing } from '@/theme/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'sun' | 'danger';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.sky600, fg: '#FFFFFF', border: colors.sky600 },
  secondary: { bg: colors.surface, fg: colors.sky700, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.sky700, border: 'transparent' },
  sun: { bg: colors.sun400, fg: colors.ink, border: colors.sun400 },
  danger: { bg: colors.surface, fg: colors.danger, border: '#F5C2C2' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  size = 'lg',
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;
  const iconNode = Icon ? <Icon size={20} color={palette.fg} strokeWidth={2.25} /> : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={[
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && !loading ? styles.disabled : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {iconPosition === 'left' ? iconNode : null}
          <Text style={[styles.label, { color: palette.fg }]} numberOfLines={1}>
            {label}
          </Text>
          {iconPosition === 'right' ? iconNode : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    minHeight: layout.minTouchTarget,
  },
  lg: { height: 56 },
  md: { height: 46 },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
});
