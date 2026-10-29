import { Landmark, Lightbulb } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Card } from '@/components/Card';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import type { CultureNote } from '@/content/lessons/types';
import { colors, motion, radii, spacing, tints } from '@/theme/theme';
import type { KeyPhrase, Lesson } from '@/types/api';

/** What the learn step shows: an encounter practice lesson, or a Lessons tab lesson with its culture note. */
export type LessonIntroContent = Pick<Lesson, 'title' | 'summary' | 'pattern' | 'examples' | 'words' | 'tip'> & {
  culture?: CultureNote;
};

/** The "learn" step before the questions: the pattern, examples and new words. */
export function LessonIntro({
  lesson,
  number,
  total,
  onAudioError,
}: {
  lesson: LessonIntroContent;
  number: number;
  total: number;
  onAudioError: (message: string) => void;
}) {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.heading}>
        <Text variant="tiny" color={colors.sky700}>
          LESSON {number} OF {total}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {lesson.title}
        </Text>
        <Text variant="body" color={colors.inkMuted}>
          {lesson.summary}
        </Text>
      </Animated.View>

      {lesson.pattern ? (
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)} style={styles.pattern}>
          <Text variant="tiny" color={colors.sky700}>
            SENTENCE PATTERN
          </Text>
          <Text variant="hanziLarge">{lesson.pattern.hanzi}</Text>
          <Text variant="label" color={colors.inkMuted}>
            {lesson.pattern.pinyin}
          </Text>
          <Text variant="bodyMedium">{lesson.pattern.english}</Text>
        </Animated.View>
      ) : null}

      {lesson.examples.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 2)} style={styles.section}>
          <Text variant="subheading">Examples</Text>
          <Card padded={false}>
            {lesson.examples.map((example, index) => (
              <PhraseRow key={example.hanzi} phrase={example} divider={index > 0} onAudioError={onAudioError} />
            ))}
          </Card>
        </Animated.View>
      ) : null}

      {lesson.words.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 3)} style={styles.section}>
          <Text variant="subheading">Words</Text>
          <Card padded={false}>
            {lesson.words.map((word, index) => (
              <PhraseRow key={word.hanzi} phrase={word} divider={index > 0} onAudioError={onAudioError} compact />
            ))}
          </Card>
        </Animated.View>
      ) : null}

      {lesson.tip ? (
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 4)} style={styles.tip}>
          <Lightbulb size={20} color="#A16207" />
          <Text variant="caption" style={styles.flex}>
            {lesson.tip}
          </Text>
        </Animated.View>
      ) : null}

      {lesson.culture ? (
        <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger * 5)} style={styles.culture}>
          <View style={styles.cultureTitle}>
            <Landmark size={18} color={tints.mint.fg} />
            <Text variant="tiny" color={tints.mint.fg}>
              CULTURE NOTE
            </Text>
          </View>
          <Text variant="bodyStrong">{lesson.culture.title}</Text>
          <Text variant="caption">{lesson.culture.body}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function PhraseRow({
  phrase,
  divider,
  compact = false,
  onAudioError,
}: {
  phrase: KeyPhrase;
  divider: boolean;
  compact?: boolean;
  onAudioError: (message: string) => void;
}) {
  return (
    <View style={[styles.row, divider ? styles.divider : null]}>
      <View style={styles.flex}>
        {compact ? (
          <Text variant="hanzi">
            {phrase.hanzi}{' '}
            <Text variant="label" color={colors.inkMuted}>
              {phrase.pinyin}
            </Text>
          </Text>
        ) : (
          <>
            <Text variant="hanzi">{phrase.hanzi}</Text>
            <Text variant="label" color={colors.inkMuted}>
              {phrase.pinyin}
            </Text>
          </>
        )}
        <Text variant="caption">{phrase.english}</Text>
      </View>
      <SpeakerButton text={phrase.hanzi} label={`Play ${phrase.english}`} size={40} onError={onAudioError} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: spacing.xxl },
  heading: { gap: spacing.xs },
  pattern: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.sky50,
    borderWidth: 1.5,
    borderColor: colors.sky100,
  },
  section: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  tip: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.sun100,
  },
  culture: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: tints.mint.bg,
  },
  cultureTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
});
