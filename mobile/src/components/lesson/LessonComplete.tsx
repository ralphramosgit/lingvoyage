import { ArrowLeft, ArrowRight, Mic, PartyPopper } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { lessonSummary } from '@/lib/lessons';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';
import type { Lesson } from '@/types/api';

/** The cheer at the end of a lesson or checkpoint, with the screen's own buttons below it. */
export function LessonCompleteView({
  heading = 'Lesson complete!',
  title,
  firstTry,
  total,
  bottomInset,
  children,
}: {
  heading?: string;
  title: string;
  firstTry: number;
  total: number;
  bottomInset: number;
  /** The buttons. */
  children: ReactNode;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.column, styles.body, { paddingBottom: bottomInset + spacing.xl }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.cheer}>
        <Animated.View entering={ZoomIn.duration(motion.slow)} style={styles.badge}>
          <PartyPopper size={40} color="#A16207" strokeWidth={2} />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)} style={styles.text}>
          <Text variant="title" align="center" accessibilityRole="header">
            {heading}
          </Text>
          <Text variant="bodyStrong" align="center" color={colors.sky700}>
            {title}
          </Text>
          <Text variant="body" align="center" color={colors.inkMuted}>
            {lessonSummary(firstTry, total)}
          </Text>
        </Animated.View>
        {/* The score only shows when it's something to be proud of. */}
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 2)} style={styles.score}>
          <Text variant="heading" color={colors.success}>
            {firstTry * 2 >= total ? `${firstTry}/${total}` : total}
          </Text>
          <Text variant="caption" color={colors.inkMuted}>
            {firstTry * 2 >= total ? 'right on the first try' : 'questions practiced'}
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 3)} style={styles.actions}>
        {children}
      </Animated.View>
    </ScrollView>
  );
}

/** "Up next" above the button that goes there. */
export function UpNext({ title }: { title: string }) {
  return (
    <View style={styles.upNext}>
      <Text variant="tiny" color={colors.inkMuted}>
        UP NEXT
      </Text>
      <Text variant="bodyStrong" align="center">
        {title}
      </Text>
    </View>
  );
}

/** End of an encounter practice lesson: a cheer, then the next lesson, the encounter, or back to the lesson list. */
export function LessonComplete({
  lesson,
  firstTry,
  total,
  next,
  characterName,
  bottomInset,
  onNext,
  onStartEncounter,
  onBack,
}: {
  lesson: Lesson;
  firstTry: number;
  total: number;
  next: Lesson | null;
  characterName: string;
  bottomInset: number;
  onNext: () => void;
  onStartEncounter: () => void;
  onBack: () => void;
}) {
  return (
    <LessonCompleteView title={lesson.title} firstTry={firstTry} total={total} bottomInset={bottomInset}>
      {next ? (
        <>
          <UpNext title={next.title} />
          <Button label="Next lesson" icon={ArrowRight} iconPosition="right" onPress={onNext} />
          <Button label="Start encounter" icon={Mic} variant="secondary" onPress={onStartEncounter} />
        </>
      ) : (
        <>
          <Text variant="caption" align="center" color={colors.inkMuted}>
            You&apos;ve practiced everything for this scene. {characterName} is ready when you are.
          </Text>
          <Button label="Start encounter" icon={Mic} onPress={onStartEncounter} />
        </>
      )}
      <Button label="Back to lessons" icon={ArrowLeft} variant="ghost" size="md" onPress={onBack} />
    </LessonCompleteView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  body: { flexGrow: 1, justifyContent: 'center', gap: spacing.xxxl, paddingTop: spacing.xl },
  cheer: { alignItems: 'center', gap: spacing.lg },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.sun100,
    borderWidth: 3,
    borderColor: colors.sun300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { gap: spacing.sm },
  score: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.card,
    backgroundColor: '#F0FDF4',
  },
  actions: { gap: spacing.sm },
  upNext: { alignItems: 'center', gap: 2, marginBottom: spacing.xs },
});
