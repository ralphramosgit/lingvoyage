import { ChevronRight, CircleCheck, Clock, Gauge, Lock, type LucideIcon, MapPin, Target } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { scenarioIcon, scenarioTint } from '@/lib/scenarioVisuals';
import { colors, radii, spacing, tints } from '@/theme/theme';
import type { Scenario } from '@/types/api';

import { Card } from './Card';
import { CharacterAvatar } from './CharacterAvatar';
import { Pill } from './Pill';
import { Text } from './Text';

function Meta({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.meta}>
      <Icon size={14} color={colors.inkMuted} />
      <Text variant="caption" color={colors.inkMuted}>
        {label}
      </Text>
    </View>
  );
}

export function ScenarioCard({
  scenario,
  completed,
  index,
  onPress,
}: {
  scenario: Scenario;
  completed: boolean;
  index: number;
  onPress: () => void;
}) {
  const tint = scenarioTint(scenario.id, index);
  const Icon = scenarioIcon(scenario.icon);
  const palette = tints[tint];
  const { character } = scenario;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${scenario.title}. ${scenario.subtitle}. ${scenario.city}, with ${character.name_english}. ${scenario.goals.length} goals, ${scenario.difficulty}.${completed ? ' Completed.' : ''}`}
      accessibilityHint="Opens the encounter"
      style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: palette.bg }]}>
          <Icon size={28} color={palette.fg} strokeWidth={2} />
        </View>
        <View style={styles.titles}>
          <Text variant="subheading">{scenario.title}</Text>
          <Text variant="caption" color={colors.inkMuted}>
            {scenario.subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Pill label={scenario.city} icon={MapPin} tone="sky" />
        <Meta icon={Target} label={`${scenario.goals.length} goals`} />
        <Meta icon={Gauge} label={scenario.difficulty} />
        <Meta icon={Clock} label={`${scenario.minutes} min`} />
      </View>

      <View style={styles.divider} />

      <View style={styles.bottom}>
        <CharacterAvatar char={character.avatar_char} size={32} tint={tint} />
        <View style={styles.characterText}>
          <Text variant="label" numberOfLines={1}>
            {character.name_hanzi} <Text variant="label" color={colors.inkMuted}>{character.name_pinyin}</Text>
          </Text>
          <Text variant="tiny" color={colors.inkMuted} numberOfLines={1}>
            {character.role}
          </Text>
        </View>
        {completed ? <Pill label="Completed" icon={CircleCheck} tone="success" /> : null}
        <ChevronRight size={20} color={colors.inkMuted} />
      </View>
    </Card>
  );
}

export function LockedScenarioCard({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <View style={styles.locked} accessible accessibilityLabel={`${title}, coming soon`}>
      <View style={[styles.tile, styles.lockedTile]}>
        <Icon size={26} color={colors.inkMuted} strokeWidth={2} />
      </View>
      <View style={styles.titles}>
        <Text variant="subheading" color={colors.inkMuted}>
          {title}
        </Text>
        <Pill label="Coming soon" tone="neutral" />
      </View>
      <Lock size={20} color={colors.inkMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  top: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  tile: {
    width: 56,
    height: 56,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.line },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  characterText: { flex: 1 },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: '#F8FBFE',
  },
  lockedTile: { backgroundColor: '#EEF3F8' },
});
