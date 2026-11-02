import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Sailboat } from '@/components/art/Sailboat';
import { colors, fonts, motion } from '@/theme/theme';

import { Text } from './Text';

const BOAT = 30;
const SEA = 12;
const SAIL_MS = 560;

function seaPath(width: number): string {
  const period = 28;
  let d = `M0 ${SEA / 2}`;
  for (let x = 0; x < width + period; x += period) d += ` Q${x + period / 4} 1.5 ${x + period / 2} ${SEA / 2} T${x + period} ${SEA / 2}`;
  return `${d} L${width + period} ${SEA} L0 ${SEA} Z`;
}

/** The tab bar: a strip of sea along its top, and a little sailboat that sails to the tab you pick. */
export function VoyageTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const placed = useRef(false);
  const x = useSharedValue(0);
  const rock = useSharedValue(0);
  const tabWidth = width / state.routes.length;

  useEffect(() => {
    if (width === 0) return;
    const target = tabWidth * state.index + tabWidth / 2 - BOAT / 2;
    if (!placed.current || reduceMotion) {
      placed.current = true;
      x.set(target);
      return;
    }
    x.set(withTiming(target, { duration: SAIL_MS, easing: Easing.inOut(Easing.cubic) }));
    // Leans into the turn, then settles with a little bob.
    rock.set(
      withSequence(
        withTiming(1, { duration: SAIL_MS * 0.3 }),
        withTiming(-0.6, { duration: SAIL_MS * 0.45 }),
        withTiming(0.25, { duration: motion.base }),
        withTiming(0, { duration: motion.base }),
      ),
    );
  }, [reduceMotion, rock, state.index, tabWidth, width, x]);

  const boatStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: -Math.abs(rock.get()) * 2 }, { rotate: `${rock.get() * 9}deg` }],
  }));

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={SEA} style={styles.sea}>
            <Path d={seaPath(width)} fill={colors.sky100} />
          </Svg>
          <Animated.View pointerEvents="none" style={[styles.boat, boatStyle]}>
            <Sailboat size={BOAT} />
          </Animated.View>
        </>
      ) : null}

      <View style={styles.tabs} role="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const color = focused ? colors.sky700 : colors.inkMuted;
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              navigateToTab(route.key);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.tab}>
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              {/* 11, not 12, so "Encounters" fits a fifth of a 360pt-wide phone without being cut off. */}
              <Text style={[styles.label, { color, fontFamily: focused ? fonts.bold : fonts.semibold }]} numberOfLines={1}>
                {label}
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
    backgroundColor: colors.surface,
    paddingTop: SEA,
    // The boat's sail rises above the bar.
    overflow: 'visible',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  sea: { position: 'absolute', top: 0, left: 0 },
  boat: { position: 'absolute', top: SEA - BOAT + 2, left: 0 },
  tabs: { flexDirection: 'row', height: 56 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 2 },
  label: { fontSize: 11, lineHeight: 14 },
});
