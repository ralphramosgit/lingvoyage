import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, tints, type TintName } from '@/theme/theme';

export type CharacterAvatarProps = {
  /** One Chinese character, usually the surname (e.g. 王). */
  char: string;
  size?: number;
  tint?: TintName;
  /** Spoken by screen readers, e.g. "Auntie Wang". Omit to hide the avatar from them. */
  accessibilityLabel?: string;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CharacterAvatar({ char, size = 48, tint = 'sky', accessibilityLabel, ring = false, style }: CharacterAvatarProps) {
  const palette = tints[tint];
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bg,
          borderWidth: ring ? 3 : 0,
        },
        style,
      ]}>
      {/* System font so the hanzi renders with PingFang. */}
      <Text style={[styles.char, { color: palette.fg, fontSize: Math.round(size * 0.46) }]} allowFontScaling={false}>
        {char}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.surface,
  },
  char: { fontWeight: '600', includeFontPadding: false },
});
