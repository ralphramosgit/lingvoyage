import type { LucideIcon } from 'lucide-react-native';
import { type ReactNode, type Ref, useState } from 'react';
import { StyleSheet, TextInput, type TextInputInstance, type TextInputProps, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme/theme';

import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  icon?: LucideIcon;
  error?: string | null;
  right?: ReactNode;
  ref?: Ref<TextInputInstance>;
};

export function TextField({ label, icon: Icon, error, right, ref, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.sky500 : colors.line;

  return (
    <View style={styles.wrapper}>
      <Text variant="label" color={colors.ink}>
        {label}
      </Text>
      <View style={[styles.field, { borderColor }, focused ? styles.fieldFocused : null]}>
        {Icon ? <Icon size={20} color={focused ? colors.sky600 : colors.inkMuted} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor="#8A9BAE"
          selectionColor={colors.sky600}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={label}
          {...inputProps}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={styles.input}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radii.input,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  fieldFocused: { backgroundColor: colors.sky50 },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
});
