import { ArrowLeft, Award, Check, ChevronUp, MessagesSquare, RotateCcw } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, layout, motion, radii, shadows, spacing } from '@/theme/theme';
import type { Goal } from '@/types/api';

export function CompletionSheet({
  goals,
  completedIds,
  linesPracticed,
  characterName,
  onPracticeAgain,
  onReview,
  onBack,
  bottomInset,
}: {
  goals: Goal[];
  completedIds: string[];
  linesPracticed: number;
  characterName: string;
  onPracticeAgain: () => void;
  /** Closes the sheet so the learner can scroll back through the chat. */
  onReview: () => void;
  onBack: () => void;
  bottomInset: number;
}) {
  return (
    <Animated.View exiting={FadeOut.duration(motion.fast)} style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(motion.base)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onReview}
          accessibilityRole="button"
          accessibilityLabel="Close summary and review the conversation"
        />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(motion.slow)} style={styles.sheetDock}>
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, spacing.lg) + spacing.sm }]}>
          <View style={styles.handle} />
          <Animated.View entering={ZoomIn.delay(motion.base).duration(motion.slow)} style={styles.award}>
            <Award size={40} color="#A16207" strokeWidth={2} />
          </Animated.View>
          <Text variant="title" align="center" accessibilityRole="header">
            Encounter complete
          </Text>
          <Text variant="body" color={colors.inkMuted} align="center">
            Nice work with {characterName}. You practiced {linesPracticed} {linesPracticed === 1 ? 'line' : 'lines'} in
            Mandarin.
          </Text>

          <View style={styles.goals}>
            {goals.map((goal) => {
              const done = completedIds.includes(goal.id);
              return (
                <View key={goal.id} style={styles.goalRow}>
                  <View style={[styles.check, done ? styles.checkDone : null]}>
                    {done ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <Text variant="bodyMedium" style={styles.flex}>
                    {goal.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button label="Practice again" icon={RotateCcw} onPress={onPracticeAgain} />
            <Button label="Review conversation" icon={MessagesSquare} variant="secondary" onPress={onReview} />
            <Button label="Back to Encounters" icon={ArrowLeft} variant="ghost" size="md" onPress={onBack} />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** Takes the input bar's place once the encounter is over, while the learner reviews the chat. */
export function CompleteBar({
  goalsDone,
  goalsTotal,
  onShowSummary,
  onPracticeAgain,
  onDone,
  bottomInset,
}: {
  goalsDone: number;
  goalsTotal: number;
  onShowSummary: () => void;
  onPracticeAgain: () => void;
  onDone: () => void;
  bottomInset: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)}
      style={[styles.bar, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
      <PressableScale
        onPress={onShowSummary}
        accessibilityRole="button"
        accessibilityLabel={`Encounter complete, ${goalsDone} of ${goalsTotal} goals. Show summary`}
        style={styles.barSummary}>
        <View style={styles.barAward}>
          <Award size={20} color="#A16207" strokeWidth={2.2} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Encounter complete</Text>
          <Text variant="caption" color={colors.inkMuted}>
            {goalsDone}/{goalsTotal} goals · Scroll up to review your chat
          </Text>
        </View>
        <ChevronUp size={20} color={colors.sky700} />
      </PressableScale>
      <View style={styles.barActions}>
        <Button label="Practice again" icon={RotateCcw} size="md" onPress={onPracticeAgain} style={styles.flex} />
        <Button label="Done" icon={Check} size="md" variant="secondary" onPress={onDone} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,31,51,0.45)' },
  sheetDock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    ...shadows.raised,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: spacing.sm },
  award: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.sun100,
    borderWidth: 3,
    borderColor: colors.sun300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  goals: {
    marginTop: spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  bar: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.md,
  },
  barSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  barAward: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sun100,
    borderWidth: 2,
    borderColor: colors.sun300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barActions: { flexDirection: 'row', gap: spacing.sm },
});
