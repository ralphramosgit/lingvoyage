import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

/** App text with Plus Jakarta Sans presets. Hanzi variants fall back to the system font. */
export function Text({ variant = 'body', color = colors.ink, align, style, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[typography[variant], { color }, align ? { textAlign: align } : null, style]}
    />
  );
}
