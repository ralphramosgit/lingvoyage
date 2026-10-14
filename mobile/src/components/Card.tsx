import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing } from '@/theme/theme';

import { PressableScale } from './PressableScale';

export type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
}>;

export function Card({ children, style, onPress, disabled, accessibilityLabel, accessibilityHint, padded = true }: CardProps) {
  const cardStyle = [styles.card, padded ? styles.padded : null, style];
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={cardStyle}>
        {children}
      </PressableScale>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  padded: { padding: spacing.lg },
});
