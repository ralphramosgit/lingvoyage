import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Chibi } from '@/components/art/Chibi';
import { lookFor } from '@/lib/characterLooks';
import { scenarioTint } from '@/lib/scenarioVisuals';
import { colors, tints } from '@/theme/theme';
import type { Scenario } from '@/types/api';

export type CharacterAvatarProps = {
  scenario: Pick<Scenario, 'id' | 'icon' | 'character'>;
  size?: number;
  /** Moves the mouth while the character's line plays. */
  talking?: boolean;
  /** Idle bob and blinks; off for small avatars in lists. */
  animated?: boolean;
  /** Spoken by screen readers, e.g. "Auntie Wang". Omit to hide the avatar from them. */
  accessibilityLabel?: string;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The scene's character as a chibi head and shoulders in a tinted circle. */
export function CharacterAvatar({
  scenario,
  size = 48,
  talking = false,
  animated = false,
  accessibilityLabel,
  ring = false,
  style,
}: CharacterAvatarProps) {
  const palette = tints[scenarioTint(scenario.id, 0, scenario.icon)];
  // Drawn a little larger than the circle so the face fills it and the shoulders run off the bottom.
  const chibi = size * 1.15;
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg, borderWidth: ring ? 3 : 0 },
        style,
      ]}>
      <Chibi
        look={lookFor(scenario)}
        size={chibi}
        talking={talking}
        animated={animated}
        style={{ position: 'absolute', top: size * 0.04, left: (size - chibi) / 2 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    borderColor: colors.surface,
  },
});
