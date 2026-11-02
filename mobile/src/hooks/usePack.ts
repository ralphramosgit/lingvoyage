import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { ApiError, api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { LocalPack, PackStatus } from '@/types/api';

/**
 * The learner's city pack (issue #38), shared by every screen that shows it.
 *
 * It follows the profile's destination_city: POST /packs/{city} once (which starts a build only if the
 * city has no pack yet), then GET /packs/{city}/status every 3 s while a run is queued or running and
 * at least one screen using it is focused. Once a ready pack exists, GET /packs/{city} fetches it.
 * The state lives in this module, so all tabs share one poller and switching tabs doesn't restart it.
 */

export const POLL_MS = 3000;

/** Errors where trying again won't help: the daily limits, new packs paused, an unknown city. */
const FINAL_ERRORS = new Set(['pack_limit', 'packs_busy', 'packs_paused', 'city_not_found']);

export type PackError = { code: string; message: string };

export type PackState = {
  /** The destination being followed. */
  city: string | null;
  status: PackStatus | null;
  pack: LocalPack | null;
  /** The last request failed: offline, a limit, or new packs paused. Polling carries on after a blip. */
  error: PackError | null;
  loading: boolean;
  /** A build finished while the app was open: the Encounters tab says so once. */
  justFinished: boolean;
};

const EMPTY: PackState = { city: null, status: null, pack: null, error: null, loading: false, justFinished: false };

let state: PackState = EMPTY;
const listeners = new Set<() => void>();
let focusedScreens = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
// Bumped when the city changes (or on retry), so late answers for an earlier request are dropped.
let generation = 0;

function update(patch: Partial<PackState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** True only while the agent is really working: the app never says "researching" otherwise. */
export function isBuilding(status: PackStatus | null): boolean {
  return status?.status === 'queued' || status?.status === 'running';
}

export function canRetry(error: PackError | null): boolean {
  return error !== null && !FINAL_ERRORS.has(error.code);
}

function asPackError(caught: unknown): PackError {
  if (caught instanceof ApiError) return { code: caught.code, message: caught.message };
  return { code: 'network', message: errorMessage(caught, "Couldn't reach the server.") };
}

function stopPolling() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function schedulePoll() {
  stopPolling();
  if (focusedScreens > 0 && state.city && isBuilding(state.status)) timer = setTimeout(() => void poll(), POLL_MS);
}

async function applyStatus(city: string, status: PackStatus, mine: number) {
  if (mine !== generation) return;
  const finished = isBuilding(state.status) && status.status === 'ready';
  update({ status, error: null, loading: false, justFinished: state.justFinished || finished });
  if (status.ready_pack_id && state.pack?.id !== status.ready_pack_id) {
    try {
      const pack = await api.getPack(city);
      if (mine === generation) update({ pack });
    } catch (caught) {
      // The status still shows; retry() loads the pack again.
      if (mine === generation) update({ error: asPackError(caught) });
    }
  }
  schedulePoll();
}

async function poll() {
  timer = null;
  const city = state.city;
  const mine = generation;
  if (!city) return;
  try {
    await applyStatus(city, await api.getPackStatus(city), mine);
  } catch (caught) {
    if (mine !== generation) return;
    update({ error: asPackError(caught) });
    schedulePoll(); // a blip while building: keep polling
  }
}

async function start(city: string) {
  generation += 1;
  const mine = generation;
  stopPolling();
  update({ loading: true, error: null });
  try {
    await applyStatus(city, await api.ensurePack(city), mine);
  } catch (caught) {
    if (mine === generation) update({ loading: false, error: asPackError(caught) });
  }
}

function follow(city: string | null) {
  if (city === state.city) return;
  generation += 1;
  stopPolling();
  update({ ...EMPTY, city });
  if (city) void start(city);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function usePack() {
  const { profile } = useAuth();
  const city = profile?.destination_city ?? null;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    follow(city);
  }, [city]);

  // Poll only while a screen showing the pack is in front.
  useFocusEffect(
    useCallback(() => {
      focusedScreens += 1;
      schedulePoll();
      return () => {
        focusedScreens -= 1;
        if (focusedScreens === 0) stopPolling();
      };
    }, []),
  );

  const retry = useCallback(() => {
    if (state.city) void start(state.city);
  }, []);
  const dismissFinished = useCallback(() => update({ justFinished: false }), []);

  return { ...snapshot, building: isBuilding(snapshot.status), retry, dismissFinished };
}
