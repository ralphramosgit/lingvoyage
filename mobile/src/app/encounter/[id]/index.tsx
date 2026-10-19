import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, ChevronLeft, Circle, Clock, Gauge, MapPin, Mic } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CharacterAvatar } from '@/components/CharacterAvatar';
import { ErrorState } from '@/components/ErrorState';
import { FormMessage } from '@/components/FormMessage';
import { IconButton } from '@/components/IconButton';
import { LessonRow } from '@/components/lesson/LessonRow';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { SpeakerButton } from '@/components/SpeakerButton';
import { Text } from '@/components/Text';
import { useScenario } from '@/hooks/useScenarios';
import { stopPlayback } from '@/lib/audio';
import { useLessonFinished } from '@/lib/lessonProgress';
import { ScenarioIcon, scenarioTint } from '@/lib/scenarioVisuals';
import { colors, layout, motion, radii, shadows, spacing, tints } from '@/theme/theme';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function EncounterPrepScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scenario, loading, error, reload, notFound } = useScenario(id);
  const insets = useSafeAreaInsets();
  const [phraseError, setPhraseError] = useState<string | null>(null);
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
        {loading ? <ActivityIndicator color={colors.sky600} size="large" /> : null}
        {error ? <ErrorState title="Couldn't load this encounter" message={error} onRetry={reload} /> : null}
        {notFound ? (
          <Text variant="body" align="center" color={colors.inkMuted}>
            This encounter doesn&apos;t exist anymore.
          </Text>
        ) : null}
      </Screen>
    );
  }

  const tint = scenarioTint(scenario.id);
  const palette = tints[tint];
  const { character } = scenario;
  const lessons = scenario.lessons ?? [];
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
        <LinearGradient colors={palette.gradient} style={{ paddingTop: insets.top + spacing.sm }}>
          <View style={styles.column}>
            <View style={styles.backRow}>
              <IconButton icon={ChevronLeft} accessibilityLabel="Back to encounters" onPress={goBack} variant="surface" iconSize={22} />
            </View>

            <Animated.View entering={FadeInDown.duration(motion.base)} style={styles.hero}>
              <View style={[styles.heroTile, { backgroundColor: colors.surface }]}>
                <ScenarioIcon name={scenario.icon} size={34} color={palette.fg} strokeWidth={2} />
              </View>
              <Text variant="title" accessibilityRole="header">
                {scenario.title}
              </Text>
              <View style={styles.placeRow}>
                <MapPin size={16} color={colors.inkMuted} />
                <Text variant="caption" color={colors.inkMuted} style={styles.flexShrink}>
                  {scenario.city} · {scenario.setting}
                </Text>
              </View>
              <View style={styles.pills}>
                <Pill label={scenario.difficulty} icon={Gauge} tone="neutral" />
                <Pill label={`${scenario.minutes} min`} icon={Clock} tone="neutral" />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(motion.base).delay(60)}>
              <Card style={styles.characterCard}>
                <CharacterAvatar char={character.avatar_char} size={60} tint={tint} ring />
                <View style={styles.flex}>
                  <Text variant="tiny" color={colors.inkMuted}>
                    YOU&apos;LL BE TALKING TO
                  </Text>
                  <Text variant="subheading">
                    {character.name_hanzi}{' '}
                    <Text variant="bodyMedium" color={colors.inkMuted}>
                      {character.name_pinyin}
                    </Text>
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {character.name_english} · {character.role}
                  </Text>
                </View>
              </Card>
            </Animated.View>
          </View>
        </LinearGradient>

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
                <Pill label="Optional" tone="neutral" />
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
  hero: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl },
  heroTile: {
    width: 68,
    height: 68,
    borderRadius: radii.card + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  pills: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  characterCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  sections: { gap: spacing.xxl, paddingTop: spacing.xs },
  section: { gap: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
