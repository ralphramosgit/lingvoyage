import type { ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { art } from './palette';
import { SailboatShape } from './Sailboat';

// Each city's landmark, drawn in a 48x48 circle for its map pin and its sheet (issue #66).

const line = { stroke: art.outline, strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { ...line, strokeWidth: 1.1 };

/** A flower or blossom: petals around a gold middle. */
function Flower({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const petals = [0, 1, 2, 3, 4].map((index) => {
    const angle = (index * 2 * Math.PI) / 5 - Math.PI / 2;
    return <Circle key={index} cx={x + Math.cos(angle) * r} cy={y + Math.sin(angle) * r} r={r * 0.75} fill={color} />;
  });
  return (
    <G>
      {petals}
      <Circle cx={x} cy={y} r={r * 0.5} fill={art.gold} />
    </G>
  );
}

function Beijing() {
  // The Temple of Heaven: three blue roofs on red drums, on white terraces.
  const roof = '#2B6CB0';
  return (
    <>
      <Rect width={48} height={48} fill={art.skyTop} />
      <Circle cx={39} cy={10} r={4} fill={art.sun} />
      <Rect y={40} width={48} height={8} fill={art.grass} />
      <Rect x={7} y={38} width={34} height={4} rx={1} fill={art.white} {...thin} />
      <Rect x={11} y={34.5} width={26} height={3.5} rx={1} fill={art.white} {...thin} />
      <Rect x={15} y={28} width={18} height={6.5} fill={art.lantern} {...thin} />
      <Path d="M19 29 L19 34 M24 29 L24 34 M29 29 L29 34" stroke={art.lanternDark} strokeWidth={1} />
      <Path d="M8 29.5 Q16 25 24 22 Q32 25 40 29.5 Q24 31.5 8 29.5 Z" fill={roof} {...line} />
      <Rect x={18} y={20.5} width={12} height={4.5} fill={art.lantern} {...thin} />
      <Path d="M11 22 Q18 18.5 24 15.5 Q30 18.5 37 22 Q24 24 11 22 Z" fill={roof} {...line} />
      <Rect x={20} y={14} width={8} height={4} fill={art.lantern} {...thin} />
      <Path d="M14 15.5 Q20 12 24 8.5 Q28 12 34 15.5 Q24 17 14 15.5 Z" fill={roof} {...line} />
      <Circle cx={24} cy={7.5} r={1.6} fill={art.gold} {...thin} />
    </>
  );
}

function Chengdu() {
  // A giant panda among the bamboo.
  const black = '#1F2933';
  return (
    <>
      <Rect width={48} height={48} fill="#D9F2DF" />
      <Rect x={2} y={-2} width={4} height={52} fill={art.leaf} />
      <Rect x={42} y={-2} width={4} height={52} fill={art.leaf} />
      <Path d="M2 12 L6 12 M2 27 L6 27 M2 41 L6 41 M42 9 L46 9 M42 24 L46 24 M42 38 L46 38" stroke={art.leafDark} strokeWidth={1.2} />
      <Path d="M6 20 Q12 16 13 10 Q8 13 6 20 Z" fill={art.leafDark} />
      <Path d="M42 32 Q36 29 34.5 23 Q40 26 42 32 Z" fill={art.leafDark} />
      <Circle cx={13.5} cy={15} r={5.5} fill={black} {...line} />
      <Circle cx={34.5} cy={15} r={5.5} fill={black} {...line} />
      <Ellipse cx={24} cy={27.5} rx={14.5} ry={13} fill={art.white} {...line} />
      <Ellipse cx={18} cy={25.5} rx={3.8} ry={5} fill={black} transform="rotate(-28 18 25.5)" />
      <Ellipse cx={30} cy={25.5} rx={3.8} ry={5} fill={black} transform="rotate(28 30 25.5)" />
      <Circle cx={18.6} cy={24.6} r={1.4} fill={art.white} />
      <Circle cx={29.4} cy={24.6} r={1.4} fill={art.white} />
      <Ellipse cx={24} cy={30.8} rx={2.2} ry={1.5} fill={black} />
      <Path d="M21.5 33.2 Q24 35.6 26.5 33.2" stroke={black} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <Circle cx={14.5} cy={31.5} r={2} fill={art.blush} opacity={0.8} />
      <Circle cx={33.5} cy={31.5} r={2} fill={art.blush} opacity={0.8} />
    </>
  );
}

function Chongqing() {
  // Hongyadong at night: stilt houses stacked up the cliff, lit gold, over the Jialing River.
  const wood = '#6B3F2A';
  const roof = '#2A1E1A';
  const glow = '#FFD166';
  const night = { ...thin, stroke: '#101B2A' };
  const tiers = [
    { x: 15, y: 14, width: 18, roof: 'M12.5 14.5 L24 10 L35.5 14.5 Z', windows: [17.2, 22.5, 27.8] },
    { x: 10, y: 22, width: 28, roof: 'M7.5 22.5 L24 18.5 L40.5 22.5 Z', windows: [12.5, 17.5, 22.5, 27.5, 32.5] },
    { x: 6, y: 30, width: 36, roof: 'M3.5 30.5 L24 26.5 L44.5 30.5 Z', windows: [8.5, 14, 19.5, 25, 30.5, 36] },
  ];
  return (
    <>
      <Rect width={48} height={48} fill={art.board} />
      <Circle cx={24} cy={25} r={17} fill={glow} opacity={0.18} />
      <Circle cx={8} cy={8} r={0.9} fill={art.white} />
      <Circle cx={40} cy={7} r={0.8} fill={art.white} />
      <Circle cx={33} cy={4.5} r={0.6} fill={art.white} />
      <Circle cx={13} cy={14} r={0.6} fill={art.white} />
      {tiers.map((tier) => (
        <G key={tier.y}>
          <Rect x={tier.x} y={tier.y} width={tier.width} height={7} fill={wood} {...night} />
          {tier.windows.map((x) => (
            <Rect key={x} x={x} y={tier.y + 2} width={3} height={3} rx={0.5} fill={glow} />
          ))}
          <Path d={tier.roof} fill={roof} {...night} />
          <Circle cx={tier.x + 2.5} cy={tier.y + 1.6} r={1.2} fill={art.lantern} />
          <Circle cx={tier.x + tier.width - 2.5} cy={tier.y + 1.6} r={1.2} fill={art.lantern} />
        </G>
      ))}
      <Path d="M9 37 L9 41 M15 37 L15 41 M21 37 L21 41 M27 37 L27 41 M33 37 L33 41 M39 37 L39 41" stroke={wood} strokeWidth={1.4} />
      <Rect y={40} width={48} height={8} fill="#173F66" />
      <Rect x={10} y={42} width={9} height={1.2} rx={0.6} fill={glow} opacity={0.75} />
      <Rect x={25} y={43.8} width={11} height={1.2} rx={0.6} fill={glow} opacity={0.6} />
      <Rect x={16} y={45.8} width={7} height={1.2} rx={0.6} fill={glow} opacity={0.45} />
    </>
  );
}

function Shanghai() {
  // The Oriental Pearl Tower over the Huangpu.
  const pink = '#F472B6';
  const city = '#9DB7D1';
  return (
    <>
      <Rect width={48} height={48} fill={art.skyTop} />
      <Circle cx={10} cy={11} r={4} fill={art.sun} />
      <Path d="M0 35 L0 26 L6 26 L6 22 L11 22 L11 29 L14 29 L14 24 L18 24 L18 35 Z" fill={city} />
      <Path d="M31 35 L31 19 L34.5 14 L38 19 L38 35 Z" fill={city} />
      <Rect x={38} y={24} width={6} height={11} fill="#B7CBE0" />
      <Rect y={34} width={48} height={3} fill={art.stone} />
      <Rect y={37} width={48} height={11} fill={art.sea} />
      <Path d="M5 42 Q8 40.5 11 42 M30 44 Q33 42.5 36 44" stroke={art.seaFoam} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M24 30 L19 37 M24 30 L29 37 M24 30 L24 37" stroke={art.outline} strokeWidth={1.6} strokeLinecap="round" />
      <Rect x={23} y={8} width={2} height={22} fill="#E9EEF5" {...thin} />
      <Circle cx={24} cy={29} r={5.5} fill={pink} {...line} />
      <Circle cx={24} cy={16.5} r={3.8} fill={pink} {...line} />
      <Circle cx={24} cy={9} r={1.7} fill={pink} {...thin} />
      <Path d="M24 7.2 L24 2" stroke={art.outline} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={22.3} cy={27.2} r={1.5} fill={art.shine} />
      <Circle cx={22.9} cy={15.4} r={1} fill={art.shine} />
    </>
  );
}

function Xian() {
  // A terracotta warrior, topknot and all.
  const clay = '#D9A066';
  const hair = '#8A5A35';
  return (
    <>
      <Rect width={48} height={48} fill="#FCE7C8" />
      <Path d="M8 49 Q10 38 24 37 Q38 38 40 49 Z" fill="#B8794A" {...line} />
      <Path d="M12.5 43 L35.5 43 M11 46.5 L37 46.5" stroke={hair} strokeWidth={1} />
      <Circle cx={24} cy={25} r={11} fill={clay} {...line} />
      <Path d="M13.2 23 Q13 13 24 13 Q35 13 34.8 23 Q30 18.5 24 18.5 Q18 18.5 13.2 23 Z" fill={hair} {...line} />
      <Circle cx={29} cy={11.5} r={3.8} fill={hair} {...line} />
      <Path d="M18.5 25.5 Q20 24.3 21.5 25.5 M26.5 25.5 Q28 24.3 29.5 25.5" stroke={art.outline} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M20.5 30.6 Q22.5 29 24 30.2 Q25.5 29 27.5 30.6" stroke={hair} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={17} cy={28.5} r={1.8} fill={art.blush} opacity={0.6} />
      <Circle cx={31} cy={28.5} r={1.8} fill={art.blush} opacity={0.6} />
    </>
  );
}

function Guangzhou() {
  // The Canton Tower's twisted waist, over the Pearl River.
  const tower = '#C4B5FD';
  const lattice = '#7C6BD6';
  return (
    <>
      <Rect width={48} height={48} fill="#ECE6FF" />
      <Circle cx={37} cy={11} r={4} fill={art.sun} />
      <Rect x={4} y={30} width={6} height={8} fill="#BDB5E0" />
      <Rect x={10.5} y={33} width={5} height={5} fill="#CFC8EC" />
      <Rect x={35} y={27} width={7} height={11} fill="#BDB5E0" />
      <Rect y={38} width={48} height={10} fill={art.sea} />
      <Path d="M6 43 Q9 41.5 12 43 M32 45 Q35 43.5 38 45" stroke={art.seaFoam} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M19 9 L29 9 Q25.4 21 25.6 26 Q26 33 29.5 39 L18.5 39 Q22 33 22.4 26 Q22.6 21 19 9 Z" fill={tower} {...line} />
      <Path
        d="M20.5 12.5 L26.5 18 M27.5 12.5 L21.5 18 M22.6 21.5 L25.4 25.5 M25.4 21.5 L22.6 25.5 M21.6 30 L27 36.5 M26.4 30 L21 36.5"
        stroke={lattice}
        strokeWidth={0.9}
      />
      <Ellipse cx={24} cy={9} rx={5} ry={1.6} fill={lattice} />
      <Path d="M24 8 L24 3" stroke={art.outline} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={24} cy={2.8} r={1.1} fill={art.lantern} />
    </>
  );
}

function Shenzhen() {
  // Skyscrapers by the sea, with the Ping An tower's spire, and our boat.
  const blue = '#7FA7C9';
  const pale = '#A9C4DD';
  const windows = (x: number, top: number, bottom: number) =>
    Array.from({ length: Math.floor((bottom - top) / 4) }, (_, row) => (
      <Rect key={`${x}-${row}`} x={x} y={top + row * 4} width={1.6} height={1.8} fill={art.white} opacity={0.85} />
    ));
  return (
    <>
      <Rect width={48} height={48} fill={art.skyLow} />
      <Circle cx={11} cy={10} r={4} fill={art.sun} />
      <Rect x={7} y={28} width={5} height={10} fill={blue} {...thin} />
      <Rect x={13} y={22} width={6} height={16} fill={pale} {...thin} />
      <Rect x={35} y={26} width={6} height={12} fill={blue} {...thin} />
      <Rect x={27} y={18} width={7} height={20} fill={pale} {...thin} />
      <Path d="M20 38 L20 12 L23 5 L26 12 L26 38 Z" fill={blue} {...thin} />
      {windows(22.2, 14, 37)}
      {windows(29.6, 20, 37)}
      {windows(15.2, 24, 37)}
      <Rect y={38} width={48} height={10} fill={art.sea} />
      <Path d="M4 43 Q7 41.5 10 43 Q13 44.5 16 43" stroke={art.seaFoam} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <SailboatShape x={29} y={33} scale={0.22} />
    </>
  );
}

function Hangzhou() {
  // Leifeng Pagoda above West Lake.
  const body = art.wood;
  const roof = '#5B4636';
  const tiers = [
    { y: 31.5, width: 14, height: 5.5 },
    { y: 26.5, width: 12, height: 4.5 },
    { y: 22, width: 10.5, height: 4 },
    { y: 17.8, width: 9, height: 3.8 },
    { y: 14, width: 7.5, height: 3.4 },
  ];
  return (
    <>
      <Rect width={48} height={48} fill="#DDF3E4" />
      <Path d="M0 33 Q10 20 22 30 Q33 17 48 27 L48 40 L0 40 Z" fill="#A7D7A9" />
      <Rect y={37} width={48} height={11} fill="#7DD3FC" />
      <Path d="M6 42 Q9 40.5 12 42 M33 44 Q36 42.5 39 44" stroke={art.seaFoam} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M24 14 L24 8" stroke={art.outline} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={24} cy={7.5} r={1.4} fill={art.gold} {...thin} />
      {tiers.map((tier) => (
        <G key={tier.y}>
          <Rect x={24 - tier.width / 2} y={tier.y} width={tier.width} height={tier.height} fill={body} {...thin} />
          <Path
            d={`M${24 - tier.width / 2 - 2.5} ${tier.y + 0.6} L${24 + tier.width / 2 + 2.5} ${tier.y + 0.6} L${24 + tier.width / 2} ${tier.y - 1.6} L${24 - tier.width / 2} ${tier.y - 1.6} Z`}
            fill={roof}
            {...thin}
          />
        </G>
      ))}
      <Rect x={22.6} y={33} width={2.8} height={4} rx={1.4} fill={art.outline} />
    </>
  );
}

function Guilin() {
  // Karst peaks along the Li River, and a bamboo raft.
  return (
    <>
      <Rect width={48} height={48} fill={art.skyLow} />
      <Circle cx={37} cy={10} r={4} fill={art.sun} />
      <Path d="M1 37 Q3 14 11 14 Q18 15 19 37 Z" fill="#8FCB9B" {...line} />
      <Path d="M29 37 Q31 18 38 17 Q45 18 47 37 Z" fill="#8FCB9B" {...line} />
      <Path d="M13 38 Q15 8 24 8 Q32 9 34 38 Z" fill={art.leaf} {...line} />
      <Path d="M20 16 Q22 13 25 13" stroke={art.leafDark} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Rect y={35} width={48} height={13} fill={art.sea} />
      <Path d="M4 39 Q7 37.5 10 39 M36 41 Q39 39.5 42 41" stroke={art.seaFoam} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M15.5 43 L30.5 43" stroke={art.woodDark} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M29 43 L33.5 35" stroke={art.wood} strokeWidth={1.2} strokeLinecap="round" />
      <Rect x={21.5} y={38.5} width={3} height={4} rx={1} fill={art.scarf} />
      <Path d="M19.8 39 L23 35.6 L26.2 39 Z" fill={art.gold} {...thin} />
    </>
  );
}

function Suzhou() {
  // A canal town: white walls, dark roofs and a stone bridge.
  const roof = '#3B4A5C';
  return (
    <>
      <Rect width={48} height={48} fill={art.skyLow} />
      <Rect x={2} y={20} width={14} height={12} fill={art.white} {...thin} />
      <Path d="M0.5 21 L9 15 L17.5 21 Z" fill={roof} {...thin} />
      <Rect x={5} y={24} width={3} height={3} fill={roof} />
      <Rect x={10.5} y={24} width={3} height={3} fill={roof} />
      <Rect x={32} y={22} width={14} height={10} fill={art.white} {...thin} />
      <Path d="M30.5 23 L39 17.5 L47.5 23 Z" fill={roof} {...thin} />
      <Rect x={35} y={25.5} width={3} height={3} fill={roof} />
      <Rect x={40.5} y={25.5} width={3} height={3} fill={roof} />
      <Circle cx={24} cy={9} r={4} fill={art.sun} />
      <Rect y={32} width={48} height={16} fill="#93D3F7" />
      <Path d="M12 36 Q24 47 36 36" stroke={art.stoneDark} strokeWidth={1.5} fill="none" opacity={0.7} />
      <Path d="M4 33 Q24 18 44 33 L44 36 L36 36 Q24 24 12 36 L4 36 Z" fill={art.stone} {...line} />
      <Path d="M5 43 Q8 41.5 11 43 M38 44 Q41 42.5 44 44" stroke={art.white} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </>
  );
}

function Nanjing() {
  // The Ming city wall and its gate, with plum blossom, the city's flower.
  const wall = '#C7CED6';
  return (
    <>
      <Rect width={48} height={48} fill={art.skyLow} />
      {[0, 8, 16, 24, 32, 40].map((x) => (
        <Rect key={x} x={x + 1} y={18.5} width={5} height={4.5} fill={wall} {...thin} />
      ))}
      <Rect x={-1} y={22} width={50} height={27} fill={wall} {...line} />
      <Path d="M0 30 L14 30 M34 30 L48 30 M0 38 L13 38 M35 38 L48 38 M7 30 L7 38 M41 30 L41 38" stroke={art.stoneDark} strokeWidth={1} />
      <Path d="M16.5 49 L16.5 36 Q24 26.5 31.5 36 L31.5 49 Z" fill="#3B4A5C" {...line} />
      <Path d="M48 3 Q38 7 33 15" stroke={art.woodDark} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M40 6 Q42 10 41 13" stroke={art.woodDark} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Flower x={35} y={12} r={2.2} color="#F9A8D4" />
      <Flower x={42} y={4.5} r={1.9} color="#F9A8D4" />
      <Flower x={41} y={13.5} r={1.7} color="#FBCFE8" />
    </>
  );
}

function Kunming() {
  // The City of Eternal Spring: flowers all year.
  return (
    <>
      <Rect width={48} height={48} fill="#FEF9C3" />
      <Path d="M24 26 L24 46 M14 30 L18 46 M34 30 L30 46" stroke={art.leafDark} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M9 47 Q12 35 22 33 Q16 41 9 47 Z" fill={art.leaf} />
      <Path d="M39 47 Q36 35 26 33 Q32 41 39 47 Z" fill={art.leafDark} />
      <Flower x={13.5} y={27} r={4.2} color="#F87171" />
      <Flower x={34.5} y={27} r={4.2} color="#FB923C" />
      <Flower x={24} y={19} r={5.6} color="#F472B6" />
    </>
  );
}

function Lantern() {
  // A city without its own drawing yet.
  return (
    <>
      <Rect width={48} height={48} fill={art.skyLow} />
      <Path d="M24 6 L24 12" stroke={art.outline} strokeWidth={1.4} />
      <Ellipse cx={24} cy={24} rx={11} ry={12} fill={art.lantern} {...line} />
      <Path d="M24 12 Q18 24 24 36 Q30 24 24 12" stroke={art.lanternDark} strokeWidth={1.2} fill="none" />
      <Rect x={19} y={10.5} width={10} height={3} rx={1} fill={art.gold} {...thin} />
      <Rect x={19} y={34.5} width={10} height={3} rx={1} fill={art.gold} {...thin} />
      <Path d="M24 37.5 L24 43" stroke={art.gold} strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}

const DRAWINGS: Record<string, () => ReactNode> = {
  beijing: Beijing,
  chengdu: Chengdu,
  chongqing: Chongqing,
  shanghai: Shanghai,
  xian: Xian,
  guangzhou: Guangzhou,
  shenzhen: Shenzhen,
  hangzhou: Hangzhou,
  guilin: Guilin,
  suzhou: Suzhou,
  nanjing: Nanjing,
  kunming: Kunming,
};

/** The city's landmark in a circle. `muted` washes it out, for a city that's coming soon. */
export function CityArt({ slug, size, muted = false }: { slug: string; size: number; muted?: boolean }) {
  const Drawing = DRAWINGS[slug] ?? Lantern;
  const clip = `city-art-${slug}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={24} cy={24} r={24} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Drawing />
        {muted ? <Rect width={48} height={48} fill={art.white} opacity={0.42} /> : null}
      </G>
    </Svg>
  );
}
