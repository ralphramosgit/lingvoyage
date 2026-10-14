import {
  BedDouble,
  CarTaxiFront,
  Compass,
  type LucideIcon,
  ShoppingBag,
  TrainFront,
  UtensilsCrossed,
} from 'lucide-react-native';

import type { TintName } from '@/theme/theme';

// The backend names each scenario's icon by its lucide component name.
const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  TrainFront,
  BedDouble,
  ShoppingBag,
  CarTaxiFront,
};

const TINTS: Record<string, TintName> = {
  restaurant: 'sun',
  train: 'sky',
  hotel: 'mint',
};

const FALLBACK_TINTS: TintName[] = ['sky', 'sun', 'mint'];

export function scenarioIcon(name: string): LucideIcon {
  return ICONS[name] ?? Compass;
}

export function scenarioTint(id: string, index = 0): TintName {
  return TINTS[id] ?? FALLBACK_TINTS[index % FALLBACK_TINTS.length];
}
