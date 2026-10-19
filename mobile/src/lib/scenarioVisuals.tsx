import { BedDouble, CarTaxiFront, Compass, PlaneLanding, ShoppingBag, TrainFront, UtensilsCrossed } from 'lucide-react-native';

import type { TintName } from '@/theme/theme';

const TINTS: Record<string, TintName> = {
  airport: 'sky',
  restaurant: 'sun',
  train: 'sky',
  hotel: 'mint',
};

const FALLBACK_TINTS: TintName[] = ['sky', 'sun', 'mint'];

export function scenarioTint(id: string, index = 0): TintName {
  return TINTS[id] ?? FALLBACK_TINTS[index % FALLBACK_TINTS.length];
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
    case 'CarTaxiFront':
      return <CarTaxiFront {...props} />;
    default:
      return <Compass {...props} />;
  }
}
