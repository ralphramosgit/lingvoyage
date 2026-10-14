import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import { api } from './api';

const AUDIO_DIR = 'naviglot-audio';
export const SLOW_RATE = 0.75;

// ---------------------------------------------------------------------------
// Playback state, shared with the UI (which button is loading / playing)
// ---------------------------------------------------------------------------

type PlaybackState = {
  playingKey: string | null;
  loadingKey: string | null;
};

let playback: PlaybackState = { playingKey: null, loadingKey: null };
const listeners = new Set<() => void>();

function setPlayback(patch: Partial<PlaybackState>) {
  playback = { ...playback, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePlayback(): PlaybackState {
  return useSyncExternalStore(subscribe, () => playback);
}

// ---------------------------------------------------------------------------
// The one shared player
// ---------------------------------------------------------------------------

let player: AudioPlayer | null = null;
let statusSubscription: { remove: () => void } | null = null;
let playbackModeReady = false;

/** The recorder flips the audio session into recording mode; this flips it back before playing. */
export function invalidatePlaybackMode() {
  playbackModeReady = false;
}

async function ensurePlaybackMode() {
  if (playbackModeReady) return;
  // allowsRecording false keeps iOS on the loudspeaker instead of the earpiece.
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' });
  playbackModeReady = true;
}

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 200 });
    statusSubscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.didJustFinish) setPlayback({ playingKey: null });
    });
  }
  return player;
}

/** Frees the native player. The next play creates a fresh one. */
export function releasePlayer() {
  statusSubscription?.remove();
  statusSubscription = null;
  player?.remove();
  player = null;
  setPlayback({ playingKey: null, loadingKey: null });
}

export function stopPlayback() {
  player?.pause();
  setPlayback({ playingKey: null });
}

export async function playUri(uri: string, options: { rate?: number; key?: string } = {}) {
  await ensurePlaybackMode();
  const audio = getPlayer();
  audio.pause();
  audio.replace({ uri });
  // 'high' pitch correction keeps slow replay sounding natural instead of deep.
  audio.setPlaybackRate(options.rate ?? 1, 'high');
  audio.play();
  setPlayback({ playingKey: options.key ?? uri });
}

// ---------------------------------------------------------------------------
// Files under Paths.cache/naviglot-audio
// ---------------------------------------------------------------------------

function audioDirectory(): Directory {
  const dir = new Directory(Paths.cache, AUDIO_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function saveBase64Audio(base64: string, fileName: string): string {
  const file = new File(audioDirectory(), fileName);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

/** Writes a base64 MP3 to the cache and plays it. Returns the file URI for replays. */
export async function playBase64(base64: string, fileName: string, options: { rate?: number; key?: string } = {}) {
  const uri = saveBase64Audio(base64, fileName);
  await playUri(uri, options);
  return uri;
}

/** Deletes per-conversation audio (character lines), keeping the phrase cache. */
export function clearConversationAudio() {
  try {
    const dir = audioDirectory();
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.startsWith('line-')) entry.delete();
    }
  } catch {
    // Best effort: the OS clears the cache directory eventually anyway.
  }
}

// ---------------------------------------------------------------------------
// Phrase audio, cached on the device so replays cost no credits
// ---------------------------------------------------------------------------

/** Small, stable FNV-1a hash of the text, used as the cache file name. */
function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, '0')}${text.length.toString(16)}`;
}

const inflight = new Map<string, Promise<string>>();

async function phraseUri(text: string): Promise<string> {
  const fileName = `phrase-${hashText(text)}.mp3`;
  const cached = new File(audioDirectory(), fileName);
  if (cached.exists) return cached.uri;

  const pending = inflight.get(fileName);
  if (pending) return pending;

  const request = api
    .tts(text)
    .then((response) => saveBase64Audio(response.audio_base64, fileName))
    .finally(() => inflight.delete(fileName));
  inflight.set(fileName, request);
  return request;
}

export function phraseKey(text: string, rate = 1): string {
  return `phrase:${rate}:${text}`;
}

/** Plays a phrase via POST /tts, from the on-device cache when it's been played before. */
export async function playPhrase(text: string, options: { rate?: number } = {}) {
  const rate = options.rate ?? 1;
  const key = phraseKey(text, rate);
  setPlayback({ loadingKey: key });
  try {
    const uri = await phraseUri(text.trim());
    await playUri(uri, { rate, key });
  } finally {
    if (playback.loadingKey === key) setPlayback({ loadingKey: null });
  }
}
