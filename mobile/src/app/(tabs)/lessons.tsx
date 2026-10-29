import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pill } from '@/components/Pill';
import { LockedScenarioCard } from '@/components/ScenarioCard';
import { Text } from '@/components/Text';
import { ContinueCard } from '@/components/units/ContinueCard';
import { CourseNavBar } from '@/components/units/CourseNavBar';
import { PartTabs } from '@/components/units/PartTabs';
import { SearchResults } from '@/components/units/SearchResults';
import { UnitCard } from '@/components/units/UnitCard';
import { UnitMenu } from '@/components/units/UnitMenu';
import type { PartId, Unit, UnitLesson } from '@/content/lessons/types';
import { PARTS, UNITS } from '@/content/lessons/units';
import { continueTarget, isUnitDone, lessonsDone } from '@/lib/course';
import { isSearchable, searchCourse } from '@/lib/courseSearch';
import { useUnitProgress } from '@/lib/unitProgress';
import { unitIcon } from '@/lib/unitVisuals';
import { colors, layout, motion, spacing } from '@/theme/theme';

export default function LessonsScreen() {
  const progress = useUnitProgress();
  const target = continueTarget(UNITS, progress);
  const totalLessons = UNITS.reduce((sum, unit) => sum + unit.lessons.length, 0);
  // Counted from the content, so progress saved for a lesson that's since been removed doesn't count.
  const doneLessons = UNITS.reduce((sum, unit) => sum + lessonsDone(unit, progress), 0);

  const [pickedPart, setPickedPart] = useState<PartId | null>(null);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Opens on the part with the next lesson in it, until the learner picks a tab.
  const partId = pickedPart ?? (target.kind === 'complete' ? PARTS[0].id : target.unit.part);
  const part = PARTS.find((item) => item.id === partId) ?? PARTS[0];
  const searching = query.trim().length > 0;
  const results = isSearchable(query) ? searchCourse(UNITS, query) : null;

  const unitsIn = (id: PartId) => UNITS.filter((unit) => unit.part === id);
  const partStatus = (id: PartId) => {
    const units = unitsIn(id);
    return `${units.filter((unit) => isUnitDone(unit, progress)).length} of ${units.length} units done`;
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });
  const selectPart = (id: PartId) => {
    setMenuOpen(false);
    setPickedPart(id);
    scrollToTop();
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    scrollToTop();
  };
  const toggleMenu = () => {
    Keyboard.dismiss();
    setMenuOpen((open) => !open);
  };
  const closeMenu = () => setMenuOpen(false);

  const openUnit = (unit: Unit) => {
    Keyboard.dismiss();
    setMenuOpen(false);
    router.push({ pathname: '/unit/[unitId]', params: { unitId: unit.id } });
  };
  const openLesson = (unit: Unit, lesson: UnitLesson) => {
    Keyboard.dismiss();
    router.push({ pathname: '/unit/[unitId]/lesson/[lessonId]', params: { unitId: unit.id, lessonId: lesson.id } });
  };
  const openTarget = () => {
    if (target.kind === 'lesson') openLesson(target.unit, target.lesson);
    else if (target.kind === 'checkpoint') router.push({ pathname: '/unit/[unitId]/checkpoint', params: { unitId: target.unit.id } });
    else router.navigate('/');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.flex}>
        <Animated.View
          entering={FadeInDown.duration(motion.base)}
          onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}
          style={styles.navBar}>
          <View style={[styles.column, styles.nav]}>
            <View style={styles.titleRow}>
              <Text variant="title" accessibilityRole="header" style={styles.title}>
                Lessons
              </Text>
              <Pill label={`${doneLessons} of ${totalLessons} done`} tone="neutral" style={styles.progress} />
            </View>
            <CourseNavBar
              query={query}
              onChangeQuery={changeQuery}
              menuOpen={menuOpen}
              onToggleMenu={toggleMenu}
              onSearchFocus={closeMenu}
            />
            {searching ? null : <PartTabs parts={PARTS} selected={part.id} onSelect={selectPart} status={partStatus} />}
          </View>
        </Animated.View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.column, styles.content]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {searching ? (
            <SearchResults
              query={query}
              results={results}
              progress={progress}
              onOpenUnit={openUnit}
              onOpenLesson={openLesson}
            />
          ) : (
            <>
              <Animated.View entering={FadeInDown.duration(motion.base).delay(motion.stagger)}>
                <ContinueCard target={target} onOpen={openTarget} />
              </Animated.View>

              {/* Re-keyed so a new tab fades in. */}
              <Animated.View key={part.id} entering={FadeIn.duration(motion.base)} style={styles.part}>
                <View style={styles.partTitle}>
                  <Text variant="tiny" color={colors.inkMuted}>
                    PART {PARTS.indexOf(part) + 1} · {partStatus(part.id).toUpperCase()}
                  </Text>
                  <Text variant="heading" accessibilityRole="header">
                    {part.title}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {part.summary}
                  </Text>
                </View>
                <View style={styles.list}>
                  {unitsIn(part.id).map((unit) =>
                    unit.lessons.length > 0 ? (
                      <UnitCard
                        key={unit.id}
                        unit={unit}
                        number={UNITS.indexOf(unit) + 1}
                        progress={progress}
                        onPress={() => openUnit(unit)}
                      />
                    ) : (
                      <LockedScenarioCard key={unit.id} title={unit.title} icon={unitIcon(unit.icon)} />
                    ),
                  )}
                </View>
              </Animated.View>
            </>
          )}
        </ScrollView>

        {menuOpen ? (
          <UnitMenu
            parts={PARTS}
            units={UNITS}
            progress={progress}
            upNextId={target.kind === 'complete' ? undefined : target.unit.id}
            top={navHeight}
            onPick={openUnit}
            onClose={closeMenu}
          />
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
  nav: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { flexShrink: 1 },
  progress: { alignSelf: 'center' },
  content: { gap: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  part: { gap: spacing.md },
  partTitle: { gap: 2 },
  list: { gap: spacing.md },
});
