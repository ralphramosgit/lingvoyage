import {
  AudioLines,
  Banknote,
  BedDouble,
  BookOpen,
  Clock,
  Gift,
  Hand,
  HandHeart,
  Hash,
  LifeBuoy,
  type LucideIcon,
  MessageSquareText,
  PlaneLanding,
  ShoppingBag,
  Signpost,
  Soup,
  TrainFront,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react-native';

import type { PartId } from '@/content/lessons/types';
import type { TintName } from '@/theme/theme';

const ICONS: Record<string, LucideIcon> = {
  AudioLines,
  Banknote,
  BedDouble,
  Clock,
  Gift,
  Hand,
  HandHeart,
  Hash,
  LifeBuoy,
  MessageSquareText,
  PlaneLanding,
  ShoppingBag,
  Signpost,
  Soup,
  TrainFront,
  UserRound,
  UtensilsCrossed,
};

/** A unit's icon, named by its lucide component name in the content files. For props that take an icon. */
export function unitIcon(name: string): LucideIcon {
  return ICONS[name] ?? BookOpen;
}

type IconProps = { size: number; color: string; strokeWidth?: number };

/** A unit's icon, rendered. */
export function UnitIcon({ name, ...props }: IconProps & { name: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon {...props} />;
}

export const PART_TINTS: Record<PartId, TintName> = {
  basics: 'sky',
  trip: 'sun',
  culture: 'mint',
};
