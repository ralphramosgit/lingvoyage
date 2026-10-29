import { ChevronDown, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { colors, fonts, layout, motion, radii, spacing } from '@/theme/theme';

/** The top of the Lessons tab: search the course, or open the list of units to jump to one. */
export function CourseNavBar({
  query,
  onChangeQuery,
  menuOpen,
  onToggleMenu,
  onSearchFocus,
}: {
  query: string;
  onChangeQuery: (query: string) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSearchFocus: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.set(withTiming(menuOpen ? 180 : 0, { duration: reduceMotion ? 0 : motion.base }));
  }, [menuOpen, reduceMotion, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <View style={styles.row}>
      <View style={[styles.search, focused ? styles.searchFocused : null]}>
        <Search size={18} color={focused ? colors.sky600 : colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search lessons"
          placeholderTextColor="#8A9BAE"
          selectionColor={colors.sky600}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel="Search lessons and words"
          accessibilityHint="In English, pinyin or characters"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onFocus={() => {
            setFocused(true);
            onSearchFocus();
          }}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        {query ? (
          <IconButton icon={X} size={32} iconSize={16} accessibilityLabel="Clear search" onPress={() => onChangeQuery('')} />
        ) : null}
      </View>

      <PressableScale
        onPress={onToggleMenu}
        accessibilityRole="button"
        accessibilityLabel="Units"
        accessibilityHint={menuOpen ? 'Closes the list of units' : 'Opens a list of every unit to jump to'}
        accessibilityState={{ expanded: menuOpen }}
        style={[styles.menuButton, menuOpen ? styles.menuButtonOpen : null]}>
        <Text variant="label" color={colors.sky700}>
          Units
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={16} color={colors.sky700} strokeWidth={2.4} />
        </Animated.View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.input,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  searchFocused: { borderColor: colors.sky500, backgroundColor: colors.sky50 },
  input: {
    flex: 1,
    minHeight: 40,
    paddingVertical: spacing.sm,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1.5,
    borderColor: colors.sky100,
    backgroundColor: colors.sky50,
  },
  menuButtonOpen: { borderColor: colors.sky500 },
});
