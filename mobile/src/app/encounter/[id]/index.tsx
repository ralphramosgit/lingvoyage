import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, Circle, Globe, Mic } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chibi } from '@/components/art/Chibi';
import { SceneBackdrop } from '@/components/art/SceneBackdrop';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { LessonRow } from '@/components/lesson/LessonRow';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { SourcesSheet } from '@/components/SourcesSheet';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import { VoyageLoader } from '@/components/VoyageLoader';
import { useScenario } from '@/hooks/useScenarios';
import { stopPlayback } from '@/lib/audio';
import { lookFor } from '@/lib/characterLooks';
import { useLessonFinished } from '@/lib/lessonProgress';
import { shortDay } from '@/lib/packVisuals';
import { sceneKind } from '@/lib/scenarioVisuals';
import { colors, layout, motion, radii, shadows, spacing } from '@/theme/theme';

const HERO_HEIGHT = 250;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function EncounterPrepScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scenario, loading, error, reload, notFound } = useScenario(id);
  const insets = useSafeAreaInsets();
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isFinished = useLessonFinished(scenario?.id);

  useEffect(() => () => stopPlayback(), []);

  if (!scenario) {
    return (
      <Screen
        header={
          <View style={styles.backRow}>
            <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={goBack} variant="surface" iconSize={22} />
          </View>
        }
        contentStyle={styles.center}>
        {loading ? <VoyageLoader /> : null}
        {error ? <ErrorState title="Couldn't load this encounter" message={error} onRetry={reload} /> : null}
        {notFound ? (
          <Text variant="body" align="center" color={colors.inkMuted}>
            This encounter doesn&apos;t exist anymore.
          </Text>
        ) : null}
      </Screen>
    );
  }

  const { character } = scenario;
  const lessons = scenario.lessons ?? [];
  // Local encounters (from the city pack) say where their real details came from.
  const sources = scenario.sources ?? [];
  const checkedOn = scenario.checked_at ? shortDay(scenario.checked_at) : null;
  const finishedCount = lessons.filter((lesson) => isFinished(lesson.id)).length;
  // The footer's practice button picks up where the learner left off.
  const practiceTarget = lessons.find((lesson) => !isFinished(lesson.id)) ?? lessons[0];
  let practiceLabel = 'Practice first';
  if (finishedCount === lessons.length) practiceLabel = 'Practice again';
  else if (finishedCount > 0) practiceLabel = 'Keep practicing';

  const openLesson = (lessonId: string) => {
    stopPlayback();
    router.push({ pathname: '/encounter/[id]/lesson/[lessonId]', params: { id: scenario.id, lessonId } });
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: (lessons.length > 0 ? 180 : 120) + insets.bottom }}
        showsVerticalScrollIndicator={false}>
        {/* The place, with the character standing in it. */}
        <View style={[styles.hero, { height: HERO_HEIGHT + insets.top }]}>
          <SceneBackdrop scene={sceneKind(scenario.icon)} />
          <View style={[styles.column, styles.backRow, { paddingTop: insets.top + spacing.sm }]}>
            <IconButton icon={ChevronLeft} accessibilityLabel="Back to encounters" onPress={goBack} variant="surface" iconSize={22} />
          </View>
          <Animated.View entering={FadeInUp.duration(motion.slow)} style={styles.character}>
            <Chibi look={lookFor(scenario)} size={176} />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(motion.base).delay(motion.base)}
            style={styles.nameCard}
            accessible
            accessibilityLabel={`You'll be talking to ${character.name_english}, ${character.role}`}>
            <Text variant="subheading">
              {character.name_hanzi}{' '}
              <Text variant="label" color={colors.inkMuted}>
                {character.name_pinyin}
              </Text>
            </Text>
            <Text variant="caption" color={colors.inkMuted}>
              {character.role}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.sheet}>
          <Animated.View entering={FadeInDown.duration(motion.base)} style={[styles.column, styles.titles]}>
            <Text variant="title" accessibilityRole="header">
              {scenario.title}
            </Text>
            <Text variant="body" color={colors.inkMuted}>
              {scenario.city} · {scenario.setting}
            </Text>
            <Text variant="caption" color={colors.inkMuted}>
              {scenario.difficulty} · {scenario.minutes} min
            </Text>
            {sources.length > 0 ? (
              <PressableScale
                onPress={() => setSourcesOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Real details from the web${checkedOn ? `, checked ${checkedOn}` : ''}. Show the ${sources.length} sources.`}
                style={styles.sourcesLine}>
                <Globe size={16} color={colors.sky700} />
                <Text variant="caption" color={colors.inkMuted} style={styles.flexShrink}>
                  Real details from the web{checkedOn ? `, checked ${checkedOn}` : ''} ·{' '}
                  <Text variant="caption" color={colors.sky700}>
                    Sources
                  </Text>
                </Text>
                <ChevronRight size={14} color={colors.sky700} />
              </PressableScale>
            ) : null}
          </Animated.View>

          <View style={[styles.column, styles.sections]}>
            <Animated.View entering={FadeInDown.duration(motion.base).delay(120)} style={styles.section}>
              <Text variant="heading">Your goals</Text>
              <Card padded={false}>
                {scenario.goals.map((goal, index) => (
                  <View key={goal.id} style={[styles.goalRow, index > 0 ? styles.rowDivider : null]}>
                    <Circle size={20} color={colors.line} strokeWidth={2.5} />
                    <Text variant="bodyMedium" style={styles.flex}>
                      {goal.label}
                    </Text>
                  </View>
                ))}
              </Card>
            </Animated.View>

            {lessons.length > 0 ? (
              <Animated.View entering={FadeInDown.duration(motion.base).delay(180)} style={styles.section}>
                <View style={styles.sectionTitle}>
                  <Text variant="heading">Practice first</Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    Optional
                  </Text>
                </View>
                <Text variant="caption" color={colors.inkMuted}>
                  Short quizzes on the words and sentences in this scene. Pick any lesson, do them all, or skip straight to
                  the encounter.
                </Text>
                <Card padded={false}>
                  {lessons.map((lesson, index) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      number={index + 1}
                      finished={isFinished(lesson.id)}
                      divider={index > 0}
                      onPress={() => openLesson(lesson.id)}
                    />
                  ))}
                </Card>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.duration(motion.base).delay(240)} style={styles.section}>
              <Text variant="heading">Key phrases</Text>
              <Text variant="caption" color={colors.inkMuted}>
                Tap the speaker to hear each one. Audio is saved on your phone, so replays are free.
              </Text>
              {phraseError ? <FormMessage message={phraseError} /> : null}
              <Card padded={false}>
                {scenario.key_phrases.map((phrase, index) => (
                  <View key={phrase.hanzi} style={[styles.phraseRow, index > 0 ? styles.rowDivider : null]}>
                    <View style={styles.flex}>
                      <Text variant="hanziLarge">{phrase.hanzi}</Text>
                      <Text variant="label" color={colors.inkMuted}>
                        {phrase.pinyin}
                      </Text>
                      <Text variant="caption">{phrase.english}</Text>
                    </View>
                    <SpeakerButton
                      text={phrase.hanzi}
                      label={`Play ${phrase.english}`}
                      size={44}
                      onError={(message) => setPhraseError(message)}
                    />
                  </View>
                ))}
              </Card>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={[styles.column, styles.footerButtons]}>
          {practiceTarget ? (
            <Button
              label={practiceLabel}
              icon={BookOpen}
              variant="secondary"
              size="md"
              accessibilityHint={`Opens the lesson “${practiceTarget.title}”`}
              onPress={() => openLesson(practiceTarget.id)}
            />
          ) : null}
          <Button
            label="Start encounter"
            icon={Mic}
            onPress={() => {
              stopPlayback();
              router.push({ pathname: '/encounter/[id]/talk', params: { id: scenario.id } });
            }}
          />
        </View>
      </View>

      {sourcesOpen ? (
        <SourcesSheet
          sources={sources}
          checkedOn={checkedOn}
          onClose={() => setSourcesOpen(false)}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { justifyContent: 'center', alignItems: 'stretch' },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  backRow: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
  hero: { backgroundColor: colors.sky100 },
  // Stands at the bottom of the picture; the sheet below covers the shoulders, as if behind a counter.
  character: { position: 'absolute', bottom: radii.sheet - 14, left: layout.screenPadding - 8 },
  nameCard: {
    position: 'absolute',
    left: layout.screenPadding + 168,
    right: layout.screenPadding,
    bottom: radii.sheet + spacing.xl,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  sheet: {
    marginTop: -radii.sheet,
    paddingTop: spacing.xxl,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.bg,
  },
  titles: { gap: spacing.xs, marginBottom: spacing.xl },
  sourcesLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, minHeight: layout.minTouchTarget },
  sections: { gap: spacing.xxl, paddingTop: spacing.xs },
  section: { gap: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  phraseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  footerButtons: { gap: spacing.sm },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(245,250,255,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
