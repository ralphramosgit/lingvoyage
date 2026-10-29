import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { shuffled } from '@/lib/lessons';
import { colors, motion, radii, spacing } from '@/theme/theme';
import type { KeyPhrase } from '@/types/api';

type ItemState = 'idle' | 'selected' | 'wrong' | 'matched';

const ITEM_STYLES: Record<ItemState, { bg: string; border: string }> = {
  idle: { bg: colors.surface, border: colors.line },
  selected: { bg: colors.sky50, border: colors.sky500 },
  wrong: { bg: '#FFFBEB', border: '#FCE7A5' },
  matched: { bg: '#F0FDF4', border: colors.success },
};

/** How long a wrong pair stays marked before it unselects. */
const WRONG_MS = 600;

type Side = 'zh' | 'en';

/**
 * "Match the pairs": Chinese on the left, English on the right, both shuffled. Tap one on each
 * side. A right pair locks, a wrong pair shakes and unselects.
 */
export function MatchAnswer({
  pairs,
  showPinyin,
  onMiss,
  onComplete,
}: {
  pairs: KeyPhrase[];
  showPinyin: boolean;
  onMiss: () => void;
  onComplete: () => void;
}) {
  const [left] = useState(() => shuffled(pairs.map((_, index) => index)));
  const [right] = useState(() => shuffled(pairs.map((_, index) => index)));
  const [matched, setMatched] = useState<number[]>([]);
  const [selected, setSelected] = useState<{ side: Side; index: number } | null>(null);
  const [wrong, setWrong] = useState<{ zh: number; en: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const tryPair = (zh: number, en: number) => {
    if (zh === en) {
      const next = [...matched, zh];
      setMatched(next);
      setSelected(null);
      void Haptics.selectionAsync();
      AccessibilityInfo.announceForAccessibility(`Matched: ${pairs[zh].hanzi}, ${pairs[zh].english}`);
      if (next.length === pairs.length) onComplete();
      return;
    }
    setWrong({ zh, en });
    onMiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility('Not a pair. Try again.');
    timer.current = setTimeout(() => {
      setWrong(null);
      setSelected(null);
    }, WRONG_MS);
  };

  const pick = (side: Side, index: number) => {
    if (wrong || matched.includes(index)) return;
    if (!selected || selected.side === side) {
      setSelected(selected?.side === side && selected.index === index ? null : { side, index });
      return;
    }
    if (side === 'zh') tryPair(index, selected.index);
    else tryPair(selected.index, index);
  };

  const stateOf = (side: Side, index: number): ItemState => {
    if (matched.includes(index)) return 'matched';
    if (wrong && wrong[side] === index) return 'wrong';
    if (selected?.side === side && selected.index === index) return 'selected';
    return 'idle';
  };

  return (
    <View style={styles.columns}>
      <View style={styles.column}>
        {left.map((pairIndex, position) => (
          <MatchItem
            key={pairIndex}
            state={stateOf('zh', pairIndex)}
            delay={position * motion.stagger}
            label={showPinyin ? `${pairs[pairIndex].hanzi}, ${pairs[pairIndex].pinyin}` : pairs[pairIndex].hanzi}
            onPress={() => pick('zh', pairIndex)}>
            <Text variant="hanzi" align="center">
              {pairs[pairIndex].hanzi}
            </Text>
            {showPinyin ? (
              <Text variant="tiny" color={colors.inkMuted} align="center">
                {pairs[pairIndex].pinyin}
              </Text>
            ) : null}
          </MatchItem>
        ))}
      </View>
      <View style={styles.column}>
        {right.map((pairIndex, position) => (
          <MatchItem
            key={pairIndex}
            state={stateOf('en', pairIndex)}
            delay={position * motion.stagger}
            label={pairs[pairIndex].english}
            onPress={() => pick('en', pairIndex)}>
            <Text variant="bodyStrong" align="center">
              {pairs[pairIndex].english}
            </Text>
          </MatchItem>
        ))}
      </View>
    </View>
  );
}

function MatchItem({
  state,
  delay,
  label,
  onPress,
  children,
}: {
  state: ItemState;
  delay: number;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const offset = useSharedValue(0);

  useEffect(() => {
    if (state !== 'wrong') return;
    offset.set(withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }), withTiming(-4, { duration: 50 }), withTiming(0, { duration: 50 })));
  }, [state, offset]);

  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const palette = ITEM_STYLES[state];
  const done = state === 'matched';

  return (
    <Animated.View entering={FadeInDown.duration(motion.base).delay(delay)} style={shake}>
      <PressableScale
        onPress={onPress}
        disabled={done}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={done ? undefined : 'Pairs it with an item in the other column'}
        accessibilityState={{ selected: state === 'selected', disabled: done }}
        style={[styles.item, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <View style={[styles.itemText, done ? styles.faded : null]}>{children}</View>
        {done ? (
          <View style={styles.mark}>
            <Check size={12} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1, gap: spacing.md },
  item: {
    minHeight: 64,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { alignItems: 'center' },
  faded: { opacity: 0.6 },
  mark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
