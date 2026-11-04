import { type ComponentProps, type ReactNode, useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { ChibiLook } from '@/lib/characterLooks';

import { art } from './palette';

const VIEW = '0 0 100 100';
const STROKE = { stroke: art.outline, strokeWidth: 2, strokeLinejoin: 'round' as const };
const HAT_DARK = '#16263D';

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

function HairBack({ look }: { look: ChibiLook }) {
  const fill = { fill: look.hairColor, ...STROKE };
  switch (look.hair) {
    case 'bob':
      return <Path d="M19 46 C17 24 31 9 50 9 C69 9 83 24 81 46 C81 58 78 66 73 69 L27 69 C22 66 19 58 19 46 Z" {...fill} />;
    case 'long':
      return <Path d="M19 46 C17 24 31 9 50 9 C69 9 83 24 81 46 L84 86 C76 91 68 89 63 82 L37 82 C32 89 24 91 16 86 Z" {...fill} />;
    case 'ponytail':
      return (
        <>
          <Path d="M72 22 C91 22 95 47 86 66 C84 53 80 42 73 34 Z" {...fill} />
          <Circle cx={75} cy={24} r={3.2} fill={look.accent} {...STROKE} strokeWidth={1.6} />
        </>
      );
    case 'bun':
      return <Circle cx={50} cy={10.5} r={8.5} {...fill} />;
    default:
      return null;
  }
}

function HairFront({ look }: { look: ChibiLook }) {
  const fill = { fill: look.hairColor, ...STROKE };
  let d: string;
  switch (look.hair) {
    case 'short':
      d = 'M22.5 42 C20 21 34 9 50 9 C66 9 80 21 77.5 42 C75 35 72 31 67 29 C63 33 56 34 51 31 C48 34 41 35 37 32 C33 35 27 38 22.5 42 Z';
      break;
    case 'side':
      d = 'M22.5 42 C20 21 34 9 50 9 C66 9 80 21 77.5 42 C76 33 72 27 64 24 C56 30 42 31 33 27 C28 31 25 36 22.5 42 Z';
      break;
    case 'bun':
      d = 'M23.5 40 C22.5 22 35 12 50 12 C65 12 77.5 22 76.5 40 C72 30 62 24.5 50 24.5 C38 24.5 28 30 23.5 40 Z';
      break;
    default:
      d = 'M22.5 44 C20 21 34 9 50 9 C66 9 80 21 77.5 44 C74 36 71 30 66 27 C62 32 57 33 53 29.5 C49 33 43 34 38 31 C33 34 27 38 22.5 44 Z';
  }
  return (
    <>
      <Path d={d} {...fill} />
      <Path d="M33 19.5 Q39 14.5 46 14" stroke="rgba(255,255,255,0.32)" strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </>
  );
}

function Hat({ look }: { look: ChibiLook }) {
  switch (look.hat) {
    case 'cap':
      return (
        <>
          <Path d="M25 29 C24 10 76 10 75 29 Z" fill={look.outfit === 'polo' ? look.accent : look.color} {...STROKE} />
          <Path d="M21 28.5 Q50 35.5 79 28.5 Q77 33.5 50 34.5 Q23 33.5 21 28.5 Z" fill={HAT_DARK} {...STROKE} />
          <Circle cx={50} cy={21} r={3.4} fill={look.outfit === 'polo' ? look.color : art.sun} {...STROKE} strokeWidth={1.4} />
        </>
      );
    case 'chef':
      return (
        <>
          <Path d="M29 21 C19 18 21 4 33 6 C36 1 64 1 67 6 C79 4 81 18 71 21 Z" fill={art.white} {...STROKE} />
          <Path d="M30 20 L70 20 L70 28 Q50 31 30 28 Z" fill={art.white} {...STROKE} />
          <Path d="M43 8 L44.5 19 M57 8 L55.5 19" stroke={art.outline} strokeWidth={1.2} opacity={0.4} strokeLinecap="round" />
        </>
      );
    case 'bandana':
      return (
        <>
          <Path d="M76 28 L87 23 L85 33 Z" fill={look.accent} {...STROKE} strokeWidth={1.6} />
          <Path d="M22.5 33 C22 16 36 9 50 9 C64 9 78 16 77.5 33 C66 27 34 27 22.5 33 Z" fill={look.accent} {...STROKE} />
          {[
            [38, 19],
            [50, 15],
            [62, 19],
            [44, 25],
            [56, 25],
          ].map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.4} fill={art.white} />
          ))}
        </>
      );
    case 'bucket':
      return (
        <>
          <Path d="M29 25 C29 10 71 10 71 25 Z" fill="#F5E6C8" {...STROKE} />
          <Path d="M29 22.5 Q50 25 71 22.5 L71 25.5 Q50 28 29 25.5 Z" fill={look.accent} />
          <Path d="M16 27 Q50 19 84 27 Q82 33 50 31 Q18 33 16 27 Z" fill="#E8D3A8" {...STROKE} />
        </>
      );
    default:
      return null;
  }
}

function Outfit({ look }: { look: ChibiLook }) {
  const thin = { stroke: art.outline, strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (look.outfit) {
    case 'blazer':
    case 'suit':
      return (
        <>
          <Path d="M42 73 L50 88 L58 73 Z" fill={art.white} {...thin} />
          {look.outfit === 'suit' ? (
            <Path d="M48 75 L52 75 L53.5 86 L50 90 L46.5 86 Z" fill={look.accent} {...thin} />
          ) : (
            <Path d="M42.5 73 Q50 79 57.5 73 L56 81 L50 77.5 L44 81 Z" fill={look.accent} {...thin} />
          )}
          <Path d="M41 73.5 L47.5 89 L42 93 M59 73.5 L52.5 89 L58 93" fill="none" {...thin} />
          <Rect x={63} y={84} width={11} height={5} rx={1.5} fill={art.sun} {...thin} strokeWidth={1.2} />
        </>
      );
    case 'uniform':
      return (
        <>
          <Path d="M40 73 Q50 80 60 73 L61 78 Q50 85 39 78 Z" fill={look.color} {...thin} />
          <Path d="M39.5 78 Q50 85 60.5 78" stroke={look.accent} strokeWidth={1.6} fill="none" />
          <Path d="M21 85 L34 79.5 M79 85 L66 79.5" stroke={look.accent} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={50} cy={89} r={1.6} fill={art.sun} />
          <Circle cx={50} cy={96} r={1.6} fill={art.sun} />
        </>
      );
    case 'apron':
      return (
        <>
          <Path d="M44 73 L50 78.5 L56 73" fill="none" {...thin} />
          <Path d="M36 80 L42 73.5 M64 80 L58 73.5" stroke={look.accent} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M32 84 Q32 80 36 80 L64 80 Q68 80 68 84 L68 101 L32 101 Z" fill={look.accent} {...STROKE} />
          <Path d="M43 89 L57 89 L57 95 L43 95 Z" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.4} />
        </>
      );
    case 'chef':
      return (
        <>
          <Path d="M43 73 Q50 78 57 73 L55 79 Q50 81 45 79 Z" fill={look.accent} {...thin} />
          {[85, 93].map((cy) => (
            <G key={cy}>
              <Circle cx={43} cy={cy} r={1.4} fill={art.outline} />
              <Circle cx={57} cy={cy} r={1.4} fill={art.outline} />
            </G>
          ))}
        </>
      );
    case 'vest':
      return (
        <>
          <Path d="M15 100 C15 86 25 76 40 74 L47 100 Z" fill="#1F2937" {...thin} />
          <Path d="M85 100 C85 86 75 76 60 74 L53 100 Z" fill="#1F2937" {...thin} />
          <Path d="M44 74.5 L50 77.5 L44 80.5 Z M56 74.5 L50 77.5 L56 80.5 Z" fill="#E5484D" {...thin} strokeWidth={1.2} />
        </>
      );
    case 'polo':
      return (
        <>
          <Path d="M41 73 L50 79 L46 83 Z M59 73 L50 79 L54 83 Z" fill={art.white} {...thin} />
          <Path d="M50 79 L50 91" {...thin} strokeWidth={1.2} />
          <Path d="M22 92 L34 92" stroke={look.accent} strokeWidth={3} strokeLinecap="round" />
        </>
      );
    case 'shirt':
      return (
        <>
          <Path d="M40.5 73 L50 79.5 L45 85.5 Z M59.5 73 L50 79.5 L55 85.5 Z" fill={art.white} {...thin} />
          <Path d="M47.6 79.2 L52.4 79.2 L53.2 82.6 L46.8 82.6 Z" fill={look.accent} {...thin} strokeWidth={1.2} />
          <Path d="M47 82.6 L53 82.6 L55.5 96 L50 101 L44.5 96 Z" fill={look.accent} {...thin} strokeWidth={1.2} />
          <Path d="M46.5 89 L53.5 86.5 M45.7 93.5 L54.3 90.5" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} />
          <Rect x={62} y={86} width={10} height={8} rx={1.5} fill="none" {...thin} strokeWidth={1.2} />
          <Path d="M64.5 87 L64.5 82.5" stroke={look.accent} strokeWidth={1.8} strokeLinecap="round" />
        </>
      );
    case 'tee':
      return (
        <>
          <Path d="M41 73.5 Q50 81 59 73.5" fill="none" {...thin} strokeWidth={1.8} />
          <Circle cx={45.2} cy={85.2} r={2.6} fill={art.eye} />
          <Circle cx={54.8} cy={85.2} r={2.6} fill={art.eye} />
          <Circle cx={50} cy={90} r={7} fill={art.white} {...thin} strokeWidth={1.2} />
          <Ellipse cx={47.3} cy={89.6} rx={1.6} ry={2.2} fill={art.eye} />
          <Ellipse cx={52.7} cy={89.6} rx={1.6} ry={2.2} fill={art.eye} />
          <Ellipse cx={50} cy={93} rx={1.2} ry={0.8} fill={art.eye} />
          <Path d="M23 89 L27 98 M77 89 L73 98" stroke="rgba(0,0,0,0.18)" strokeWidth={1.4} strokeLinecap="round" />
        </>
      );
    case 'guide':
      return (
        <>
          <Path d="M43 73 L50 78 L57 73" fill="none" {...thin} />
          <Path d="M42 74 L47 89 M58 74 L53 89" stroke={look.accent} strokeWidth={2} strokeLinecap="round" />
          <Rect x={44.5} y={88} width={11} height={8} rx={1.5} fill={art.white} {...thin} strokeWidth={1.2} />
        </>
      );
    default:
      return (
        <>
          <Path d="M33 77 Q50 88 67 77 Q61 72 50 72 Q39 72 33 77 Z" fill="rgba(0,0,0,0.15)" {...thin} />
          <Path d="M46 81 L45 91 M54 81 L55 91" stroke={art.white} strokeWidth={1.6} strokeLinecap="round" />
        </>
      );
  }
}

/** Neck, shoulders, outfit, head, hair and hat: everything but the eyes and mouth, which move. */
function Base({ look }: { look: ChibiLook }) {
  return (
    <>
      <HairBack look={look} />
      <Rect x={44} y={60} width={12} height={16} rx={3} fill={look.skin} {...STROKE} />
      <Path d="M14 101 C14 85 25 75 40 73 L60 73 C75 75 86 85 86 101 Z" fill={look.color} {...STROKE} />
      <Outfit look={look} />
      <Circle cx={24.5} cy={46} r={4.6} fill={look.skin} {...STROKE} />
      <Circle cx={75.5} cy={46} r={4.6} fill={look.skin} {...STROKE} />
      <Path d="M24 42 C24 23 36 13 50 13 C64 13 76 23 76 42 C76 56 66 67 50 67 C34 67 24 56 24 42 Z" fill={look.skin} {...STROKE} />
      <Ellipse cx={33} cy={54} rx={4} ry={2.3} fill={art.blush} opacity={0.65} />
      <Ellipse cx={67} cy={54} rx={4} ry={2.3} fill={art.blush} opacity={0.65} />
      <Path d="M49.6 50.5 Q50.8 51.8 49.6 53" stroke="#C98468" strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Path
        d="M35.5 38.5 Q40 37 44.5 38.5 M55.5 38.5 Q60 37 64.5 38.5"
        stroke={look.elder ? '#6B7079' : look.hairColor}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      {look.elder ? (
        <Path d="M31.5 46.5 L29 47.6 M68.5 46.5 L71 47.6" stroke={art.outline} strokeWidth={0.9} opacity={0.45} strokeLinecap="round" />
      ) : null}
      <HairFront look={look} />
      <Hat look={look} />
    </>
  );
}

function Eyes() {
  return (
    <>
      <Ellipse cx={40} cy={46} rx={3.5} ry={4.6} fill={art.eye} />
      <Ellipse cx={60} cy={46} rx={3.5} ry={4.6} fill={art.eye} />
      <Circle cx={41.3} cy={44.2} r={1.4} fill={art.white} />
      <Circle cx={61.3} cy={44.2} r={1.4} fill={art.white} />
    </>
  );
}

function Glasses() {
  return (
    <>
      <Circle cx={40} cy={46} r={6.4} stroke="#2B3440" strokeWidth={1.8} fill="rgba(255,255,255,0.12)" />
      <Circle cx={60} cy={46} r={6.4} stroke="#2B3440" strokeWidth={1.8} fill="rgba(255,255,255,0.12)" />
      <Path d="M46.4 45.5 Q50 44 53.6 45.5 M33.6 45 L29.5 44 M66.4 45 L70.5 44" stroke="#2B3440" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </>
  );
}

export type ChibiProps = {
  look: ChibiLook;
  size?: number;
  /** Moves the mouth, e.g. while the character's line plays. */
  talking?: boolean;
  /** Idle bob and blinks. Off for small static uses. */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A scene's character as a chibi bust: head, shoulders and work outfit. */
export function Chibi({ look, size = 96, talking = false, animated = true, style }: ChibiProps) {
  const reduceMotion = useReducedMotion();
  const still = reduceMotion || !animated;
  const bob = useSharedValue(0);
  const blink = useSharedValue(1);
  const mouth = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    bob.set(withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true));
    blink.set(
      withRepeat(withSequence(withDelay(3400, withTiming(0.1, { duration: 70 })), withTiming(1, { duration: 110 })), -1, false),
    );
  }, [blink, bob, still]);

  // The mouth moves while talking even when the idle animation is off (small avatars in the chat).
  useEffect(() => {
    if (talking && !reduceMotion) {
      mouth.set(
        withRepeat(
          withSequence(withTiming(1, { duration: 120 }), withTiming(0.35, { duration: 110 }), withTiming(0.85, { duration: 140 }), withTiming(0.2, { duration: 120 })),
          -1,
          false,
        ),
      );
    } else {
      mouth.set(withTiming(talking ? 0.7 : 0, { duration: 120 }));
    }
  }, [mouth, reduceMotion, talking]);

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -1.2 * bob.get() * (size / 96) }] }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));
  const open = useAnimatedStyle(() => ({ opacity: mouth.get() > 0.05 ? 1 : 0, transform: [{ scaleY: Math.max(mouth.get(), 0.15) }] }));
  const smile = useAnimatedStyle(() => ({ opacity: mouth.get() > 0.05 ? 0 : 1 }));

  return (
    <View style={[{ width: size, height: size }, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        <Layer size={size}>
          <Base look={look} />
        </Layer>
        <Layer size={size} style={[{ transformOrigin: '50% 46%' }, eyes]}>
          <Eyes />
        </Layer>
        <Layer size={size} style={smile}>
          <Path d="M45.5 57 Q50 60.5 54.5 57" stroke={art.outline} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        </Layer>
        <Layer size={size} style={[{ transformOrigin: '50% 56.5%' }, open]}>
          <Path d="M45.5 56.5 Q50 56 54.5 56.5 Q54 62.5 50 62.8 Q46 62.5 45.5 56.5 Z" fill="#9F3A4C" stroke={art.outline} strokeWidth={1.4} />
          <Ellipse cx={50} cy={61} rx={2.4} ry={1.2} fill="#F28B9B" />
        </Layer>
        {look.glasses ? (
          <Layer size={size}>
            <Glasses />
          </Layer>
        ) : null}
      </Animated.View>
    </View>
  );
}
