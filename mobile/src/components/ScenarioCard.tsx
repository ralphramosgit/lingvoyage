import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Chibi } from '@/components/art/Chibi';
import { SceneBackdrop } from '@/components/art/SceneBackdrop';
import { lookFor } from '@/lib/characterLooks';
import { sceneKind } from '@/lib/scenarioVisuals';
import { colors, radii, shadows, spacing } from '@/theme/theme';
import type { Scenario } from '@/types/api';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

const ART_HEIGHT = 128;

/** A scene to pick: its place drawn across the top with the character in it, then what it's about. */
export function ScenarioCard({
  scenario,
  completed,
  onPress,
}: {
  scenario: Scenario;
  completed: boolean;
  onPress: () => void;
}) {
  const { character } = scenario;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${scenario.title}. ${scenario.subtitle}. ${scenario.city}, with ${character.name_english}, ${scenario.minutes} minutes.${completed ? ' Completed.' : ''}`}
      accessibilityHint="Opens the encounter"
      style={styles.card}>
      <View style={styles.art}>
        <SceneBackdrop scene={sceneKind(scenario.icon)} />
        <Chibi look={lookFor(scenario)} size={ART_HEIGHT - 8} animated={false} style={styles.character} />
        {completed ? (
          <View style={styles.done}>
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
            <Text variant="tiny" color="#FFFFFF">
              Done
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.flex}>
          <Text variant="subheading">{scenario.title}</Text>
          <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
            with {character.name_english} · {scenario.minutes} min
          </Text>
        </View>
        <ChevronRight size={20} color={colors.inkMuted} />
      </View>
    </PressableScale>
  );
}

/** A scene or unit that isn't ready yet: quiet, so it doesn't compete with the ones that are. */
export function LockedScenarioCard({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <View style={styles.locked} accessible accessibilityLabel={`${title}, coming soon`}>
      <Icon size={20} color={colors.inkMuted} strokeWidth={2} />
      <Text variant="bodyMedium" color={colors.inkMuted} style={styles.flex}>
        {title}
      </Text>
      <Text variant="tiny" color={colors.inkMuted}>
        Soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  art: { height: ART_HEIGHT, backgroundColor: colors.sky100, overflow: 'hidden' },
  character: { position: 'absolute', bottom: -6, left: spacing.lg },
  done: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.success,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
});
