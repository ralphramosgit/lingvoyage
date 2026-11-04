import * as Haptics from 'expo-haptics';
import { type ComponentProps, type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { playSound } from '@/lib/sounds';

import { art } from './palette';

/** The app's pal: a chibi seagull in a sailor's neckerchief. */
export const PAL_NAME = 'Xiǎo Ōu';
export const PAL_HANZI = '小鸥';

export type SeagullMood = 'idle' | 'happy' | 'cheer' | 'worried';
export type SeagullPose = 'stand' | 'fly';

// Every layer draws in the same 120x120 box, so a wing's shoulder is the same percentage in any layer.
const VIEW = '0 0 120 120';
const RIGHT_SHOULDER = '66.7% 55%';
const LEFT_SHOULDER = '33.3% 55%';
const EYE_LINE = '50% 41%';

type LayerStyle = ComponentProps<typeof Animated.View>['style'];

function Layer({ size, children, style }: { size: number; children: ReactNode; style?: LayerStyle }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={size} viewBox={VIEW}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function Body({ pose }: { pose: SeagullPose }) {
  return (
    <>
      {/* Tail and feet sit behind the body. */}
      <Path d="M80 91 L100 97 Q93 104 82 101 Z" fill={art.gullTip} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
      {pose === 'stand' ? (
        <>
          <Path d="M42 108 Q45 100 51 100 Q57 100 59 108 Z" fill={art.feet} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M61 108 Q63 100 69 100 Q75 100 78 108 Z" fill={art.feet} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
        </>
      ) : (
        <>
          <Ellipse cx={53} cy={101} rx={4} ry={3} fill={art.feet} stroke={art.outline} strokeWidth={1.8} />
          <Ellipse cx={67} cy={101} rx={4} ry={3} fill={art.feet} stroke={art.outline} strokeWidth={1.8} />
        </>
      )}
      {/* Outlines first, then the fills on top, so head and body read as one round shape. */}
      <Ellipse cx={60} cy={80} rx={27} ry={21} fill={art.white} stroke={art.outline} strokeWidth={2.4} />
      <Circle cx={60} cy={50} r={29} fill={art.white} stroke={art.outline} strokeWidth={2.4} />
      <Ellipse cx={60} cy={80} rx={25.8} ry={19.8} fill={art.white} />
      <Ellipse cx={60} cy={89} rx={17} ry={9} fill={art.gullBelly} />
      <Path d="M57 22 C54 14 60 9 65 12 C61 14 61 18 63 21.5" fill={art.white} stroke={art.outline} strokeWidth={2} strokeLinecap="round" />
      {/* The neckerchief. */}
      <Path d="M39 71 Q60 83 81 71 L83 77 Q60 91 37 77 Z" fill={art.scarf} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M53 81 L60 95 L67 81 Z" fill={art.scarfLight} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={60} cy={81.5} r={3.6} fill={art.sun} stroke={art.outline} strokeWidth={1.8} />
    </>
  );
}

function Face({ mood }: { mood: SeagullMood }) {
  const open = mood === 'cheer';
  return (
    <>
      <Ellipse cx={41} cy={59} rx={4.6} ry={2.6} fill={art.blush} opacity={0.8} />
      <Ellipse cx={79} cy={59} rx={4.6} ry={2.6} fill={art.blush} opacity={0.8} />
      {mood === 'worried' ? (
        <>
          <Path d="M43 41 L52 38.5" stroke={art.outline} strokeWidth={2} strokeLinecap="round" />
          <Path d="M77 41 L68 38.5" stroke={art.outline} strokeWidth={2} strokeLinecap="round" />
          <Path d="M88 30 Q92 36 88 38 Q84 36 88 30 Z" fill="#9BD5F5" stroke={art.outline} strokeWidth={1.4} />
        </>
      ) : null}
      {open ? (
        <>
          <Path d="M54 59 Q60 71 66 59 Z" fill="#E86A7E" stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M52 55.5 Q60 51 68 55.5 Q64 60 60 60.5 Q56 60 52 55.5 Z" fill={art.beak} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
        </>
      ) : (
        <>
          <Path d="M52 56 Q60 52 68 56 Q66 62.5 60 63.5 Q54 62.5 52 56 Z" fill={art.beak} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M54.5 59.5 Q60 61.5 65.5 59.5" stroke={art.beakShade} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Circle cx={63.5} cy={61} r={1.3} fill="#F87171" />
        </>
      )}
    </>
  );
}

function Eyes({ mood }: { mood: SeagullMood }) {
  if (mood === 'happy' || mood === 'cheer') {
    return (
      <>
        <Path d="M44.5 51 Q49 44.5 53.5 51" stroke={art.eye} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        <Path d="M66.5 51 Q71 44.5 75.5 51" stroke={art.eye} strokeWidth={2.8} strokeLinecap="round" fill="none" />
      </>
    );
  }
  return (
    <>
      <Ellipse cx={49} cy={49} rx={4.4} ry={5.6} fill={art.eye} />
      <Ellipse cx={71} cy={49} rx={4.4} ry={5.6} fill={art.eye} />
      <Circle cx={50.6} cy={46.6} r={1.7} fill={art.white} />
      <Circle cx={72.6} cy={46.6} r={1.7} fill={art.white} />
      <Circle cx={47.6} cy={51.4} r={0.8} fill={art.white} />
      <Circle cx={69.6} cy={51.4} r={0.8} fill={art.white} />
    </>
  );
}

const FOLDED_RIGHT = 'M80 64 C92 66 98 82 92 96 C86 98 80 96 77 90 C76 80 76 70 80 64 Z';
const FOLDED_LEFT = 'M40 64 C28 66 22 82 28 96 C34 98 40 96 43 90 C44 80 44 70 40 64 Z';
const SPREAD_RIGHT = 'M78 62 C92 50 108 46 117 53 C111 57 113 61 105 65 C109 68 104 74 96 73 C90 76 84 74 78 72 Z';
const SPREAD_LEFT = 'M42 62 C28 50 12 46 3 53 C9 57 7 61 15 65 C11 68 16 74 24 73 C30 76 36 74 42 72 Z';

function Wing({ side, pose }: { side: 'left' | 'right'; pose: SeagullPose }) {
  const right = side === 'right';
  if (pose === 'fly') {
    return (
      <>
        <Path d={right ? SPREAD_RIGHT : SPREAD_LEFT} fill={art.gullWing} stroke={art.outline} strokeWidth={2.2} strokeLinejoin="round" />
        <Path
          d={right ? 'M104 50 Q113 50 116 53.5' : 'M16 50 Q7 50 4 53.5'}
          stroke={art.gullTip}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
      </>
    );
  }
  return (
    <>
      <Path d={right ? FOLDED_RIGHT : FOLDED_LEFT} fill={art.gullWing} stroke={art.outline} strokeWidth={2.2} strokeLinejoin="round" />
      <Path
        d={right ? 'M80 92.5 Q86 96.5 92 94.5' : 'M40 92.5 Q34 96.5 28 94.5'}
        stroke={art.gullTip}
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

export type SeagullProps = {
  size?: number;
  mood?: SeagullMood;
  pose?: SeagullPose;
  /** Waves its wing now and then (standing only). */
  wave?: boolean;
  /** Tapping makes it hop; also makes it a button. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** The animated seagull pal: bobs, blinks, flaps or waves. Holds still with Reduce Motion on. */
export function Seagull({ size = 96, mood = 'idle', pose = 'stand', wave = false, onPress, accessibilityLabel, style }: SeagullProps) {
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  const flap = useSharedValue(0);
  const hop = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const flying = pose === 'fly';
    bob.set(withRepeat(withTiming(1, { duration: flying ? 260 : 1300, easing: Easing.inOut(Easing.sin) }), -1, true));
    blink.set(
      withRepeat(
        withSequence(withDelay(2600, withTiming(0.12, { duration: 70 })), withTiming(1, { duration: 110 })),
        -1,
        false,
      ),
    );
    if (flying) {
      flap.set(withRepeat(withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else if (wave || mood === 'cheer') {
      flap.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: 180 }),
            withTiming(0.55, { duration: 160 }),
            withTiming(1, { duration: 160 }),
            withTiming(0, { duration: 220 }),
            withDelay(mood === 'cheer' ? 120 : 2200, withTiming(0, { duration: 1 })),
          ),
          -1,
          false,
        ),
      );
    } else {
      flap.set(0);
    }
  }, [blink, bob, flap, mood, pose, reduceMotion, wave]);

  const flying = pose === 'fly';
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (flying ? 3 : -2.5) * bob.get() * (size / 96) + hop.get() }],
  }));
  // Flying: both wings sweep from up (flap 0) to down (flap 1). Standing: only the right wing lifts, to wave.
  const rightWing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flying ? -24 + flap.get() * 42 : -flap.get() * 62}deg` }],
  }));
  const leftWing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flying ? 24 - flap.get() * 42 : mood === 'cheer' ? flap.get() * 62 : 0}deg` }],
  }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));

  const press = () => {
    if (!reduceMotion) {
      hop.set(withSequence(withTiming(-size * 0.16, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9 })));
    }
    playSound('chirp');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const roundEyes = mood === 'idle' || mood === 'worried';
  const bird = (
    <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
      {flying ? (
        <>
          <Layer size={size} style={[{ transformOrigin: LEFT_SHOULDER }, leftWing]}>
            <Wing side="left" pose="fly" />
          </Layer>
          <Layer size={size} style={[{ transformOrigin: RIGHT_SHOULDER }, rightWing]}>
            <Wing side="right" pose="fly" />
          </Layer>
        </>
      ) : null}
      <Layer size={size}>
        <Body pose={pose} />
        <Face mood={mood} />
      </Layer>
      <Layer size={size} style={roundEyes ? [{ transformOrigin: EYE_LINE }, eyes] : null}>
        <Eyes mood={mood} />
      </Layer>
      {flying ? null : (
        <>
          <Layer size={size} style={[{ transformOrigin: LEFT_SHOULDER }, leftWing]}>
            <Wing side="left" pose="stand" />
          </Layer>
          <Layer size={size} style={[{ transformOrigin: RIGHT_SHOULDER }, rightWing]}>
            <Wing side="right" pose="stand" />
          </Layer>
        </>
      )}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${PAL_NAME}, your seagull pal`}
        hitSlop={8}
        style={style}>
        {bird}
      </Pressable>
    );
  }
  return (
    <View
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}>
      {bird}
    </View>
  );
}
