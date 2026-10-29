import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import type { QuizSection, QuizSectionId } from '@/content/quizzes/types';
import { colors, motion, radii, spacing } from '@/theme/theme';

/** The Quiz tab's sections (Units, Mixed, Skills), with a highlight that slides to the selected one, like PartTabs. */
export function SectionTabs({
  sections,
  selected,
  onSelect,
}: {
  sections: QuizSection[];
  selected: QuizSectionId;
  onSelect: (id: QuizSectionId) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const segment = width / sections.length;
  const index = Math.max(0, sections.findIndex((section) => section.id === selected));

  useEffect(() => {
    offset.set(withTiming(index * segment, { duration: reduceMotion ? 0 : motion.base }));
  }, [index, offset, reduceMotion, segment]);

  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <View style={styles.bar}>
      <View
        style={styles.row}
        accessibilityRole="tablist"
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          // Jump straight to the right place on first layout instead of sliding in from the left.
          if (width === 0) offset.set((next / sections.length) * index);
          setWidth(next);
        }}>
        {width > 0 ? <Animated.View style={[styles.highlight, { width: segment }, highlight]} /> : null}
        {sections.map((section) => {
          const active = section.id === selected;
          return (
            <Pressable
              key={section.id}
              onPress={() => onSelect(section.id)}
              accessibilityRole="tab"
              accessibilityLabel={`${section.title}. ${section.summary}`}
              accessibilityState={{ selected: active }}
              hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
              style={styles.tab}>
              <Text variant="label" color={active ? '#FFFFFF' : colors.inkMuted} numberOfLines={1}>
                {section.tab}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    padding: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row' },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.full,
    backgroundColor: colors.sky600,
  },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
});
