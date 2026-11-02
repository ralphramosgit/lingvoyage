import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors, radii, spacing } from '@/theme/theme';

export type SceneView = 'city' | 'default';

/**
 * Encounters tab: practise with your city's researched scenes or the default ones. Shown only when the
 * city pack has scenes (or a first build is writing them).
 */
export function SceneToggle({ city, value, onChange }: { city: string; value: SceneView; onChange: (next: SceneView) => void }) {
  const options: { id: SceneView; label: string; hint: string }[] = [
    { id: 'city', label: `Made for ${city}`, hint: `Scenes at real places in ${city}, from what the agent researched` },
    { id: 'default', label: 'Default scenes', hint: 'The standard scenes, the same everywhere' },
  ];
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            accessibilityState={{ selected: active }}
            style={[styles.tab, active ? styles.tabActive : null]}>
            {/* Measured on an iPhone SE: "Made for Guangzhou", the longest, needs 85%. */}
            <Text
              variant="label"
              color={active ? colors.surface : colors.inkMuted}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
  },
  tabActive: { backgroundColor: colors.sky600 },
});
