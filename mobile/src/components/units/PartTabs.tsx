import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import type { Part, PartId } from '@/content/lessons/types';
import { colors, motion, radii, spacing } from '@/theme/theme';

/** The Lessons tab's tabs, one per part of the course, with a highlight that slides to the selected one. */
export function PartTabs({
  parts,
  selected,
  onSelect,
  status,
}: {
  parts: Part[];
  selected: PartId;
  onSelect: (id: PartId) => void;
  /** For screen readers, e.g. "2 of 7 units done". */
  status: (id: PartId) => string;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const segment = width / parts.length;
  const index = Math.max(0, parts.findIndex((part) => part.id === selected));

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
          if (width === 0) offset.set((next / parts.length) * index);
          setWidth(next);
        }}>
        {width > 0 ? <Animated.View style={[styles.highlight, { width: segment }, highlight]} /> : null}
        {parts.map((part) => {
          const active = part.id === selected;
          return (
            <Pressable
              key={part.id}
              onPress={() => onSelect(part.id)}
              accessibilityRole="tab"
              accessibilityLabel={`${part.title}. ${status(part.id)}`}
              accessibilityState={{ selected: active }}
              hitSlop={{ top: spacing.xs, bottom: spacing.xs }}
              style={styles.tab}>
              <Text variant="label" color={active ? '#FFFFFF' : colors.inkMuted} numberOfLines={1}>
                {part.tab}
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
