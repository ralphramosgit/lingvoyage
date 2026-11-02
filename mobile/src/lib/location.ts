import * as Location from 'expo-location';

import type { City } from '@/types/api';

/** Farther than this from every supported city: "You're not near a city we support yet". */
export const NEAR_CITY_KM = 150;

/** Great-circle distance in kilometres. */
export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function nearestCity(cities: City[], lat: number, lng: number): { city: City; km: number } | null {
  let best: { city: City; km: number } | null = null;
  for (const city of cities) {
    const km = distanceKm(lat, lng, city.lat, city.lng);
    if (!best || km < best.km) best = { city, km };
  }
  return best;
}

export type NearestResult =
  | { kind: 'found'; city: City; km: number }
  | { kind: 'far' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'error' };

/**
 * Asks for the learner's location once (foreground only) and picks the nearest supported city.
 * The coordinates are only used here: they're never stored or sent anywhere.
 */
export async function findNearestCity(cities: City[]): Promise<NearestResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { kind: 'denied', canAskAgain: permission.canAskAgain };
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const nearest = nearestCity(cities, position.coords.latitude, position.coords.longitude);
    if (!nearest || nearest.km > NEAR_CITY_KM) return { kind: 'far' };
    return { kind: 'found', ...nearest };
  } catch {
    return { kind: 'error' };
  }
}
