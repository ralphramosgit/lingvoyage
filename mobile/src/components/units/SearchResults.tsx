import { Check, ChevronRight, CircleCheck, SearchX } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import type { Unit, UnitLesson } from '@/content/lessons/types';
import { isLessonDone, isUnitDone, lessonsDone } from '@/lib/course';
import type { LessonHit, SearchResults as Results, UnitHit } from '@/lib/courseSearch';
import type { UnitProgress } from '@/lib/unitProgress';
import { PART_TINTS, UnitIcon } from '@/lib/unitVisuals';
import { colors, fonts, radii, spacing, tints } from '@/theme/theme';

/** Plenty for a phone screen; a longer search narrows it down. */
const MAX_LESSONS = 25;

/** What a search on the Lessons tab found: units, then lessons, each opening straight into it. */
export function SearchResults({
  query,
  results,
  progress,
  onOpenUnit,
  onOpenLesson,
}: {
  query: string;
  /** null while the query is too short to search. */
  results: Results | null;
  progress: UnitProgress;
  onOpenUnit: (unit: Unit) => void;
  onOpenLesson: (unit: Unit, lesson: UnitLesson) => void;
}) {
  if (!results) {
    return (
      <Text variant="caption" color={colors.inkMuted} style={styles.note}>
        Keep typing to search.
      </Text>
    );
  }

  const count = results.units.length + results.lessons.length;
  if (count === 0) {
    return (
      <Card style={styles.empty}>
        <View style={styles.emptyIcon}>
          <SearchX size={26} color={colors.sky700} />
        </View>
        <Text variant="subheading" align="center" accessibilityLiveRegion="polite">
          Nothing matches “{query.trim()}”
        </Text>
        <Text variant="caption" color={colors.inkMuted} align="center">
          Try a word in English (taxi), pinyin without tone marks (duoshao) or characters (多少).
        </Text>
      </Card>
    );
  }

  const lessons = results.lessons.slice(0, MAX_LESSONS);
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color={colors.inkMuted} accessibilityLiveRegion="polite">
        {count} {count === 1 ? 'result' : 'results'} for “{query.trim()}”
      </Text>

      {results.units.length > 0 ? (
        <View style={styles.section}>
          <Text variant="subheading" accessibilityRole="header">
            Units
          </Text>
          <Card padded={false}>
            {results.units.map((hit, index) => (
              <UnitResult
                key={hit.unit.id}
                hit={hit}
                progress={progress}
                divider={index > 0}
                onPress={() => onOpenUnit(hit.unit)}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {lessons.length > 0 ? (
        <View style={styles.section}>
          <Text variant="subheading" accessibilityRole="header">
            Lessons
          </Text>
          <Card padded={false}>
            {lessons.map((hit, index) => (
              <LessonResult
                key={`${hit.unit.id}/${hit.lesson.id}`}
                hit={hit}
                done={isLessonDone(progress, hit.unit.id, hit.lesson.id)}
                divider={index > 0}
                onPress={() => onOpenLesson(hit.unit, hit.lesson)}
              />
            ))}
          </Card>
          {results.lessons.length > lessons.length ? (
            <Text variant="caption" color={colors.inkMuted}>
              Showing the first {lessons.length} of {results.lessons.length} lessons. Add a word to narrow it down.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function UnitResult({
  hit: { unit, number },
  progress,
  divider,
  onPress,
}: {
  hit: UnitHit;
  progress: UnitProgress;
  divider: boolean;
  onPress: () => void;
}) {
  const palette = tints[PART_TINTS[unit.part]];
  const complete = isUnitDone(unit, progress);
  const status = complete ? 'Done' : `${lessonsDone(unit, progress)} of ${unit.lessons.length} done`;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Unit ${number}: ${unit.title}. ${unit.summary} ${status}.`}
      accessibilityHint="Opens the unit"
      style={[styles.row, divider ? styles.divider : null]}>
      <View style={[styles.tile, { backgroundColor: palette.bg }]}>
        <UnitIcon name={unit.icon} size={20} color={palette.fg} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <Text variant="tiny" color={colors.inkMuted}>
          UNIT {number} · {status.toUpperCase()}
        </Text>
        <Text variant="bodyStrong">{unit.title}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {unit.summary}
        </Text>
      </View>
      {complete ? <CircleCheck size={18} color={colors.success} /> : <ChevronRight size={20} color={colors.inkMuted} />}
    </PressableScale>
  );
}

function LessonResult({
  hit: { unit, lesson, number, phrase },
  done,
  divider,
  onPress,
}: {
  hit: LessonHit;
  done: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unit.title}, lesson ${number}: ${lesson.title}.${phrase ? ` Has ${phrase.english}.` : ''}${done ? ' Done.' : ''}`}
      accessibilityHint="Opens the lesson"
      style={[styles.row, divider ? styles.divider : null]}>
      <View style={[styles.badge, done ? styles.badgeDone : null]}>
        {done ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : <Text style={styles.number}>{number}</Text>}
      </View>
      <View style={styles.flex}>
        <Text variant="tiny" color={colors.inkMuted}>
          {unit.title.toUpperCase()} · LESSON {number}
        </Text>
        <Text variant="bodyStrong">{lesson.title}</Text>
        {phrase ? (
          <Text variant="caption" color={colors.sky700}>
            {phrase.hanzi} {phrase.pinyin} · {phrase.english}
          </Text>
        ) : (
          <Text variant="caption" color={colors.inkMuted}>
            {lesson.summary}
          </Text>
        )}
      </View>
      <ChevronRight size={20} color={colors.inkMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  wrap: { gap: spacing.xl },
  section: { gap: spacing.md },
  note: { paddingVertical: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.sky100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 64,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  tile: { width: 40, height: 40, borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
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
});
