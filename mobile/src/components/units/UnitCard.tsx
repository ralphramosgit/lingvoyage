import { ChevronRight, CircleCheck, Mic } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Text } from '@/components/Text';
import type { Unit } from '@/content/lessons/types';
import { isUnitDone, lessonsDone } from '@/lib/course';
import type { UnitProgress } from '@/lib/unitProgress';
import { PART_TINTS, UnitIcon } from '@/lib/unitVisuals';
import { colors, radii, spacing, tints } from '@/theme/theme';

/** A unit on the Lessons tab: icon, title, summary and how far along it is. */
export function UnitCard({
  unit,
  number,
  progress,
  onPress,
}: {
  unit: Unit;
  number: number;
  progress: UnitProgress;
  onPress: () => void;
}) {
  const palette = tints[PART_TINTS[unit.part]];
  const done = lessonsDone(unit, progress);
  const total = unit.lessons.length;
  const complete = isUnitDone(unit, progress);

  let status = `${total} lessons`;
  if (complete) status = 'Done';
  else if (done > 0) status = `${done} of ${total} done`;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Unit ${number}: ${unit.title}. ${unit.summary} ${status}.${unit.encounterId ? ' Ends with an encounter.' : ''}`}
      accessibilityHint="Opens the unit"
      style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: palette.bg }]}>
          <UnitIcon name={unit.icon} size={26} color={palette.fg} strokeWidth={2} />
        </View>
        <View style={styles.titles}>
          <Text variant="tiny" color={colors.inkMuted}>
            UNIT {number}
          </Text>
          <Text variant="subheading">{unit.title}</Text>
          <Text variant="caption" color={colors.inkMuted}>
            {unit.summary}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.inkMuted} />
      </View>

      <View style={styles.bottom}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${total > 0 ? (done / total) * 100 : 0}%` }]} />
        </View>
        {complete ? (
          <Pill label="Done" icon={CircleCheck} tone="success" />
        ) : (
          <Text variant="tiny" color={colors.inkMuted}>
            {status}
          </Text>
        )}
        {unit.encounterId ? <Pill label="Encounter" icon={Mic} tone="sky" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  tile: { width: 52, height: 52, borderRadius: radii.card, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.success },
});
