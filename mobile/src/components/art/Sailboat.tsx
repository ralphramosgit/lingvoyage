import Svg, { G, Path } from 'react-native-svg';

import { art } from './palette';

/** The logo's boat (yellow sails, white hull) in a 60x60 box, for drawing inside another SVG. */
export function SailboatShape({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path d="M29 4 L29 41" stroke={art.outline} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M29 4 L38.5 7 L29 10 Z" fill={art.scarf} stroke={art.outline} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M27 7 L27 38 L8 38 Q14 20 27 7 Z" fill={art.sail} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M31.5 10 Q43 22 48 37 L31.5 37 Z" fill={art.sail} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M5 41 Q30 45 55 41 L49 51 Q30 54 11 51 Z" fill={art.white} stroke={art.outline} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M9.5 46 Q30 49 50.5 46" stroke={art.seaDeep} strokeWidth={2} strokeLinecap="round" fill="none" />
    </G>
  );
}

/** The boat on its own, e.g. the tab bar's marker. */
export function Sailboat({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <SailboatShape />
    </Svg>
  );
}
