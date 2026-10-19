import { Check, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, fonts, spacing } from '@/theme/theme';
import type { Lesson } from '@/types/api';

/** One lesson in the encounter screen's "Practice first" list. */
export function LessonRow({
  lesson,
  number,
  finished,
  divider,
  onPress,
}: {
  lesson: Lesson;
  number: number;
  finished: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  const count = lesson.exercises.length;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Lesson ${number}: ${lesson.title}. ${count} questions.${finished ? ' Done.' : ''}`}
      accessibilityHint="Opens the practice lesson"
      style={[styles.row, divider ? styles.divider : null]}>
      <View style={[styles.badge, finished ? styles.badgeDone : null]}>
        {finished ? (
          <Check size={16} color="#FFFFFF" strokeWidth={3} />
        ) : (
          <Text style={styles.number}>{number}</Text>
        )}
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong">{lesson.title}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {lesson.summary} · {count} questions
        </Text>
      </View>
      <ChevronRight size={20} color={colors.inkMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 64,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: colors.success },
  number: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: colors.sky700 },
  text: { flex: 1, gap: 2 },
});
