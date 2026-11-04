import { type ComponentType, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import type { SceneKind } from '@/lib/scenarioVisuals';

import { art } from './palette';
import { SailboatShape } from './Sailboat';

// Drawn portrait (400x720) so a scene fills a phone behind the chat; cards and headers show a band of it.
const W = 400;
const H = 720;

const line = { stroke: art.outline, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Gradient({ id, from = art.skyTop, to = art.skyLow }: { id: string; from?: string; to?: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={from} />
        <Stop offset="1" stopColor={to} />
      </LinearGradient>
    </Defs>
  );
}

function Sky({ id, from, to }: { id: string; from?: string; to?: string }) {
  return (
    <>
      <Gradient id={id} from={from} to={to} />
      <Rect width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}

function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <Path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M0 22 C0 12 10 7 18 10 C21 1 37 -2 43 8 C51 4 62 10 60 22 Z"
      fill={art.cloud}
    />
  );
}

function Plant({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path d="M30 40 C10 30 4 6 14 0 C24 10 30 24 30 40 Z" fill={art.leaf} {...line} strokeWidth={2} />
      <Path d="M30 40 C50 30 56 6 46 0 C36 10 30 24 30 40 Z" fill={art.leafDark} {...line} strokeWidth={2} />
      <Path d="M30 42 C22 26 26 6 30 -6 C34 6 38 26 30 42 Z" fill={art.leaf} {...line} strokeWidth={2} />
      <Path d="M14 40 L46 40 L41 70 L19 70 Z" fill={art.woodLight} {...line} strokeWidth={2} />
    </G>
  );
}

function Airport() {
  return (
    <>
      <Rect width={W} height={H} fill="#EEF5FC" />
      <Rect width={W} height={86} fill="#DCE9F6" />
      {[40, 155, 270].map((x) => (
        <Rect key={x} x={x} y={36} width={90} height={10} rx={5} fill={art.white} />
      ))}
      <Gradient id="airport-sky" from="#9EDBFB" to="#E3F4FE" />
      <Rect x={22} y={108} width={356} height={330} rx={10} fill="url(#airport-sky)" />
      <Cloud x={50} y={150} />
      <Cloud x={250} y={196} scale={0.8} />
      <Cloud x={300} y={128} scale={0.55} />
      <Path d="M25 380 Q120 358 200 372 T375 364 L375 435 L25 435 Z" fill={art.grass} />
      <Rect x={25} y={402} width={350} height={14} fill="#B8C4CF" />
      {[40, 90, 140, 190, 240, 290, 340].map((x) => (
        <Rect key={x} x={x} y={407} width={20} height={4} rx={2} fill={art.white} />
      ))}
      <Rect x={62} y={318} width={12} height={70} fill="#C9D6E2" />
      <Path d="M52 306 L84 306 L80 322 L56 322 Z" fill="#9FB3C6" />
      <Rect x={56} y={298} width={24} height={9} rx={2} fill="#7F96AB" />
      <G transform="translate(214 248) rotate(-14)">
        <Path d="M2 -1 L-10 -26 L6 -24 L20 -3 Z" fill={art.scarf} {...line} strokeWidth={2} />
        <Path d="M0 0 C10 -9 72 -9 88 -2 C95 1 95 7 88 9 C72 13 10 13 0 7 Z" fill={art.white} {...line} strokeWidth={2} />
        <Path d="M38 5 L20 30 L33 30 L58 6 Z" fill="#D7E3EE" {...line} strokeWidth={2} />
        {[22, 32, 42, 52, 62, 72].map((x) => (
          <Circle key={x} cx={x} cy={1} r={2.2} fill={art.board} />
        ))}
      </G>
      <Rect x={137} y={108} width={6} height={330} fill="#8FA6BC" />
      <Rect x={257} y={108} width={6} height={330} fill="#8FA6BC" />
      <Rect x={22} y={268} width={356} height={6} fill="#8FA6BC" />
      <Rect x={22} y={108} width={356} height={330} rx={10} fill="none" stroke="#8FA6BC" strokeWidth={7} />
      <Rect x={12} y={436} width={376} height={14} rx={4} fill="#C9D7E5" />

      <Rect x={20} y={474} width={176} height={42} rx={9} fill={art.sun} />
      <SvgText x={36} y={501} fontSize={17} fontWeight="700" fill={art.board}>
        行李 Baggage →
      </SvgText>
      <Rect x={226} y={470} width={154} height={88} rx={9} fill={art.board} />
      <SvgText x={240} y={492} fontSize={13} fontWeight="700" fill={art.sun}>
        到达 Arrivals
      </SvgText>
      {[504, 520, 536].map((y) => (
        <G key={y}>
          <Rect x={240} y={y} width={64} height={7} rx={3.5} fill="#FDE68A" opacity={0.9} />
          <Rect x={314} y={y} width={50} height={7} rx={3.5} fill="#7DD3FC" opacity={0.9} />
        </G>
      ))}

      <Rect x={0} y={576} width={W} height={144} fill="#DCE6F0" />
      <Path d="M0 622 L400 622 M0 672 L400 672" stroke="#CBD8E5" strokeWidth={2} />
      <Rect x={18} y={626} width={176} height={7} fill="#94A3B8" />
      {[0, 1, 2, 3].map((index) => (
        <G key={index}>
          <Rect x={22 + index * 43} y={578} width={36} height={36} rx={9} fill={art.seaDeep} {...line} strokeWidth={2} />
          <Rect x={20 + index * 43} y={608} width={40} height={14} rx={6} fill={art.scarf} {...line} strokeWidth={2} />
        </G>
      ))}
      <Plant x={212} y={560} scale={0.9} />
      <Path d="M314 590 L314 574 L338 574 L338 590" fill="none" {...line} strokeWidth={3} />
      <Rect x={298} y={590} width={56} height={70} rx={9} fill={art.sun} {...line} />
      <Rect x={299} y={612} width={54} height={7} fill={art.beakShade} />
      <Circle cx={310} cy={664} r={4.5} fill={art.outline} />
      <Circle cx={342} cy={664} r={4.5} fill={art.outline} />
    </>
  );
}

function Lantern({ cx, cy }: { cx: number; cy: number }) {
  return (
    <G>
      <Path d={`M${cx} 60 L${cx} ${cy - 40}`} stroke={art.outline} strokeWidth={2} />
      <Rect x={cx - 15} y={cy - 42} width={30} height={9} rx={2} fill={art.gold} {...line} strokeWidth={2} />
      <Ellipse cx={cx} cy={cy} rx={36} ry={36} fill={art.lantern} {...line} />
      <Path
        d={`M${cx} ${cy - 36} Q${cx - 24} ${cy} ${cx} ${cy + 36} M${cx} ${cy - 36} Q${cx + 24} ${cy} ${cx} ${cy + 36}`}
        stroke={art.lanternDark}
        strokeWidth={1.8}
        fill="none"
      />
      <SvgText x={cx} y={cy + 9} fontSize={26} fontWeight="700" fill={art.gold} textAnchor="middle">
        福
      </SvgText>
      <Rect x={cx - 15} y={cy + 33} width={30} height={9} rx={2} fill={art.gold} {...line} strokeWidth={2} />
      <Path d={`M${cx - 6} ${cy + 42} L${cx - 7} ${cy + 66} M${cx} ${cy + 42} L${cx} ${cy + 70} M${cx + 6} ${cy + 42} L${cx + 7} ${cy + 66}`} stroke={art.gold} strokeWidth={3} strokeLinecap="round" />
    </G>
  );
}

const MENU = [
  { name: '牛肉面', price: '¥18' },
  { name: '担担面', price: '¥15' },
  { name: '抄手', price: '¥16' },
  { name: '饺子', price: '¥20' },
];

function Restaurant() {
  return (
    <>
      <Rect width={W} height={H} fill="#FFF3DF" />
      <Rect width={W} height={60} fill={art.woodDark} />
      <Rect y={58} width={W} height={10} fill={art.wood} />
      <Lantern cx={78} cy={140} />
      <Lantern cx={322} cy={140} />
      <Rect x={36} y={232} width={328} height={9} rx={3} fill={art.woodDark} />
      {MENU.map((item, index) => {
        const x = 50 + index * 77;
        return (
          <G key={item.name}>
            <Path d={`M${x + 32} 241 L${x + 32} 250`} stroke={art.woodDark} strokeWidth={2} />
            <Rect x={x} y={250} width={64} height={152} rx={6} fill="#FFF9EC" stroke={art.woodDark} strokeWidth={3} />
            <Rect x={x} y={250} width={64} height={12} rx={4} fill={art.lantern} />
            {/* Keyed by position: a name can repeat a character (担担面). */}
            {[...item.name].map((char, charIndex) => (
              <SvgText key={charIndex} x={x + 32} y={296 + charIndex * 30} fontSize={24} fontWeight="700" fill="#9B2C2C" textAnchor="middle">
                {char}
              </SvgText>
            ))}
            <SvgText x={x + 32} y={392} fontSize={14} fontWeight="700" fill={art.woodDark} textAnchor="middle">
              {item.price}
            </SvgText>
          </G>
        );
      })}
      <Rect x={124} y={428} width={152} height={52} rx={10} fill={art.lantern} {...line} />
      <SvgText x={200} y={464} fontSize={28} fontWeight="700" fill={art.gold} textAnchor="middle">
        面 馆
      </SvgText>

      <Rect x={0} y={540} width={W} height={180} fill={art.wood} />
      {[0, 1, 2, 3].map((index) => (
        <Rect key={index} x={18 + index * 96} y={566} width={82} height={136} rx={7} fill="none" stroke={art.woodDark} strokeWidth={3} />
      ))}
      <Rect x={-4} y={522} width={W + 8} height={20} fill={art.woodLight} {...line} />
      <Path d="M92 474 q-9 -12 0 -24 q9 -12 0 -24 M112 470 q-9 -12 0 -24 q9 -12 0 -24" stroke={art.white} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.95} />
      <Path d="M62 494 L150 494 Q148 522 106 524 Q64 522 62 494 Z" fill={art.white} {...line} />
      <Path d="M68 503 L144 503" stroke={art.lantern} strokeWidth={3} />
      <Ellipse cx={106} cy={494} rx={44} ry={7} fill="#F6D28B" {...line} strokeWidth={2} />
      <Path d="M132 488 L176 450 M138 490 L182 454" stroke={art.woodDark} strokeWidth={3.5} strokeLinecap="round" />
      <Ellipse cx={300} cy={500} rx={28} ry={21} fill="#7FB8A4" {...line} />
      <Path d="M273 497 L256 482" stroke={art.outline} strokeWidth={6} strokeLinecap="round" />
      <Path d="M273 497 L256 482" stroke="#7FB8A4" strokeWidth={3} strokeLinecap="round" />
      <Path d="M326 488 Q344 494 326 510" fill="none" stroke={art.outline} strokeWidth={4} />
      <Ellipse cx={300} cy={480} rx={12} ry={4} fill="#5E9A86" {...line} strokeWidth={2} />
      <Path d="M344 504 L364 504 L361 520 L347 520 Z" fill={art.white} {...line} strokeWidth={2} />
    </>
  );
}

function Train() {
  return (
    <>
      <Rect width={W} height={H} fill="#EAF1F8" />
      <Gradient id="train-sky" from="#A5DDFB" to="#E6F5FE" />
      <Path d="M20 330 L20 190 A180 170 0 0 1 380 190 L380 330 Z" fill="url(#train-sky)" />
      <Cloud x={70} y={130} scale={0.9} />
      <Cloud x={250} y={170} scale={0.7} />
      <Path d="M110 43 L110 330 M200 20 L200 330 M290 43 L290 330 M20 190 L380 190 M20 262 L380 262" stroke="#7F96AB" strokeWidth={5} />
      <Path d="M20 330 L20 190 A180 170 0 0 1 380 190 L380 330 Z" fill="none" stroke="#7F96AB" strokeWidth={7} />
      <Rect x={10} y={328} width={380} height={12} rx={4} fill="#C9D7E5" />

      <Rect x={40} y={352} width={124} height={38} rx={8} fill={art.scarf} />
      <SvgText x={102} y={378} fontSize={17} fontWeight="700" fill={art.white} textAnchor="middle">
        3 站台
      </SvgText>
      <Path d="M300 340 L300 350" stroke={art.outline} strokeWidth={3} />
      <Circle cx={300} cy={376} r={26} fill={art.white} {...line} strokeWidth={3} />
      <Path d="M300 376 L300 360 M300 376 L311 382" stroke={art.outline} strokeWidth={3} strokeLinecap="round" />

      <Rect x={30} y={414} width={340} height={98} rx={9} fill={art.board} />
      <SvgText x={46} y={438} fontSize={14} fontWeight="700" fill={art.sun}>
        出发 Departures
      </SvgText>
      {[
        ['G1234', '重庆北', '08:15'],
        ['D5678', '成都东', '09:40'],
        ['G7310', '西安北', '10:05'],
      ].map(([train, to, time], index) => (
        <G key={train}>
          <SvgText x={46} y={462 + index * 19} fontSize={13} fontWeight="700" fill="#FDE68A">
            {train}
          </SvgText>
          <SvgText x={130} y={462 + index * 19} fontSize={13} fontWeight="700" fill="#FDE68A">
            {to}
          </SvgText>
          <SvgText x={300} y={462 + index * 19} fontSize={13} fontWeight="700" fill="#7DD3FC">
            {time}
          </SvgText>
        </G>
      ))}

      <Path d="M-4 540 L290 540 Q368 544 404 596 L404 616 L-4 616 Z" fill={art.white} {...line} strokeWidth={3} />
      <Path d="M-4 590 L352 590 Q380 593 404 604 L404 610 L-4 610 Z" fill={art.scarf} />
      {[14, 66, 118, 170, 222].map((x) => (
        <Rect key={x} x={x} y={556} width={38} height={20} rx={7} fill={art.board} opacity={0.85} />
      ))}
      <Path d="M292 554 Q346 554 372 582 L292 582 Z" fill={art.board} opacity={0.85} />
      <Rect x={0} y={616} width={W} height={104} fill="#D5DEE7" />
      <Rect x={0} y={630} width={W} height={9} fill={art.sun} />
      {[30, 90, 150, 210, 270, 330, 390].map((x) => (
        <Rect key={x} x={x - 20} y={668} width={40} height={4} rx={2} fill="#C3CEDA" />
      ))}
    </>
  );
}

function Hotel() {
  return (
    <>
      <Rect width={W} height={H} fill="#F6EEE3" />
      <Rect x={36} y={86} width={328} height={424} rx={10} fill="#E9DCC8" />
      {Array.from({ length: 16 }, (_, index) => 56 + index * 19).map((x) => (
        <Path key={x} d={`M${x} 96 L${x} 500`} stroke="#DCC9AE" strokeWidth={3} />
      ))}
      {[66, 334].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy={168} r={46} fill="#FFF3C4" opacity={0.5} />
          <Circle cx={cx} cy={168} r={26} fill="#FFF3C4" opacity={0.8} />
          <Path d={`M${cx - 14} 150 L${cx + 14} 150 L${cx + 20} 176 L${cx - 20} 176 Z`} fill="#FDE68A" {...line} strokeWidth={2} />
          <Path d={`M${cx} 176 L${cx} 196`} stroke={art.outline} strokeWidth={2.5} />
        </G>
      ))}
      <Rect x={116} y={124} width={168} height={116} fill="#E0F2FE" stroke={art.woodDark} strokeWidth={7} />
      <Circle cx={244} cy={160} r={14} fill={art.sun} />
      <Path d="M120 236 L170 172 L198 204 L228 168 L280 236 Z" fill="#7FB8A4" />
      <Path d="M120 236 L156 204 L190 236 Z" fill="#5E9A86" />

      <Rect x={60} y={290} width={144} height={42} rx={7} fill={art.gold} {...line} strokeWidth={2} />
      <SvgText x={132} y={317} fontSize={15} fontWeight="700" fill="#6B4423" textAnchor="middle">
        前台 · Reception
      </SvgText>
      <Rect x={230} y={272} width={112} height={124} rx={5} fill={art.woodDark} />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <G key={`${row}-${col}`}>
            <Rect x={238 + col * 34} y={280 + row * 38} width={28} height={30} rx={3} fill="#7A4E2B" />
            {(row + col) % 2 === 0 ? (
              <>
                <Circle cx={252 + col * 34} cy={292 + row * 38} r={4} fill="none" stroke={art.gold} strokeWidth={2.2} />
                <Path d={`M${252 + col * 34} ${296 + row * 38} L${252 + col * 34} ${306 + row * 38}`} stroke={art.gold} strokeWidth={2.2} />
              </>
            ) : null}
          </G>
        )),
      )}
      <Plant x={330} y={404} scale={0.95} />

      <Rect x={0} y={520} width={W} height={200} fill="#B98A5E" />
      {[100, 200, 300].map((x) => (
        <Path key={x} d={`M${x} 540 L${x} 720`} stroke="#9C6F45" strokeWidth={3} />
      ))}
      <Rect x={-4} y={504} width={W + 8} height={18} fill="#F8FAFC" {...line} />
      <Path d="M94 504 Q94 486 110 486 Q126 486 126 504 Z" fill={art.sun} {...line} strokeWidth={2} />
      <Rect x={88} y={501} width={44} height={6} rx={3} fill={art.beakShade} {...line} strokeWidth={1.6} />
      <Circle cx={110} cy={484} r={3} fill={art.sun} {...line} strokeWidth={1.5} />
      <Rect x={262} y={474} width={70} height={30} rx={4} fill={art.white} {...line} strokeWidth={2} />
      <SvgText x={297} y={495} fontSize={15} fontWeight="700" fill={art.lanternDark} textAnchor="middle">
        欢迎
      </SvgText>
    </>
  );
}

function Stall({ x, colorA, goods }: { x: number; colorA: string; goods: string[] }) {
  const stripes = Array.from({ length: 8 }, (_, index) => index);
  return (
    <G>
      <Rect x={x + 4} y={300} width={8} height={262} fill={art.woodDark} />
      <Rect x={x + 174} y={300} width={8} height={262} fill={art.woodDark} />
      {stripes.map((index) => (
        <Rect key={index} x={x + index * 23.25} y={292} width={23.25} height={42} fill={index % 2 === 0 ? colorA : art.white} />
      ))}
      {stripes.map((index) => (
        <Circle key={index} cx={x + 11.6 + index * 23.25} cy={334} r={11.6} fill={index % 2 === 0 ? colorA : art.white} />
      ))}
      <Rect x={x} y={292} width={186} height={42} fill="none" {...line} strokeWidth={2} />
      {[x + 40, x + 92, x + 144].map((cx) => (
        <G key={cx}>
          <Path d={`M${cx} 346 L${cx} 410`} stroke={art.outline} strokeWidth={1.5} />
          {[0, 1, 2, 3].map((index) => (
            <Ellipse key={index} cx={cx + (index % 2 === 0 ? -4 : 4)} cy={360 + index * 14} rx={5} ry={8} fill={art.lantern} {...line} strokeWidth={1.2} />
          ))}
        </G>
      ))}
      <Rect x={x + 2} y={490} width={182} height={72} fill={art.wood} {...line} strokeWidth={2} />
      {goods.map((color, index) => (
        <G key={`${color}-${index}`}>
          {[0, 1, 2, 3, 4].map((dot) => (
            <Circle
              key={dot}
              cx={x + 22 + index * 58 + (dot % 3) * 12 + (dot > 2 ? 6 : 0)}
              cy={dot > 2 ? 470 : 482}
              r={8}
              fill={color}
              {...line}
              strokeWidth={1.5}
            />
          ))}
          <Rect x={x + 12 + index * 58} y={484} width={50} height={22} rx={3} fill={art.woodLight} {...line} strokeWidth={1.8} />
          <Rect x={x + 24 + index * 58} y={510} width={26} height={14} rx={2} fill={art.white} />
          <SvgText x={x + 37 + index * 58} y={521} fontSize={10} fontWeight="700" fill={art.board} textAnchor="middle">
            ¥{5 + index * 3}
          </SvgText>
        </G>
      ))}
    </G>
  );
}

// Bulbs along the string of lights in the market: two sagging curves, (0,70)-(200,86) and (200,86)-(400,70).
const LIGHTS = [0.15, 0.4, 0.65, 0.9].flatMap((t) => {
  const sag = (a: number, b: number, c: number) => (1 - t) ** 2 * a + 2 * t * (1 - t) * b + t ** 2 * c;
  return [
    [200 * t, sag(70, 130, 86)],
    [200 + 200 * t, sag(86, 130, 70)],
  ];
});

function Market() {
  return (
    <>
      <Sky id="market-sky" from="#BFE6FC" to="#F1F9FF" />
      <Cloud x={40} y={180} scale={0.8} />
      <Cloud x={270} y={150} scale={0.6} />
      <Rect x={0} y={214} width={W} height={120} fill="#F3E5D0" />
      <Path d="M-10 214 Q60 196 110 206 Q160 196 200 214 L188 226 L2 226 Z" fill="#5B6B7B" />
      <Path d="M200 214 Q260 194 320 206 Q370 196 410 214 L400 226 L210 226 Z" fill="#4A5A6D" />
      <Path d="M0 70 Q100 130 200 86 Q300 130 400 70" stroke={art.outline} strokeWidth={1.6} fill="none" />
      {LIGHTS.map(([cx, cy], index) => (
        <Circle key={cx} cx={cx} cy={cy} r={6} fill={[art.sun, art.lantern, art.seaDeep][index % 3]} />
      ))}
      <Stall x={8} colorA={art.scarf} goods={['#EF4444', '#FB923C', '#84CC16']} />
      <Stall x={206} colorA={art.sun} goods={['#F97316', '#A855F7', '#EF4444']} />
      <Rect x={0} y={562} width={W} height={158} fill="#E7DCC8" />
      {[[40, 610], [130, 650], [230, 600], [320, 660], [90, 700], [280, 700]].map(([cx, cy]) => (
        <Ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={30} ry={8} fill="#DCCFB6" />
      ))}
    </>
  );
}

function Building({ x, y, width, color }: { x: number; y: number; width: number; color: string }) {
  const rows = Math.floor((530 - y - 20) / 34);
  const cols = Math.floor((width - 16) / 22);
  return (
    <G>
      <Rect x={x} y={y} width={width} height={540 - y} fill={color} />
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (__, col) => (
          <Rect key={`${row}-${col}`} x={x + 12 + col * 22} y={y + 16 + row * 34} width={12} height={18} rx={2} fill={art.white} opacity={0.75} />
        )),
      )}
    </G>
  );
}

// A made-up QR code, the way taxis and stalls show one to pay with: three corner squares and a scatter of dots.
const QR_DOTS = [
  [4, 0], [5, 1], [4, 2], [0, 4], [2, 4], [3, 4], [5, 4], [7, 4], [1, 5], [4, 5], [6, 5], [8, 5],
  [4, 6], [6, 6], [8, 6], [5, 7], [7, 7], [4, 8], [6, 8], [8, 8],
];

function QrCode({ x, y, size }: { x: number; y: number; size: number }) {
  const cell = size / 9;
  return (
    <G>
      {[
        [0, 0],
        [6, 0],
        [0, 6],
      ].map(([col, row]) => (
        <G key={`${col}-${row}`}>
          <Rect x={x + col * cell} y={y + row * cell} width={cell * 3} height={cell * 3} fill={art.board} />
          <Rect x={x + (col + 0.5) * cell} y={y + (row + 0.5) * cell} width={cell * 2} height={cell * 2} fill={art.white} />
          <Rect x={x + (col + 1) * cell} y={y + (row + 1) * cell} width={cell} height={cell} fill={art.board} />
        </G>
      ))}
      {QR_DOTS.map(([col, row]) => (
        <Rect key={`${col}-${row}`} x={x + col * cell} y={y + row * cell} width={cell} height={cell} fill={art.board} />
      ))}
    </G>
  );
}

const WINDSHIELD = 'M52 150 Q200 132 348 150 L392 438 Q200 424 8 438 Z';
const SEAT_COVER = '#F1E8D5';
const SEAT_TRIM = '#D8C9A8';

/** A front seat seen from the back seat: headrest, posts, and a lace-trimmed cover like many taxis have. */
function FrontSeat({ x, width }: { x: number; width: number }) {
  const mid = x + width / 2;
  const scallops = Math.floor((width - 24) / 14);
  return (
    <G>
      <Path d={`M${mid - 9} 552 L${mid - 9} 574 M${mid + 9} 552 L${mid + 9} 574`} stroke="#9AA3AE" strokeWidth={4} />
      <Rect x={x + 38} y={494} width={width - 76} height={62} rx={20} fill={SEAT_COVER} {...line} />
      <Rect x={x} y={568} width={width} height={180} rx={28} fill={SEAT_COVER} {...line} />
      <Path
        d={`M${x + 12} 590 ${Array.from({ length: scallops }, () => 'q7 9 14 0').join(' ')}`}
        stroke={SEAT_TRIM}
        strokeWidth={2}
        fill="none"
      />
      {[612, 636, 660, 684, 708].map((cy) =>
        Array.from({ length: Math.floor((width - 30) / 22) }, (_, col) => (
          <Circle key={`${cy}-${col}`} cx={x + 24 + col * 22 + (cy % 48 === 12 ? 0 : 11)} cy={cy} r={2} fill={SEAT_TRIM} opacity={0.7} />
        )),
      )}
    </G>
  );
}

/** Inside a taxi, from the back seat: the street through the windshield, the meter, and the seats in front. */
function Taxi() {
  return (
    <>
      {/* The cab's roof lining, with the dome light. */}
      <Rect width={W} height={H} fill="#D9D2C6" />
      <Rect x={150} y={36} width={100} height={30} rx={12} fill="#FFF6D6" stroke="#C4BBAD" strokeWidth={2} />

      {/* The street ahead, seen through the windshield. */}
      <Defs>
        <ClipPath id="taxi-glass">
          <Path d={WINDSHIELD} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#taxi-glass)">
        <Gradient id="taxi-sky" from="#A9DEFB" to="#EEF8FF" />
        <Rect y={120} width={W} height={330} fill="url(#taxi-sky)" />
        <Circle cx={312} cy={206} r={24} fill="#FDE68A" />
        <Cloud x={56} y={178} scale={0.8} />
        <Cloud x={228} y={226} scale={0.55} />
        <Building x={-10} y={262} width={92} color="#C7DDF0" />
        <Building x={78} y={300} width={70} color="#B3CDE6" />
        <Building x={152} y={252} width={44} color="#A9C4DE" />
        <Building x={252} y={244} width={78} color="#D6E4F2" />
        <Building x={322} y={292} width={90} color="#BBD3EA" />
        <Rect y={338} width={W} height={112} fill="#CBD5DF" />
        <Path d="M-30 440 L184 338 L216 338 L430 440 Z" fill="#7D8996" />
        <Path d="M-30 440 L184 338 M430 440 L216 338" stroke={art.white} strokeWidth={2.5} opacity={0.85} />
        <Path
          d="M199 344 L201 344 L201.6 352 L198.4 352 Z M197.8 362 L202.2 362 L203.2 376 L196.8 376 Z M196 396 L204 396 L205.6 420 L194.4 420 Z"
          fill={art.white}
          opacity={0.9}
        />
        {[
          [50, 0.9],
          [352, 1],
        ].map(([cx, scale]) => (
          <G key={cx} transform={`translate(${cx} 0) scale(${scale} 1)`}>
            <Rect x={-4} y={318} width={8} height={44} fill={art.woodDark} />
            <Circle cx={0} cy={310} r={26} fill={art.leaf} {...line} strokeWidth={2} />
            <Circle cx={-12} cy={322} r={14} fill={art.leafDark} />
          </G>
        ))}
        <Path d="M118 300 L118 352" stroke="#64748B" strokeWidth={4} />
        <Rect x={82} y={278} width={72} height={26} rx={4} fill="#1D4ED8" stroke={art.white} strokeWidth={2} />
        <SvgText x={118} y={296} fontSize={12} fontWeight="700" fill={art.white} textAnchor="middle">
          市中心 →
        </SvgText>
        {/* A car ahead */}
        <Rect x={182} y={348} width={36} height={16} rx={5} fill="#BFE3F8" {...line} strokeWidth={2} />
        <Rect x={174} y={358} width={52} height={26} rx={7} fill={art.scarf} {...line} strokeWidth={2} />
        <Rect x={178} y={366} width={8} height={5} rx={2} fill={art.lantern} />
        <Rect x={214} y={366} width={8} height={5} rx={2} fill={art.lantern} />
        <Rect x={192} y={372} width={16} height={7} rx={1.5} fill={art.white} />
        <Rect x={178} y={383} width={10} height={6} rx={2} fill="#1F2933" />
        <Rect x={212} y={383} width={10} height={6} rx={2} fill="#1F2933" />
      </G>
      <Path d={WINDSHIELD} fill="none" stroke="#4A5360" strokeWidth={9} strokeLinejoin="round" />

      {/* The rear-view mirror, with a red knot hung for luck. */}
      <Path d="M200 128 L200 164" stroke="#4A5360" strokeWidth={5} />
      <Rect x={146} y={160} width={108} height={28} rx={11} fill="#2F3742" {...line} />
      <Rect x={153} y={166} width={94} height={16} rx={7} fill="#9FC3DD" />
      <Path d="M162 179 L176 168 M172 180 L186 169" stroke={art.white} strokeWidth={2} opacity={0.6} strokeLinecap="round" />
      <Path d="M200 188 L200 211" stroke={art.lantern} strokeWidth={2} />
      <Circle cx={200} cy={212} r={3.5} fill={art.gold} {...line} strokeWidth={1.2} />
      <Path d="M200 216 L214 230 L200 244 L186 230 Z" fill={art.lantern} {...line} strokeWidth={1.6} />
      <Path d="M193 223 L207 237 M207 223 L193 237" stroke={art.gold} strokeWidth={1.4} />
      <Path d="M196 244 L195 266 M200 244 L200 270 M204 244 L205 266" stroke={art.lantern} strokeWidth={2.4} strokeLinecap="round" />

      {/* The dashboard: steering wheel on the driver's side, the phone's map, and the meter. */}
      <Path d="M0 448 Q200 414 400 448 L400 580 L0 580 Z" fill="#3A4350" {...line} />
      <Path d="M14 452 Q200 422 386 452" stroke="#5B6675" strokeWidth={3} fill="none" />
      <Circle cx={96} cy={520} r={58} fill="none" stroke="#1F252D" strokeWidth={13} />
      <Path d="M44 520 L148 520 M96 520 L96 578" stroke="#1F252D" strokeWidth={10} />
      <Circle cx={96} cy={520} r={14} fill="#2B323C" stroke="#1F252D" strokeWidth={3} />
      <Rect x={192} y={496} width={16} height={12} rx={2} fill="#2B323C" />
      <Rect x={176} y={434} width={48} height={66} rx={7} fill="#111827" {...line} strokeWidth={2} />
      <Rect x={180} y={439} width={40} height={56} rx={4} fill="#DDF1E4" />
      <Path d="M180 470 L220 458 M196 439 L204 495" stroke={art.white} strokeWidth={3} />
      <Path d="M187 488 Q196 472 203 467 T214 448" stroke={art.scarf} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={214} cy={449} r={4} fill={art.lantern} {...line} strokeWidth={1.2} />
      <Rect x={262} y={444} width={106} height={46} rx={7} fill="#161B22" {...line} />
      <Rect x={270} y={450} width={90} height={26} rx={3} fill="#2A0D0F" />
      <SvgText x={274} y={461} fontSize={8} fontWeight="700" fill="#FF9EA1">
        金额
      </SvgText>
      <SvgText x={355} y={471} fontSize={19} fontWeight="700" fill="#FF5A5F" textAnchor="end">
        30.00
      </SvgText>
      {[276, 296, 316, 336].map((x) => (
        <Rect key={x} x={x} y={480} width={14} height={5} rx={2} fill="#3B4552" />
      ))}

      {/* The front seats, and the QR code on the back of one to pay with. */}
      <Rect x={186} y={588} width={28} height={140} fill="#2A313A" />
      <Circle cx={200} cy={600} r={9} fill="#1F252D" />
      <FrontSeat x={18} width={168} />
      <FrontSeat x={214} width={168} />
      <Rect x={258} y={604} width={80} height={98} rx={7} fill={art.white} {...line} />
      <SvgText x={298} y={622} fontSize={12} fontWeight="700" fill="#15803D" textAnchor="middle">
        扫码付款
      </SvgText>
      <QrCode x={274} y={632} size={48} />
    </>
  );
}

function PandaFace({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <G>
      <Circle cx={cx - r * 0.72} cy={cy - r * 0.68} r={r * 0.38} fill={art.eye} />
      <Circle cx={cx + r * 0.72} cy={cy - r * 0.68} r={r * 0.38} fill={art.eye} />
      <Circle cx={cx} cy={cy} r={r} fill={art.white} stroke={art.outline} strokeWidth={1.2} />
      <Ellipse cx={cx - r * 0.38} cy={cy - r * 0.05} rx={r * 0.24} ry={r * 0.32} fill={art.eye} />
      <Ellipse cx={cx + r * 0.38} cy={cy - r * 0.05} rx={r * 0.24} ry={r * 0.32} fill={art.eye} />
      <Ellipse cx={cx} cy={cy + r * 0.42} rx={r * 0.17} ry={r * 0.11} fill={art.eye} />
    </G>
  );
}

const HANGER = '#8A6A4A';

/** A panda T-shirt on a hanger, hooked on a rail 20 above `y`. */
function TShirt({ cx, y, color }: { cx: number; y: number; color: string }) {
  return (
    <G>
      <Path d={`M${cx} ${y - 10} L${cx} ${y - 14} Q${cx} ${y - 20} ${cx + 5} ${y - 19}`} fill="none" stroke={HANGER} strokeWidth={2} strokeLinecap="round" />
      <Path
        d={`M${cx - 10} ${y} Q${cx} ${y + 7} ${cx + 10} ${y} L${cx + 26} ${y + 8} L${cx + 21} ${y + 22} L${cx + 15} ${y + 19} L${cx + 15} ${y + 58} L${cx - 15} ${y + 58} L${cx - 15} ${y + 19} L${cx - 21} ${y + 22} L${cx - 26} ${y + 8} Z`}
        fill={color}
        {...line}
        strokeWidth={2}
      />
      <Path d={`M${cx - 16} ${y + 3} L${cx} ${y - 10} L${cx + 16} ${y + 3}`} fill="none" stroke={HANGER} strokeWidth={2.2} strokeLinejoin="round" />
      <PandaFace cx={cx} cy={y + 35} r={8} />
    </G>
  );
}

/** A silk scarf hanging from the rail at 172, folded over it. */
function Scarf({ x, color }: { x: number; color: string }) {
  return (
    <G>
      <Path
        d={`M${x} 176 C${x + 5} 216 ${x - 4} 262 ${x + 1} 318 L${x + 25} 318 C${x + 20} 262 ${x + 29} 216 ${x + 24} 176 Z`}
        fill={color}
        {...line}
        strokeWidth={2}
      />
      <Path
        d={`M${x + 6} 200 C${x + 8} 230 ${x + 3} 262 ${x + 7} 300 M${x + 17} 200 C${x + 19} 230 ${x + 15} 262 ${x + 19} 300`}
        stroke={art.gold}
        strokeWidth={1.6}
        fill="none"
        opacity={0.8}
      />
      {[4, 9, 14, 19, 24].map((dx) => (
        <Path key={dx} d={`M${x + dx} 318 L${x + dx} 328`} stroke={color} strokeWidth={2} strokeLinecap="round" />
      ))}
      <Rect x={x - 1} y={166} width={26} height={12} rx={4} fill={color} {...line} strokeWidth={2} />
    </G>
  );
}

function PriceTag({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <G>
      <Path d={`M${x} 172 L${x} ${y}`} stroke={art.outline} strokeWidth={1.4} />
      <Rect x={x - 17} y={y} width={34} height={17} rx={3} fill={art.white} {...line} strokeWidth={1.6} />
      <SvgText x={x} y={y + 12.5} fontSize={10} fontWeight="700" fill={art.board} textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
}

const SHIRT_ROWS = [
  { rail: 172, shirts: [art.white, art.lantern, art.white] },
  { rail: 276, shirts: [art.lantern, art.white, art.lantern] },
];
const SCARVES = ['#2563EB', art.lantern, '#60A5FA', '#B91C1C', '#2563EB'];
// Stacked on the counter, bottom first.
const FOLDED_SHIRTS = [
  { y: 438, color: art.lantern, width: 84 },
  { y: 422, color: art.white, width: 78 },
  { y: 406, color: art.lantern, width: 84 },
];

/** A stall in a market hall like Beijing's Silk Market: panda T-shirts, silk scarves, a calculator for bargaining. */
function Shop() {
  return (
    <>
      <Rect width={W} height={H} fill="#FFF3E2" />
      {/* The hall's ceiling and lights */}
      <Rect width={W} height={66} fill="#EAE2D5" />
      {[70, 200, 330].map((cx) => (
        <G key={cx}>
          <Ellipse cx={cx} cy={76} rx={46} ry={12} fill="#FFF6D6" opacity={0.75} />
          <Rect x={cx - 26} y={52} width={52} height={14} rx={7} fill="#FFFBEB" stroke="#D9CFBF" strokeWidth={2} />
        </G>
      ))}

      {/* The stall's sign: silk scarves and T-shirts */}
      <Rect x={44} y={90} width={312} height={54} rx={9} fill={art.lantern} {...line} />
      <Rect x={52} y={98} width={296} height={38} rx={6} fill="none" stroke={art.gold} strokeWidth={2} />
      <SvgText x={200} y={126} fontSize={24} fontWeight="700" fill={art.gold} textAnchor="middle">
        丝巾 · T恤
      </SvgText>

      {SHIRT_ROWS.map(({ rail, shirts }) => (
        <G key={rail}>
          <Rect x={22} y={rail - 3} width={184} height={6} rx={3} fill={art.woodDark} />
          {shirts.map((color, index) => (
            <TShirt key={index} cx={58 + index * 56} y={rail + 20} color={color} />
          ))}
        </G>
      ))}
      <PriceTag x={202} y={184} label="¥150" />

      <Rect x={222} y={169} width={164} height={6} rx={3} fill={art.woodDark} />
      {SCARVES.map((color, index) => (
        <Scarf key={index} x={230 + index * 30} color={color} />
      ))}
      <PriceTag x={366} y={338} label="¥120" />

      {/* The counter: folded T-shirts, the calculator, the QR code to pay with, panda toys and a paper fan */}
      <Rect x={-4} y={456} width={W + 8} height={20} fill={art.woodLight} {...line} />
      <Rect x={0} y={476} width={W} height={134} fill={art.wood} />
      {[0, 1, 2, 3].map((index) => (
        <Rect key={index} x={16 + index * 96} y={492} width={80} height={100} rx={7} fill="none" stroke={art.woodDark} strokeWidth={3} />
      ))}
      {FOLDED_SHIRTS.map(({ y, color, width }) => (
        <G key={y}>
          <Rect x={60 - width / 2} y={y} width={width} height={17} rx={3} fill={color} {...line} strokeWidth={1.8} />
          <Path d={`M${70 - width / 2} ${y + 9} L${50 + width / 2} ${y + 9}`} stroke="rgba(0,0,0,0.15)" strokeWidth={1.4} />
        </G>
      ))}
      <Rect x={116} y={402} width={62} height={54} rx={7} fill="#2B3440" {...line} />
      <Rect x={123} y={409} width={48} height={15} rx={2} fill="#C7E6C1" />
      <SvgText x={167} y={421} fontSize={11} fontWeight="700" fill="#1F2937" textAnchor="end">
        150
      </SvgText>
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <Rect key={`${col}-${row}`} x={124 + col * 16} y={430 + row * 12} width={13} height={8} rx={2} fill="#CBD5E1" />
        )),
      )}
      <Path d="M194 452 L246 452 L250 457 L190 457 Z" fill="#94A3B8" />
      <Rect x={194} y={380} width={52} height={72} rx={5} fill={art.white} {...line} />
      <Rect x={194} y={380} width={52} height={15} rx={5} fill="#16A34A" />
      <SvgText x={220} y={392} fontSize={10} fontWeight="700" fill={art.white} textAnchor="middle">
        扫码
      </SvgText>
      <QrCode x={201} y={402} size={38} />
      <Path d="M330 456 L308 428 A30 30 0 0 1 352 428 Z" fill={art.sun} {...line} strokeWidth={1.6} />
      <Path d="M330 456 L316 426 M330 456 L330 422 M330 456 L344 426" stroke={art.beakShade} strokeWidth={1.4} />
      {[284, 372].map((cx) => (
        <G key={cx}>
          <Ellipse cx={cx - 13} cy={446} rx={6} ry={8} fill={art.eye} />
          <Ellipse cx={cx + 13} cy={446} rx={6} ry={8} fill={art.eye} />
          <Ellipse cx={cx} cy={441} rx={16} ry={15} fill={art.white} {...line} strokeWidth={1.6} />
          <PandaFace cx={cx} cy={416} r={13} />
        </G>
      ))}

      <Rect x={0} y={610} width={W} height={110} fill="#E8DFD1" />
      {[0, 80, 160, 240, 320].map((x) => (
        <Path key={x} d={`M${x} 610 L${x - 30} 720`} stroke="#D6CBB8" strokeWidth={2} />
      ))}
      <Path d="M0 662 L400 662" stroke="#D6CBB8" strokeWidth={2} />
    </>
  );
}

function Tier({ y, width, roof }: { y: number; width: number; roof: number }) {
  const left = 200 - width / 2;
  const right = 200 + width / 2;
  return (
    <G>
      <Rect x={left + 8} y={y} width={width - 16} height={roof} fill={art.lantern} {...line} strokeWidth={2} />
      {[left + 22, 200, right - 22].map((cx) => (
        <Rect key={cx} x={cx - 6} y={y + 10} width={12} height={roof - 20} rx={3} fill={art.gold} />
      ))}
      <Path
        d={`M${left - 26} ${y + 2} Q${left - 6} ${y - 2} ${left + 4} ${y - 18} L${right - 4} ${y - 18} Q${right + 6} ${y - 2} ${right + 26} ${y + 2} Q200 ${y - 6} ${left - 26} ${y + 2} Z`}
        fill="#3F4F63"
        {...line}
        strokeWidth={2}
      />
    </G>
  );
}

function Landmark() {
  return (
    <>
      <Sky id="landmark-sky" from="#9EDBFB" to="#F0F9FF" />
      <Circle cx={86} cy={120} r={30} fill="#FDE68A" />
      <Cloud x={220} y={110} scale={0.9} />
      <Cloud x={20} y={220} scale={0.55} />
      <Path d="M250 160 l8 6 l8 -6 M276 182 l7 5 l7 -5" stroke={art.outline} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M0 380 L60 300 L120 342 L190 262 L260 330 L330 280 L400 340 L400 480 L0 480 Z" fill="#B9D7EA" />
      <Path d="M0 452 Q100 400 200 440 T400 430 L400 720 L0 720 Z" fill="#9ED3A6" />
      <Tier y={466} width={120} roof={70} />
      <Tier y={404} width={94} roof={46} />
      <Tier y={350} width={70} roof={36} />
      <Path d="M200 300 L200 334" stroke={art.outline} strokeWidth={3} />
      <Circle cx={200} cy={312} r={4} fill={art.gold} {...line} strokeWidth={1.5} />
      <Circle cx={200} cy={324} r={5} fill={art.gold} {...line} strokeWidth={1.5} />
      <Rect x={186} y={510} width={28} height={26} rx={12} fill="#7A2E2E" />
      <Rect x={126} y={534} width={148} height={14} rx={3} fill={art.stone} {...line} strokeWidth={2} />
      <Path d="M168 720 Q188 630 194 548 L206 548 Q212 630 232 720 Z" fill="#E8DCC4" />
      {[[40, 520, 34], [92, 560, 26], [330, 520, 36], [372, 570, 28], [56, 640, 40], [350, 650, 42]].map(([cx, cy, r]) => (
        <G key={`${cx}-${cy}`}>
          <Rect x={cx - 4} y={cy} width={8} height={r * 0.9} fill={art.woodDark} />
          <Circle cx={cx} cy={cy - r * 0.2} r={r} fill={art.leaf} {...line} strokeWidth={2} />
          <Circle cx={cx + r * 0.35} cy={cy - r * 0.4} r={r * 0.35} fill="rgba(255,255,255,0.18)" />
        </G>
      ))}
    </>
  );
}

function Harbor() {
  return (
    <>
      <Sky id="harbor-sky" from="#9EDBFB" to="#F0F9FF" />
      <Circle cx={300} cy={120} r={34} fill="#FDE68A" />
      <Cloud x={40} y={130} />
      <Cloud x={200} y={220} scale={0.6} />
      <Path d="M0 400 Q120 384 220 396 T400 390 L400 720 L0 720 Z" fill={art.sea} />
      <Path d="M0 470 Q100 456 200 470 T400 466 L400 720 L0 720 Z" fill={art.seaDeep} />
      {[[40, 430], [250, 440], [120, 520], [300, 560], [60, 620], [220, 660]].map(([x, y]) => (
        <Path key={`${x}-${y}`} d={`M${x} ${y} q12 -8 24 0 q12 8 24 0`} stroke={art.seaFoam} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
      ))}
      <Path d="M300 400 Q320 360 360 362 Q392 366 404 396 Z" fill="#9AA8B6" {...line} strokeWidth={2} />
      <Path d="M334 368 L340 244 L364 244 L370 368 Z" fill={art.white} {...line} />
      <Path d="M337 320 L367 320 L368 336 L336 336 Z M339 272 L365 272 L366 288 L338 288 Z" fill={art.lantern} />
      <Rect x={332} y={222} width={40} height={24} rx={4} fill={art.sun} {...line} strokeWidth={2} />
      <Path d="M326 222 L352 204 L378 222 Z" fill={art.lantern} {...line} strokeWidth={2} />
      <SailboatShape x={60} y={330} scale={1.5} />
      <SailboatShape x={210} y={360} scale={0.8} />
      {[24, 64, 104].map((x) => (
        <Rect key={x} x={x} y={600} width={14} height={120} fill={art.woodDark} {...line} strokeWidth={2} />
      ))}
      <Rect x={0} y={600} width={140} height={16} fill={art.wood} {...line} strokeWidth={2} />
    </>
  );
}

const SCENES: Record<SceneKind, ComponentType> = {
  airport: Airport,
  restaurant: Restaurant,
  train: Train,
  hotel: Hotel,
  market: Market,
  shop: Shop,
  taxi: Taxi,
  landmark: Landmark,
  harbor: Harbor,
};

// Where each drawing's point of interest sits (its y), so a wide crop (a card, a header) is centered on it.
const FOCUS_Y: Record<SceneKind, number> = {
  airport: 262,
  restaurant: 160,
  train: 560,
  hotel: 190,
  market: 420,
  shop: 270,
  taxi: 422,
  landmark: 430,
  harbor: 380,
};

export type SceneBackdropProps = {
  scene: SceneKind;
  style?: StyleProp<ViewStyle>;
};

/**
 * An illustrated place (airport hall, noodle shop, station…) that fills its box. A box taller than the drawing
 * shows all of it; a wider one shows a band around the place's point of interest.
 */
export function SceneBackdrop({ scene, style }: SceneBackdropProps) {
  const [aspect, setAspect] = useState<number | null>(null);
  const Scene = SCENES[scene];

  let viewBox = `0 0 ${W} ${H}`;
  if (aspect !== null && aspect < H / W) {
    const height = W * aspect;
    const top = Math.min(Math.max(FOCUS_Y[scene] - height / 2, 0), H - height);
    viewBox = `0 ${top} ${W} ${height}`;
  }

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0) setAspect(height / width);
      }}
      style={[StyleSheet.absoluteFill, style]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
        <Scene />
      </Svg>
    </View>
  );
}
