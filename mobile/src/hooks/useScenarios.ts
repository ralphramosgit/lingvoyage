import { useCallback, useEffect, useState } from 'react';

import { api, errorMessage } from '@/lib/api';
import type { Scenario } from '@/types/api';

// Last good response, kept for the life of the app so screens open instantly.
let cachedScenarios: Scenario[] | null = null;

type ScenariosState = {
  scenarios: Scenario[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useScenarios(): ScenariosState {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(cachedScenarios);
  const [loading, setLoading] = useState(cachedScenarios === null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getScenarios();
      cachedScenarios = result;
      setScenarios(result);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't load encounters."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cachedScenarios === null) void reload();
  }, [reload]);

  return { scenarios, loading, error, reload };
}

/** One scenario by id, loading the list if the cache is empty (e.g. after a reload). */
export function useScenario(id: string | undefined) {
  const { scenarios, loading, error, reload } = useScenarios();
  const scenario = scenarios?.find((item) => item.id === id) ?? null;
  return { scenario, loading, error, reload, notFound: !loading && !error && scenarios !== null && !scenario };
}
