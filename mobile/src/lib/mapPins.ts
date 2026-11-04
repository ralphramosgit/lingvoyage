import type { Ref } from 'react';

import { cityLook, type LabelSide } from '@/lib/cityVisuals';
import type { City } from '@/types/api';

/** The destination map (issue #66): what the screens give it, and what they can ask of it. */
export type ChinaMapHandle = {
  /** Zooms out to every city. */
  showAll: () => void;
  focus: (city: City) => void;
};

export type ChinaMapProps = {
  cities: City[];
  /** The learner's destination, if they have one: its pin is highlighted. */
  selected: string | null;
  /** A city's pin was tapped. `nearby` are the coming-soon cities hidden under it, if it's open. */
  onPick: (city: City, nearby: City[]) => void;
  /** How much of the map's top and bottom the screen's own controls cover, in points. */
  overlay?: { top: number; bottom: number };
  ref?: Ref<ChinaMapHandle>;
};

/** Sizes of a pin, in points. A pin is the city's badge, a point under it, and its name. */
export const PIN = {
  badge: { open: 40, soon: 32 },
  label: { open: 22, soon: 18 },
  point: 6, // how far the point reaches below the badge
  gap: 3,
  sideLabel: 92, // room for a name beside the badge
  belowLabel: { open: 112, soon: 96 }, // room for a name under it
} as const;

export type PinBox = {
  width: number;
  height: number;
  /** Where the point touches the map, from the top left. */
  tipX: number;
  tipY: number;
  badgeLeft: number;
  /** The name's slot. */
  labelLeft: number;
  labelTop: number;
  labelWidth: number;
};

/** A pin's layout, so the map can put the point (not the middle of the view) on the city. */
export function pinBox(open: boolean, side: LabelSide): PinBox {
  const badge = open ? PIN.badge.open : PIN.badge.soon;
  const label = open ? PIN.label.open : PIN.label.soon;
  const tipY = badge + PIN.point;
  if (side === 'below') {
    const width = open ? PIN.belowLabel.open : PIN.belowLabel.soon;
    return {
      width,
      height: tipY + PIN.gap + label,
      tipX: width / 2,
      tipY,
      badgeLeft: (width - badge) / 2,
      labelLeft: 0,
      labelTop: tipY + PIN.gap,
      labelWidth: width,
    };
  }
  const width = badge + PIN.gap + PIN.sideLabel;
  const badgeLeft = side === 'right' ? 0 : PIN.sideLabel + PIN.gap;
  return {
    width,
    height: tipY,
    tipX: badgeLeft + badge / 2,
    tipY,
    badgeLeft,
    labelLeft: side === 'right' ? badge + PIN.gap : 0,
    labelTop: (badge - label) / 2,
    labelWidth: PIN.sideLabel,
  };
}

/** A pin on the map, and the coming-soon cities hidden under it until the map is zoomed in. */
export type PinGroup = { city: City; hidden: City[] };

type Rect = { left: number; top: number; right: number; bottom: number };

/** Where a pin's badge (with its point) and its name sit on screen, with the point at (x, y). Names are measured roughly. */
function pinRects(city: City, x: number, y: number): Rect[] {
  const open = city.available;
  const side = cityLook(city.slug).label;
  const box = pinBox(open, side);
  const badge = open ? PIN.badge.open : PIN.badge.soon;
  const left = x - box.tipX;
  const top = y - box.tipY;
  const nameWidth = Math.min(box.labelWidth, city.name.length * (open ? 7.6 : 6.6) + (open ? 18 : 14));
  const slack = box.labelWidth - nameWidth;
  const nameLeft = left + box.labelLeft + (side === 'left' ? slack : side === 'right' ? 0 : slack / 2);
  const nameTop = top + box.labelTop;
  return [
    { left: left + box.badgeLeft, top, right: left + box.badgeLeft + badge, bottom: top + badge + PIN.point },
    { left: nameLeft, top: nameTop, right: nameLeft + nameWidth, bottom: nameTop + (open ? PIN.label.open : PIN.label.soon) },
  ];
}

const MARGIN = 3;

function overlaps(a: Rect[], b: Rect[]): boolean {
  return a.some((one) =>
    b.some(
      (other) =>
        one.left < other.right + MARGIN &&
        other.left < one.right + MARGIN &&
        one.top < other.bottom + MARGIN &&
        other.top < one.bottom + MARGIN,
    ),
  );
}

/**
 * Which pins to draw for the map's current view. Open cities always get their own pin. A coming-soon
 * city whose pin would overlap another goes under that one: zoomed out, Suzhou, Hangzhou and Nanjing go
 * under Shanghai, and Shenzhen under Guangzhou. Positions use Web Mercator, the projection both Apple
 * and Google maps draw with.
 */
export function groupPins(cities: City[], longitudeDelta: number, mapWidth: number): PinGroup[] {
  const radians = Math.PI / 180;
  const scale = mapWidth / (longitudeDelta * radians); // points per radian
  const groups: (PinGroup & { rects: Rect[] })[] = [];
  // Open cities first, so a coming-soon one goes under the open pin it would cover.
  const ordered = [...cities.filter((city) => city.available), ...cities.filter((city) => !city.available)];
  for (const city of ordered) {
    const x = city.lng * radians * scale;
    const y = -Math.log(Math.tan(Math.PI / 4 + (city.lat * radians) / 2)) * scale;
    const rects = pinRects(city, x, y);
    const near = city.available ? undefined : groups.find((group) => overlaps(group.rects, rects));
    if (near) near.hidden.push(city);
    else groups.push({ city, hidden: [], rects });
  }
  return groups.map(({ city, hidden }) => ({ city, hidden }));
}
