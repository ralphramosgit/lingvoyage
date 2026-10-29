import { Ear, Languages, Layers, type LucideIcon, Shuffle } from 'lucide-react-native';

import { findUnit } from '@/content/lessons/units';
import type { Quiz, QuizSectionId } from '@/content/quizzes/types';
import type { TintName } from '@/theme/theme';

import { PART_TINTS, UnitIcon, unitIcon } from './unitVisuals';

const ICONS: Record<string, LucideIcon> = { Ear, Languages, Layers, Shuffle };

/** A quiz's icon, named by its lucide component name: one of the quiz icons, or any unit icon. For props that take an icon. */
export function quizIcon(name: string): LucideIcon {
  return ICONS[name] ?? unitIcon(name);
}

type IconProps = { size: number; color: string; strokeWidth?: number };

/** A quiz's icon, rendered. */
export function QuizIcon({ name, ...props }: IconProps & { name: string }) {
  const Icon = ICONS[name];
  return Icon ? <Icon {...props} /> : <UnitIcon name={name} {...props} />;
}

const SECTION_TINTS: Record<QuizSectionId, TintName> = {
  units: 'sky',
  mixed: 'sky',
  skills: 'mint',
};

/** Unit quizzes take their unit's part color, as on the Lessons tab. */
export function quizTint(quiz: Quiz): TintName {
  const unit = findUnit(quiz.unitId);
  return unit ? PART_TINTS[unit.part] : SECTION_TINTS[quiz.section];
}
