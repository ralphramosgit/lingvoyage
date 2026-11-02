import {
  CheckCheck,
  CircleCheck,
  FileText,
  Flag,
  ListChecks,
  PenLine,
  Search,
  TriangleAlert,
} from 'lucide-react-native';

import type { LocalPack, PackStage, PackStep } from '@/types/api';

/** The pipeline's stages, in order, as the activity screen names them. */
export const STAGES: { id: PackStage; label: string }[] = [
  { id: 'plan', label: 'Planning' },
  { id: 'research', label: 'Researching' },
  { id: 'deep_dive', label: 'Reading menus' },
  { id: 'verify', label: 'Checking facts' },
  { id: 'generate', label: 'Writing your lessons and scenes' },
  { id: 'publish', label: 'Publishing' },
];

type IconProps = { size: number; color: string };

/** One icon per kind of trace step: a search, a page read, a fact found… */
export function StepIcon({ kind, ...props }: IconProps & { kind: string }) {
  switch (kind) {
    case 'search':
      return <Search {...props} />;
    case 'read':
      return <FileText {...props} />;
    case 'found':
      return <CircleCheck {...props} />;
    case 'write':
      return <PenLine {...props} />;
    case 'check':
      return <ListChecks {...props} />;
    case 'done':
      return <CheckCheck {...props} />;
    case 'error':
      return <TriangleAlert {...props} />;
    default:
      return <Flag {...props} />;
  }
}

/** "food", "menu · chen mapo tofu", "scene · airport", "notes · getting around". */
export function workerLabel(worker: string | null | undefined): string {
  if (!worker) return '';
  const [kind, key] = worker.split(':');
  if (!key) return kind.replace(/_/g, ' ');
  const names: Record<string, string> = { menu: 'menu', scene: 'scene', unit: 'notes', quiz: 'quiz' };
  return `${names[kind] ?? kind} · ${key.replace(/-/g, ' ')}`;
}

/** What a step reads as to a screen reader: "food agent, searched: Chengdu mapo tofu restaurants". */
export function stepAccessibilityLabel(step: PackStep): string {
  const verbs: Record<string, string> = { search: 'searched', read: 'read', found: 'found', write: 'writing', check: 'checked' };
  const who = step.worker ? `${workerLabel(step.worker)}: ` : '';
  return `${who}${verbs[step.kind] ? `${verbs[step.kind]}, ` : ''}${step.text}`;
}

/** "5 scenes, 7 units with local notes, 3 quizzes". */
export function packSummary(pack: LocalPack): string {
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return [
    plural(pack.encounters.length, 'scene', 'scenes'),
    plural(pack.unit_notes.length, 'unit with local notes', 'units with local notes'),
    plural(pack.quizzes.length, 'quiz', 'quizzes'),
  ].join(', ');
}

/** "Oct 31" in the learner's locale. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "Oct 31" for a plain date like "2026-10-31", read as a local day (not midnight UTC, which shifts it). */
export function shortDay(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
