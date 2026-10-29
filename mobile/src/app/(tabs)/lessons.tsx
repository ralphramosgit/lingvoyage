import { router } from 'expo-router';
import { Languages } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Pill } from '@/components/Pill';
import { LockedScenarioCard } from '@/components/ScenarioCard';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ContinueCard } from '@/components/units/ContinueCard';
import { UnitCard } from '@/components/units/UnitCard';
import { PARTS, UNITS } from '@/content/lessons/units';
import { continueTarget, lessonsDone } from '@/lib/course';
import { useUnitProgress } from '@/lib/unitProgress';
import { unitIcon } from '@/lib/unitVisuals';
import { colors, motion, spacing } from '@/theme/theme';

export default function LessonsScreen() {
  const progress = useUnitProgress();
  const target = continueTarget(UNITS, progress);
  const totalLessons = UNITS.reduce((sum, unit) => sum + unit.lessons.length, 0);
  // Counted from the content, so progress saved for a lesson that's since been removed doesn't count.
  const doneLessons = UNITS.reduce((sum, unit) => sum + lessonsDone(unit, progress), 0);

  const openTarget = () => {
    if (target.kind === 'lesson') {
      router.push({ pathname: '/unit/[unitId]/lesson/[lessonId]', params: { unitId: target.unit.id, lessonId: target.lesson.id } });
    } else if (target.kind === 'checkpoint') {
      router.push({ pathname: '/unit/[unitId]/checkpoint', params: { unitId: target.unit.id } });
    } else {
      router.navigate('/');
    }
  };

  return (
    <Screen scroll edges={['top']}>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Lessons
        </Text>
        <Text variant="body" color={colors.inkMuted}>
          A beginner course for your trip, one short lesson at a time.
        </Text>
        <View style={styles.pills}>
          <Pill label="Mandarin Chinese" icon={Languages} tone="sky" />
          <Pill label={`${doneLessons} of ${totalLessons} lessons done`} tone="neutral" />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)}>
        <ContinueCard target={target} onOpen={openTarget} />
      </Animated.View>

      {PARTS.map((part, partIndex) => (
        <Animated.View
          key={part.id}
          entering={FadeInDown.duration(motion.base).delay(motion.stagger * (partIndex + 2))}
          style={styles.part}>
          <View style={styles.partTitle}>
            <Text variant="heading">{part.title}</Text>
            <Text variant="caption" color={colors.inkMuted}>
              {part.summary}
            </Text>
          </View>
          <View style={styles.list}>
            {UNITS.filter((unit) => unit.part === part.id).map((unit) =>
              unit.lessons.length > 0 ? (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  number={UNITS.indexOf(unit) + 1}
                  progress={progress}
                  onPress={() => router.push({ pathname: '/unit/[unitId]', params: { unitId: unit.id } })}
                />
              ) : (
                <LockedScenarioCard key={unit.id} title={unit.title} icon={unitIcon(unit.icon)} />
              ),
            )}
          </View>
        </Animated.View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingTop: spacing.lg, marginBottom: spacing.xl },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  part: { marginTop: spacing.xxl, gap: spacing.md },
  partTitle: { gap: 2 },
  list: { gap: spacing.md },
});
