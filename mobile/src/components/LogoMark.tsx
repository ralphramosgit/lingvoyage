import { Compass } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, shadows } from '@/theme/theme';

/** Naviglot logo: a compass in a white rounded square with a small yellow dot accent. */
export function LogoMark({ size = 88 }: { size?: number }) {
  const dot = Math.round(size * 0.18);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Naviglot logo"
      style={[styles.square, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Compass size={size * 0.54} color={colors.sky600} strokeWidth={2} />
      <View
        style={[
          styles.dot,
          { width: dot, height: dot, borderRadius: dot / 2, top: size * 0.14, right: size * 0.14 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  dot: {
    position: 'absolute',
    backgroundColor: colors.sun400,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
