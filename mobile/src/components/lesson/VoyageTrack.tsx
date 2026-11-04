import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { art } from '@/components/art/palette';
import { Sailboat } from '@/components/art/Sailboat';
import { Seagull, type SeagullMood } from '@/components/art/Seagull';
import { Waves } from '@/components/art/Waves';
import { HULL, LOW_HULL } from '@/lib/voyage';
import { colors, motion, radii } from '@/theme/theme';

const HEIGHT = 46;
const BOAT = 40;
const GULL = 21;
const PORT_WIDTH = 30;

/** The island at the end of the voyage, with a flag. */
function Port() {
  return (
    <Svg width={PORT_WIDTH} height={28} viewBox="0 0 30 28">
      <Path d="M15 21 L15 4" stroke={art.outline} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15 4 L25 7.5 L15 11 Z" fill={art.lantern} stroke={art.outline} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M1 28 Q5 19 15 18.5 Q25 19 29 28 Z" fill={art.sand} stroke={art.outline} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * The lesson player's progress bar: the boat sails toward port as the questions are answered, with
 * the seagull on deck. In challenge mode it sits lower in the water and lists with every bit of
 * damage, and rocks hard on each hit. Holds still with Reduce Motion on.
 */
export function VoyageTrack({
  progress,
  hull,
  hits,
  sunk,
}: {
  /** 0 to 1: how far through the questions. */
  progress: number;
  /** Challenge mode: the hull left. null when it's off, and the boat never takes damage. */
  hull: number | null;
  /** Counts up on every hit, to rock the boat. */
  hits: number;
  /** The boat went down: only the sea is left. */
  sunk: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const rock = useSharedValue(0);
  const depth = useSharedValue(0);
  const jolt = useSharedValue(0);

  const travel = Math.max(width - BOAT - PORT_WIDTH, 0);
  const damage = hull === null ? 0 : (HULL - hull) / HULL;

  useEffect(() => {
    const target = progress * travel;
    x.set(reduceMotion ? target : withTiming(target, { duration: motion.slow * 2, easing: Easing.inOut(Easing.quad) }));
  }, [progress, reduceMotion, travel, x]);

  useEffect(() => {
    if (reduceMotion) return;
    rock.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, rock]);

  useEffect(() => {
    depth.set(reduceMotion ? damage : withTiming(damage, { duration: motion.slow }));
  }, [damage, depth, reduceMotion]);

  useEffect(() => {
    if (hits === 0 || reduceMotion) return;
    jolt.set(
      withSequence(
        withTiming(-1, { duration: 70 }),
        withTiming(1, { duration: 90 }),
        withTiming(-0.5, { duration: 90 }),
        withTiming(0, { duration: 120 }),
      ),
    );
  }, [hits, jolt, reduceMotion]);

  const boat = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() + jolt.get() * 3 },
      { translateY: -1.5 + rock.get() * 3 + depth.get() * 9 },
      { rotate: `${-4 + rock.get() * 8 + depth.get() * 10 + jolt.get() * 14}deg` },
    ],
  }));

  let mood: SeagullMood = 'idle';
  if (progress >= 1) mood = 'happy';
  else if (hull !== null && hull <= LOW_HULL) mood = 'worried';

  return (
    <View
      style={styles.track}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Voyage"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <LinearGradient colors={[art.skyTop, art.skyLow]} style={StyleSheet.absoluteFill} />
      <Waves color="#7DD3FC" height={20} amplitude={3} duration={-4800} />
      <View style={styles.port}>
        <Port />
      </View>
      {sunk ? null : (
        <Animated.View exiting={FadeOut.duration(motion.base)} style={[styles.boat, boat]}>
          <Sailboat size={BOAT} />
          <Seagull size={GULL} mood={mood} style={styles.gull} />
        </Animated.View>
      )}
      <Waves color={colors.sky500} height={11} amplitude={2.5} duration={3000} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, height: HEIGHT, borderRadius: radii.input, overflow: 'hidden', backgroundColor: art.skyLow },
  port: { position: 'absolute', right: 2, bottom: 6 },
  boat: { position: 'absolute', left: 0, bottom: 1, width: BOAT, height: BOAT },
  // Standing on deck, in front of the sails.
  gull: { position: 'absolute', left: 17, top: 8 },
});
