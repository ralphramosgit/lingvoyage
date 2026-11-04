import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { api } from './api';

const AUDIO_DIR = 'lingvoyage-audio';
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
// From when the mic starts opening until playback mode is back. Sound effects stay quiet then: they'd
// be heard in the recording, and switching to playback mode for one would end it.
let micOpen = false;

/** Called by the recorder as it starts opening the mic. */
export function markMicOpening() {
  micOpen = true;
}

export function isMicOpen() {
  return micOpen;
}

/** The recorder flips the audio session into recording mode; this flips it back before playing. */
export function invalidatePlaybackMode() {
  playbackModeReady = false;
}

export async function ensurePlaybackMode() {
  if (playbackModeReady) return;
  // The mic stream leaves iOS in 'measurement' mode, which plays everything much quieter: every reply
  // after the learner speaks. expo-audio only resets the mode when it sets a category without options,
  // and 'doNotMix' is the one without, so it goes first. 'duckOthers' then keeps the reset mode.
  if (Platform.OS === 'ios') {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'doNotMix' });
  }
  // allowsRecording false keeps iOS on the loudspeaker instead of the earpiece.
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' });
  playbackModeReady = true;
}

/** Back to playback right away, e.g. when a recording ends, so the next reply doesn't start mid-switch. */
export async function restorePlaybackMode() {
  playbackModeReady = false;
  try {
    await ensurePlaybackMode();
  } finally {
    micOpen = false;
  }
}

// On iOS, expo-audio deactivates the audio session about 100 ms after a player pauses or
// finishes, without checking for an active recorder. If recording starts inside that window,
// iOS cuts it off after a fraction of a second. We note when that can happen and let the
// recorder wait it out (see waitForAudioSessionToSettle).
const SESSION_SETTLE_MS = 300;
let lastSessionReleaseAt = 0;

/** `at` can be in the future: a sound effect notes when it will finish as it starts. */
export function markSessionRelease(at = Date.now()) {
  lastSessionReleaseAt = Math.max(lastSessionReleaseAt, at);
}

/** Resolves once any pending audio-session deactivation from playback has happened. */
export async function waitForAudioSessionToSettle() {
  const wait = SESSION_SETTLE_MS - (Date.now() - lastSessionReleaseAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 200 });
    statusSubscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.didJustFinish) {
        markSessionRelease();
        setPlayback({ playingKey: null });
      }
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
  // Pausing an idle player still schedules a session deactivation on iOS, so only pause if needed.
  if (player?.playing) {
    player.pause();
    markSessionRelease();
  }
  setPlayback({ playingKey: null });
}

// Now and then a line doesn't start (iOS was still settling the audio session) and nothing says so: the
// learner had to tap replay. If it still hasn't started after this long, it's played again, once.
const START_CHECK_MS = 1000;
let startCheck: ReturnType<typeof setTimeout> | null = null;

function checkStarted(audio: AudioPlayer, key: string) {
  if (startCheck) clearTimeout(startCheck);
  startCheck = setTimeout(() => {
    startCheck = null;
    if (player !== audio || playback.playingKey !== key) return; // released, stopped, finished or replaced
    if (!audio.playing && audio.currentTime < 0.1) audio.play();
  }, START_CHECK_MS);
}

export async function playUri(uri: string, options: { rate?: number; key?: string } = {}) {
  await ensurePlaybackMode();
  const audio = getPlayer();
  const key = options.key ?? uri;
  // No pause() first: replace() stops the current line itself, and pause() also has iOS shut the audio
  // session 100 ms later, which could cut off the new line before it got going.
  // With 'duckOthers', expo-audio halves a playing player's volume when the iOS audio session is
  // interrupted (recording can do that), and only restores it if iOS says to resume. This one player is
  // reused for every line, so without this each reply could play at half the volume of the last.
  audio.volume = 1;
  audio.replace({ uri });
  // 'high' pitch correction keeps slow replay sounding natural instead of deep.
  audio.setPlaybackRate(options.rate ?? 1, 'high');
  audio.play();
  setPlayback({ playingKey: key });
  checkStarted(audio, key);
}

// ---------------------------------------------------------------------------
// Files under Paths.cache/lingvoyage-audio
// ---------------------------------------------------------------------------

function audioDirectory(): Directory {
  const dir = new Directory(Paths.cache, AUDIO_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function saveBase64Audio(base64: string, fileName: string): string {
  const file = new File(audioDirectory(), fileName);
  file.create({ overwrite: true });
  file.writeSync(base64, { encoding: 'base64' });
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

// Bumped on every playPhrase, so quick taps (word tiles, answer options) play only the last one, even
// when an earlier phrase's first download finishes after it.
let latestPhrase = 0;

/** Plays a phrase via POST /tts, from the on-device cache when it's been played before. */
export async function playPhrase(text: string, options: { rate?: number } = {}) {
  const rate = options.rate ?? 1;
  const key = phraseKey(text, rate);
  const request = (latestPhrase += 1);
  setPlayback({ loadingKey: key });
  try {
    const uri = await phraseUri(text.trim());
    if (request !== latestPhrase) return;
    await playUri(uri, { rate, key });
  } finally {
    if (playback.loadingKey === key) setPlayback({ loadingKey: null });
  }
}
