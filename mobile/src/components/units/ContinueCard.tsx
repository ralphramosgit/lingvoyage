import { ArrowRight, MessagesSquare, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import type { ContinueTarget } from '@/lib/course';
import { colors, radii, shadows, spacing } from '@/theme/theme';

/** The top of the Lessons tab: the next thing to do, one tap away. */
export function ContinueCard({ target, onOpen }: { target: ContinueTarget; onOpen: () => void }) {
  let label: string;
  let line: string;
  let title: string;
  let button: string;
  if (target.kind === 'lesson') {
    label = target.firstEver ? 'START HERE' : 'CONTINUE';
    line = `${target.unit.title} · Lesson ${target.number} of ${target.unit.lessons.length}`;
    title = target.lesson.title;
    button = target.firstEver ? 'Start the first lesson' : 'Continue';
  } else if (target.kind === 'checkpoint') {
    label = 'CHECKPOINT';
    line = target.unit.title;
    title = 'Review the unit';
    button = 'Start checkpoint';
  } else {
    label = 'COURSE COMPLETE';
    line = "You've finished every unit.";
    title = 'Now put it to work in an encounter';
    button = 'Go to Encounters';
  }

  return (
    <View style={styles.card} accessible={false}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="tiny" color={colors.sun300}>
            {label}
          </Text>
          <Text variant="caption" color="#E0F2FE">
            {line}
          </Text>
          <Text variant="heading" color="#FFFFFF" accessibilityRole="header">
            {title}
          </Text>
        </View>
        {target.kind === 'complete' ? <Trophy size={36} color={colors.sun300} /> : null}
      </View>
      <Button
        label={button}
        variant="sun"
        icon={target.kind === 'complete' ? MessagesSquare : ArrowRight}
        iconPosition={target.kind === 'complete' ? 'left' : 'right'}
        size="md"
        onPress={onOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.card,
    // sky700 rather than sky600 so the small text keeps enough contrast.
    backgroundColor: colors.sky700,
    ...shadows.raised,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
