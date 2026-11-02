import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuizCard } from '@/components/quiz/QuizCard';
import { QuizNavBar } from '@/components/quiz/QuizNavBar';
import { QuizUnitMenu } from '@/components/quiz/QuizUnitMenu';
import { LockedScenarioCard } from '@/components/ScenarioCard';
import { Text } from '@/components/Text';
import type { Unit } from '@/content/lessons/types';
import { findUnit, PARTS, UNITS } from '@/content/lessons/units';
import { QUIZ_SECTIONS, quizzesIn, readyQuizzes, unitQuizzes } from '@/content/quizzes/quizzes';
import type { Quiz, QuizSection, QuizSectionId } from '@/content/quizzes/types';
import { cityName, useCities } from '@/hooks/useCities';
import { usePack } from '@/hooks/usePack';
import { localQuizzes } from '@/lib/localCourse';
import { quizIcon } from '@/lib/quizVisuals';
import { type UnitProgress, useUnitProgress } from '@/lib/unitProgress';
import { colors, layout, motion, radii, spacing } from '@/theme/theme';

/** The unit last opened on the Lessons tab, or the first one with lessons. */
function startingUnit(progress: UnitProgress): Unit {
  const open = UNITS.filter((unit) => unit.lessons.length > 0);
  return open.find((unit) => unit.id === progress.lastUnitId) ?? open[0] ?? UNITS[0];
}

function quizCount(ready: number) {
  if (ready === 0) return 'QUIZZES COMING SOON';
  return ready === 1 ? '1 QUIZ' : `${ready} QUIZZES`;
}

export default function QuizScreen() {
  const progress = useUnitProgress();
  const [section, setSection] = useState<QuizSectionId>('units');
  const [pickedUnitId, setPickedUnitId] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { cities } = useCities();
  const cityPack = usePack();

  // The learner's city gets its own section (issue #40) once its pack has quizzes, or while a first
  // build is really writing them.
  const local = localQuizzes(cityPack.pack);
  const writingLocal = cityPack.building && cityPack.status?.ready_pack_id === null;
  const name = cityPack.city ? cityName(cities, cityPack.city) : '';
  const localSection: QuizSection | null =
    cityPack.city && (local.length > 0 || writingLocal)
      ? { id: 'local', tab: name, title: `${name} quizzes`, summary: `Real places, dishes and prices in ${name}.` }
      : null;
  const sections = localSection ? [...QUIZ_SECTIONS, localSection] : QUIZ_SECTIONS;
  // Back to Units if the city section goes away (a new destination without quizzes).
  const shown = sections.some((item) => item.id === section) ? section : 'units';

  // Follows the Lessons tab until the learner picks a unit here.
  const unit = findUnit(pickedUnitId) ?? startingUnit(progress);
  const index = UNITS.indexOf(unit);
  const current = sections.find((item) => item.id === shown) ?? QUIZ_SECTIONS[0];
  let quizzes = quizzesIn(shown);
  if (shown === 'units') quizzes = unitQuizzes(unit.id);
  else if (shown === 'local') quizzes = local;
  const ready = readyQuizzes(unit.id);

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });
  const selectSection = (id: QuizSectionId) => {
    setMenuOpen(false);
    setSection(id);
    scrollToTop();
  };
  const pickUnit = (next: Unit) => {
    setMenuOpen(false);
    setPickedUnitId(next.id);
    scrollToTop();
  };
  const closeMenu = () => setMenuOpen(false);

  const openQuiz = (quiz: Quiz) => {
    setMenuOpen(false);
    router.push({ pathname: '/quiz/[quizId]', params: { quizId: quiz.id } });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.flex}>
        <Animated.View
          entering={FadeInDown.duration(motion.base)}
          onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}
          style={styles.navBar}>
          <View style={styles.column}>
            <QuizNavBar
              sections={sections}
              section={shown}
              onSelectSection={selectSection}
              unit={unit}
              unitNumber={index + 1}
              menuOpen={menuOpen}
              onToggleMenu={() => setMenuOpen((open) => !open)}
              onPrevious={index > 0 ? () => pickUnit(UNITS[index - 1]) : undefined}
              onNext={index < UNITS.length - 1 ? () => pickUnit(UNITS[index + 1]) : undefined}
            />
          </View>
        </Animated.View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.column, styles.content]}
          showsVerticalScrollIndicator={false}>
          {/* Re-keyed so a new section or unit fades in. */}
          <Animated.View key={shown === 'units' ? unit.id : shown} entering={FadeIn.duration(motion.base)} style={styles.group}>
            <View style={styles.groupTitle}>
              {shown === 'units' ? (
                <>
                  <Text variant="tiny" color={colors.inkMuted}>
                    UNIT {index + 1} · {quizCount(ready)}
                  </Text>
                  <Text variant="heading" accessibilityRole="header">
                    {unit.title}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {unit.summary}
                  </Text>
                </>
              ) : (
                <>
                  <Text variant="heading" accessibilityRole="header">
                    {current.title}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {current.summary}
                  </Text>
                </>
              )}
            </View>

            {quizzes.length > 0 ? (
              <View style={styles.list}>
                {quizzes.map((quiz) =>
                  quiz.exercises.length > 0 ? (
                    <QuizCard key={quiz.id} quiz={quiz} onPress={() => openQuiz(quiz)} />
                  ) : (
                    <LockedScenarioCard key={quiz.id} title={quiz.title} icon={quizIcon(quiz.icon)} />
                  ),
                )}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text variant="body" align="center" color={colors.inkMuted}>
                  {shown === 'local'
                    ? `Your ${name} quizzes are being written from what the agent finds.`
                    : `Quizzes for ${unit.title} come once its lessons are ready.`}
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {menuOpen && shown === 'units' ? (
          <QuizUnitMenu parts={PARTS} units={UNITS} selectedId={unit.id} top={navHeight} onPick={pickUnit} onClose={closeMenu} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.screenPadding },
  navBar: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line },
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  group: { gap: spacing.md },
  groupTitle: { gap: 2 },
  list: { gap: spacing.md },
  empty: {
    padding: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
});
