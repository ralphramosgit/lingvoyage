import { useCallback, useEffect, useState } from 'react';

import { api, errorMessage } from '@/lib/api';
import type { City } from '@/types/api';

// The supported cities rarely change: kept for the life of the app, like useScenarios.
let cachedCities: City[] | null = null;

type CitiesState = {
  cities: City[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useCities(): CitiesState {
  const [cities, setCities] = useState<City[] | null>(cachedCities);
  const [loading, setLoading] = useState(cachedCities === null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getCities();
      cachedCities = result;
      setCities(result);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't load the cities."));
    } finally {
      setLoading(false);
    }
  }, []);

  // First load. State is only set from the promise callbacks, never synchronously in the effect.
  useEffect(() => {
    if (cachedCities !== null) return undefined;
    let active = true;
    api
      .getCities()
      .then((result) => {
        cachedCities = result;
        if (active) setCities(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught, "Couldn't load the cities."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { cities, loading, error, reload };
}

/** A city's name for display, e.g. "Chengdu", falling back to the slug while the list loads. */
export function cityName(cities: City[] | null, slug: string): string {
  return cities?.find((city) => city.slug === slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}
