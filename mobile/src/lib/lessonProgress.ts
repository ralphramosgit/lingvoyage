import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lingvoyage.lessons.v1';

// Finished lessons as "scenarioId/lessonId". Kept on this device only: it just marks
// which lessons to tick off on the encounter screen.
let finished: ReadonlySet<string> = new Set();
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

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const stored: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(stored)) return;
      finished = new Set([...stored.filter((key): key is string => typeof key === 'string'), ...finished]);
      emit();
    })
    .catch(() => undefined);
  return loading;
}

function lessonKey(scenarioId: string, lessonId: string) {
  return `${scenarioId}/${lessonId}`;
}

export function markLessonFinished(scenarioId: string, lessonId: string) {
  const key = lessonKey(scenarioId, lessonId);
  if (finished.has(key)) return;
  finished = new Set(finished).add(key);
  emit();
  // Wait for the stored list so this write doesn't drop lessons finished earlier.
  void load()
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...finished])))
    .catch(() => undefined);
}

/** Whether a lesson of this scenario has been finished on this device. */
export function useLessonFinished(scenarioId: string | undefined): (lessonId: string) => boolean {
  useEffect(() => {
    void load();
  }, []);
  const snapshot = useSyncExternalStore(subscribe, () => finished);
  return useCallback(
    (lessonId: string) => scenarioId !== undefined && snapshot.has(lessonKey(scenarioId, lessonId)),
    [snapshot, scenarioId],
  );
}
