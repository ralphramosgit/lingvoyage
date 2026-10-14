import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { fetchProgress } from '@/lib/progress';
import type { EncounterProgress } from '@/types/database';

type ProgressState = {
  rows: EncounterProgress[];
  completedScenarioIds: Set<string>;
  completedCount: number;
  loading: boolean;
  error: boolean;
};

/** The user's encounter_progress rows, refetched whenever the screen comes into focus. */
export function useEncounterProgress(): ProgressState {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [rows, setRows] = useState<EncounterProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      let active = true;
      fetchProgress(userId)
        .then((result) => {
          if (!active) return;
          setRows(result);
          setError(false);
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const completedRows = rows.filter((row) => row.completed);
  return {
    rows,
    completedScenarioIds: new Set(completedRows.map((row) => row.scenario_id)),
    completedCount: completedRows.length,
    loading,
    error,
  };
}
