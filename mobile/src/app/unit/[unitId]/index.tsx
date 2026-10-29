import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Mic, Target, Trophy } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IconButton } from '@/components/IconButton';
import { LessonRow } from '@/components/lesson/LessonRow';
import { Pill } from '@/components/Pill';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { UnitNotFound } from '@/components/units/UnitNotFound';
import type { Unit } from '@/content/lessons/types';
import { findUnit, PARTS, UNITS } from '@/content/lessons/units';
import { useScenarios } from '@/hooks/useScenarios';
import { firstUnfinished, isCheckpointDone, isLessonDone, isUnitDone, lessonsDone } from '@/lib/course';
import { setLastUnit, useUnitProgress } from '@/lib/unitProgress';
import { PART_TINTS, UnitIcon } from '@/lib/unitVisuals';
import { colors, layout, motion, radii, shadows, spacing, tints } from '@/theme/theme';

/** Lessons are 3 to 5 minutes; this is only for the "about N min" pill. */
const MINUTES_PER_LESSON = 4;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/lessons');
}

export default function UnitScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const unit = findUnit(unitId);
  const open = unit !== undefined && unit.lessons.length > 0;

  useEffect(() => {
    if (open) setLastUnit(unit.id);
  }, [open, unit]);

  if (!open) return <UnitNotFound />;
  return <UnitDetail unit={unit} />;
}

function UnitDetail({ unit }: { unit: Unit }) {
  const insets = useSafeAreaInsets();
  const progress = useUnitProgress();
  const { scenarios } = useScenarios();

  const tint = tints[PART_TINTS[unit.part]];
  const part = PARTS.find((item) => item.id === unit.part);
  const number = UNITS.indexOf(unit) + 1;
  const encounter = unit.encounterId ? scenarios?.find((scenario) => scenario.id === unit.encounterId) : undefined;
  const buildsOn = (unit.buildsOn ?? []).map(findUnit).filter((item): item is Unit => item !== undefined);

  const done = lessonsDone(unit, progress);
  const checkpointDone = isCheckpointDone(progress, unit.id);
  const checkpointResult = progress.checkpoints[unit.id];
  const nextLesson = firstUnfinished(unit, progress);

  const openLesson = (lessonId: string) =>
    router.push({ pathname: '/unit/[unitId]/lesson/[lessonId]', params: { unitId: unit.id, lessonId } });
  const openCheckpoint = () => router.push({ pathname: '/unit/[unitId]/checkpoint', params: { unitId: unit.id } });

  // The footer picks up where the learner left off.
  let footer = { label: 'Start the first lesson', onPress: () => openLesson(unit.lessons[0].id) };
  if (nextLesson && done > 0) footer = { label: 'Keep going', onPress: () => openLesson(nextLesson.id) };
  else if (!nextLesson && !checkpointDone) footer = { label: 'Take the checkpoint', onPress: openCheckpoint };
  else if (isUnitDone(unit, progress)) footer = { label: 'Practice again', onPress: () => openLesson(unit.lessons[0].id) };

  let checkpointSubtitle = 'Best after the lessons';
  if (checkpointResult) checkpointSubtitle = `Best score: ${checkpointResult.firstTry}/${checkpointResult.total} on the first try`;
  else if (!nextLesson) checkpointSubtitle = 'A mix of questions from every lesson';

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}>
        <LinearGradient colors={tint.gradient} style={{ paddingTop: insets.top + spacing.sm }}>
          <View style={styles.column}>
            <View style={styles.backRow}>
              <IconButton icon={ChevronLeft} accessibilityLabel="Back to lessons" onPress={goBack} variant="surface" iconSize={22} />
            </View>

            <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.hero}>
              <View style={styles.heroTile}>
                <UnitIcon name={unit.icon} size={34} color={tint.fg} strokeWidth={2} />
              </View>
              <Text variant="tiny" color={colors.inkMuted}>
                UNIT {number} · {part?.title.toUpperCase()}
              </Text>
              <Text variant="title" accessibilityRole="header">
                {unit.title}
              </Text>
              <Text variant="body" color={colors.inkMuted}>
                {unit.summary}
              </Text>
              <View style={styles.pills}>
                <Pill label={`${done} of ${unit.lessons.length} lessons done`} icon={BookOpen} tone="neutral" />
                <Pill label={`About ${unit.lessons.length * MINUTES_PER_LESSON} min`} icon={Clock} tone="neutral" />
              </View>
            </Animated.View>
          </View>
        </LinearGradient>

        <View style={[styles.column, styles.sections]}>
          {unit.scene ? (
            <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)}>
              <Card style={styles.scene}>
                <Text variant="tiny" color={tint.fg}>
                  THE SCENE
                </Text>
                <Text variant="body">{unit.scene}</Text>
              </Card>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 2)} style={styles.section}>
            <Text variant="heading">You&apos;ll be able to</Text>
            <Card padded={false}>
              {unit.canDo.map((line, index) => (
                <View key={line} style={[styles.canDoRow, index > 0 ? styles.rowDivider : null]}>
                  <Target size={20} color={colors.sky700} />
                  <Text variant="bodyMedium" style={styles.flex}>
                    {line}
                  </Text>
                </View>
              ))}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 3)} style={styles.section}>
            <Text variant="heading">Lessons</Text>
            <Text variant="caption" color={colors.inkMuted}>
              Take them in order, or jump to the one you need. Finish with the checkpoint to complete the unit.
            </Text>
            <Card padded={false}>
              {unit.lessons.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  number={index + 1}
                  finished={isLessonDone(progress, unit.id, lesson.id)}
                  divider={index > 0}
                  hint="Opens the lesson"
                  onPress={() => openLesson(lesson.id)}
                />
              ))}
              <CheckpointRow done={checkpointDone} subtitle={checkpointSubtitle} onPress={openCheckpoint} />
            </Card>
          </Animated.View>

          {unit.encounterId ? (
            <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 4)} style={styles.section}>
              <Text variant="heading">Now try it for real</Text>
              <Card
                onPress={() => router.push({ pathname: '/encounter/[id]', params: { id: unit.encounterId ?? '' } })}
                accessibilityLabel={`Encounter: ${encounter?.title ?? 'talk it through with an AI character'}`}
                accessibilityHint="Opens the encounter"
                style={styles.linkCard}>
                <View style={[styles.linkTile, { backgroundColor: tints.sun.bg }]}>
                  <Mic size={24} color={tints.sun.fg} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{encounter?.title ?? 'The matching encounter'}</Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {encounter
                      ? `Talk it through with ${encounter.character.name_english} in ${encounter.city}`
                      : 'Talk it through out loud with an AI character'}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.inkMuted} />
              </Card>
            </Animated.View>
          ) : null}

          {buildsOn.length > 0 || unit.essentials ? (
            <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 5)} style={styles.section}>
              {buildsOn.length > 0 ? (
                <>
                  <Text variant="subheading">Builds on</Text>
                  <View style={styles.pills}>
                    {buildsOn.map((item) => (
                      <PressableScale
                        key={item.id}
                        onPress={() => router.push({ pathname: '/unit/[unitId]', params: { unitId: item.id } })}
                        accessibilityRole="button"
                        accessibilityLabel={`Unit: ${item.title}`}
                        accessibilityHint="Opens that unit"
                        style={styles.chip}>
                        {isUnitDone(item, progress) ? <Check size={14} color={colors.success} strokeWidth={3} /> : null}
                        <Text variant="label" color={colors.sky700}>
                          {item.title}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                </>
              ) : null}
              {unit.essentials ? (
                <Button
                  label={unit.essentials.label}
                  icon={BookOpen}
                  variant="secondary"
                  size="md"
                  onPress={() => unit.essentials && router.push(unit.essentials.href)}
                />
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.column}>
          <Button label={footer.label} icon={ArrowRight} iconPosition="right" onPress={footer.onPress} />
        </View>
      </View>
    </View>
  );
}

function CheckpointRow({ done, subtitle, onPress }: { done: boolean; subtitle: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Checkpoint: review the unit. ${subtitle}.${done ? ' Done.' : ''}`}
      accessibilityHint="Opens a mixed review of the whole unit"
      style={[styles.checkpointRow, styles.rowDivider]}>
      <View style={[styles.badge, done ? styles.badgeDone : null]}>
        {done ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : <Trophy size={15} color="#A16207" strokeWidth={2.4} />}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">Checkpoint: review the unit</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.inkMuted} />
    </PressableScale>
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
  backRow: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
  hero: { gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.xl },
  heroTile: {
    width: 68,
    height: 68,
    borderRadius: radii.card + 4,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  sections: { gap: spacing.xxl, paddingTop: spacing.xs },
  section: { gap: spacing.md },
  scene: { gap: spacing.sm },
  canDoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  checkpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 64,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sun100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: colors.success },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkTile: { width: 48, height: 48, borderRadius: radii.card, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.sky50,
    borderWidth: 1,
    borderColor: colors.sky100,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
