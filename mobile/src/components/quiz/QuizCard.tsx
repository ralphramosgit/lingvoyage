import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import type { Quiz } from '@/content/quizzes/types';
import { QuizIcon, quizTint } from '@/lib/quizVisuals';
import { colors, radii, spacing, tints } from '@/theme/theme';

/** A quiz on the Quiz tab: icon, title, summary and how many questions. */
export function QuizCard({ quiz, onPress }: { quiz: Quiz; onPress: () => void }) {
  const palette = tints[quizTint(quiz)];
  const questions = `${quiz.exercises.length} questions`;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${quiz.title}. ${quiz.summary} ${questions}.`}
      accessibilityHint="Starts the quiz"
      style={styles.card}>
      <View style={[styles.tile, { backgroundColor: palette.bg }]}>
        <QuizIcon name={quiz.icon} size={26} color={palette.fg} strokeWidth={2} />
      </View>
      <View style={styles.titles}>
        <Text variant="subheading">{quiz.title}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {quiz.summary}
        </Text>
        <Text variant="tiny" color={colors.inkMuted} style={styles.count}>
          {questions.toUpperCase()}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.inkMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  tile: { width: 52, height: 52, borderRadius: radii.card, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
  count: { marginTop: spacing.xs },
});
