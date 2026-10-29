import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

// Lessons tab progress, kept on this device only, separate from the encounter practice
// lessons (lessonProgress.ts). One object, so new fields fit without a new key.
const STORAGE_KEY = 'lingvoyage.units.v1';

export type LessonResult = {
  finishedAt: string;
  /** Best score so far. */
  firstTry: number;
  total: number;
};

export type UnitProgress = {
  /** Keyed "unitId/lessonId". */
  lessons: Readonly<Record<string, LessonResult>>;
  /** Keyed by unit id. */
  checkpoints: Readonly<Record<string, LessonResult>>;
  /** The unit opened most recently. */
  lastUnitId?: string;
};

let progress: UnitProgress = { lessons: {}, checkpoints: {} };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isResult(value: unknown): value is LessonResult {
  if (typeof value !== 'object' || value === null) return false;
  const { finishedAt, firstTry, total } = value as Record<string, unknown>;
  return typeof finishedAt === 'string' && typeof firstTry === 'number' && typeof total === 'number';
}

function readResults(value: unknown): Record<string, LessonResult> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, LessonResult] => isResult(entry[1])));
}

function best(current: LessonResult | undefined, next: LessonResult): LessonResult {
  return current && current.firstTry >= next.firstTry ? current : next;
}

function mergeResults(a: Readonly<Record<string, LessonResult>>, b: Readonly<Record<string, LessonResult>>) {
  const merged = { ...a };
  for (const [key, result] of Object.entries(b)) merged[key] = best(merged[key], result);
  return merged;
}

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const stored: unknown = raw ? JSON.parse(raw) : {};
      if (typeof stored !== 'object' || stored === null) return;
      const { lessons, checkpoints, lastUnitId } = stored as Record<string, unknown>;
      // Anything finished before the stored copy loaded wins over it.
      progress = {
        lessons: mergeResults(readResults(lessons), progress.lessons),
        checkpoints: mergeResults(readResults(checkpoints), progress.checkpoints),
        lastUnitId: progress.lastUnitId ?? (typeof lastUnitId === 'string' ? lastUnitId : undefined),
      };
      emit();
    })
    .catch(() => undefined);
  return loading;
}

function update(next: UnitProgress) {
  progress = next;
  emit();
  // Wait for the stored copy so this write doesn't drop progress saved earlier.
  void load()
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress)))
    .catch(() => undefined);
}

export function lessonKey(unitId: string, lessonId: string) {
  return `${unitId}/${lessonId}`;
}

function result(firstTry: number, total: number): LessonResult {
  return { finishedAt: new Date().toISOString(), firstTry, total };
}

export function recordLesson(unitId: string, lessonId: string, firstTry: number, total: number) {
  const key = lessonKey(unitId, lessonId);
  update({ ...progress, lessons: { ...progress.lessons, [key]: best(progress.lessons[key], result(firstTry, total)) } });
}

export function recordCheckpoint(unitId: string, firstTry: number, total: number) {
  update({
    ...progress,
    checkpoints: { ...progress.checkpoints, [unitId]: best(progress.checkpoints[unitId], result(firstTry, total)) },
  });
}

export function setLastUnit(unitId: string) {
  if (progress.lastUnitId !== unitId) update({ ...progress, lastUnitId: unitId });
}

/** Lessons tab progress on this device. Starts empty and fills in once the stored copy loads. */
export function useUnitProgress(): UnitProgress {
  useEffect(() => {
    void load();
  }, []);
  return useSyncExternalStore(subscribe, () => progress);
}
