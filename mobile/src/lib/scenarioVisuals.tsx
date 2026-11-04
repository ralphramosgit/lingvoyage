import {
  BedDouble,
  CarTaxiFront,
  Compass,
  Landmark,
  PlaneLanding,
  ShoppingBag,
  Store,
  TrainFront,
  UtensilsCrossed,
} from 'lucide-react-native';

import type { TintName } from '@/theme/theme';

const TINTS: Record<string, TintName> = {
  airport: 'sky',
  restaurant: 'sun',
  train: 'sky',
  hotel: 'mint',
  taxi: 'sun',
  shopping: 'mint',
};

// Local encounters (local-<city>-<place>) have their own ids, so they're tinted by their icon.
const ICON_TINTS: Record<string, TintName> = {
  PlaneLanding: 'sky',
  TrainFront: 'sky',
  CarTaxiFront: 'sky',
  UtensilsCrossed: 'sun',
  ShoppingBag: 'sun',
  Store: 'mint',
  BedDouble: 'mint',
  Landmark: 'mint',
};

const FALLBACK_TINTS: TintName[] = ['sky', 'sun', 'mint'];

export function scenarioTint(id: string, index = 0, icon?: string): TintName {
  return TINTS[id] ?? (icon ? ICON_TINTS[icon] : undefined) ?? FALLBACK_TINTS[index % FALLBACK_TINTS.length];
}

export type SceneKind =
  | 'airport'
  | 'restaurant'
  | 'train'
  | 'hotel'
  | 'market'
  | 'shop'
  | 'taxi'
  | 'landmark'
  | 'harbor';

const SCENE_KINDS: Record<string, SceneKind> = {
  PlaneLanding: 'airport',
  UtensilsCrossed: 'restaurant',
  TrainFront: 'train',
  BedDouble: 'hotel',
  ShoppingBag: 'market',
  Store: 'shop',
  CarTaxiFront: 'taxi',
  Landmark: 'landmark',
};

/** Which illustrated place a scene is drawn in, from its icon. */
export function sceneKind(icon: string): SceneKind {
  return SCENE_KINDS[icon] ?? 'harbor';
}

type IconProps = { size: number; color: string; strokeWidth?: number };

/** The scenario's icon, named by its lucide component name in the backend content. */
export function ScenarioIcon({ name, ...props }: IconProps & { name: string }) {
  switch (name) {
    case 'UtensilsCrossed':
      return <UtensilsCrossed {...props} />;
    case 'TrainFront':
      return <TrainFront {...props} />;
    case 'BedDouble':
      return <BedDouble {...props} />;
    case 'PlaneLanding':
      return <PlaneLanding {...props} />;
    case 'ShoppingBag':
      return <ShoppingBag {...props} />;
    case 'Store':
      return <Store {...props} />;
    case 'CarTaxiFront':
      return <CarTaxiFront {...props} />;
    case 'Landmark':
      return <Landmark {...props} />;
    default:
      return <Compass {...props} />;
  }
}
