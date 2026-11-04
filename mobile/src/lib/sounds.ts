import { type AudioPlayer, createAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

import { ensurePlaybackMode, isMicOpen, markSessionRelease } from './audio';

// Sound effects (issue #76): soft, short sounds for taps, answers and the voyage. Each has its own
// player, apart from the one that speaks the Chinese, so a tap never cuts a phrase off. They're made by
// scripts/make-sounds.mjs: to change one, change its recipe there and run `npm run sounds`.
const SOURCES = {
  /** Any button or card (PressableScale's default). */
  tap: require('@/assets/sounds/tap.wav'),
  /** Picking an answer, a pair or a city pin. */
  select: require('@/assets/sounds/select.wav'),
  tilePlace: require('@/assets/sounds/tilePlace.wav'),
  tileRemove: require('@/assets/sounds/tileRemove.wav'),
  /** Segmented tabs: scene sets, quiz sections, course parts, pinyin initials. */
  segment: require('@/assets/sounds/segment.wav'),
  /** The tab bar, as the boat sails to the new tab. */
  swish: require('@/assets/sounds/swish.wav'),
  toggleOn: require('@/assets/sounds/toggleOn.wav'),
  toggleOff: require('@/assets/sounds/toggleOff.wav'),
  correct: require('@/assets/sounds/correct.wav'),
  wrong: require('@/assets/sounds/wrong.wav'),
  match: require('@/assets/sounds/match.wav'),
  hint: require('@/assets/sounds/hint.wav'),
  /** A harp flourish: a lesson, checkpoint, quiz, encounter or city pack done. */
  complete: require('@/assets/sounds/complete.wav'),
  goal: require('@/assets/sounds/goal.wav'),
  hullHit: require('@/assets/sounds/hullHit.wav'),
  sink: require('@/assets/sounds/sink.wav'),
  patch: require('@/assets/sounds/patch.wav'),
  send: require('@/assets/sounds/send.wav'),
  receive: require('@/assets/sounds/receive.wav'),
  micOff: require('@/assets/sounds/micOff.wav'),
  open: require('@/assets/sounds/open.wav'),
  close: require('@/assets/sounds/close.wav'),
  /** Tapping the seagull. */
  chirp: require('@/assets/sounds/chirp.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

// A little under the spoken Chinese, which plays at full volume.
const VOLUME = 0.8;
// A sound's length before its file has loaded: a guess on the long side, for the recorder's wait.
const UNKNOWN_LENGTH_MS = 2000;

let enabled = true;
const players = new Map<SoundName, AudioPlayer>();

function playerFor(name: SoundName): AudioPlayer {
  let player = players.get(name);
  if (!player) {
    player = createAudioPlayer(SOURCES[name]);
    players.set(name, player);
  }
  return player;
}

/** The Sound effects setting. On loads every sound, so each one's first play has no delay; off frees them. */
export function setSoundsEnabled(on: boolean) {
  enabled = on;
  if (on) {
    (Object.keys(SOURCES) as SoundName[]).forEach(playerFor);
    return;
  }
  players.forEach((player) => player.remove());
  players.clear();
}

async function start(player: AudioPlayer) {
  await ensurePlaybackMode();
  // Checked again: the mic may have started opening while the mode was set.
  if (!enabled || isMicOpen()) return;
  // Played before, it waits at its end (or is still going): back to the start first.
  if (player.currentTime > 0) await player.seekTo(0);
  // Set every time: expo-audio can halve a player's volume after an iOS audio interruption.
  player.volume = VOLUME;
  player.play();
  // Like a spoken line, a sound that finishes lets iOS shut the audio session, which would cut off a
  // recording starting just then. The recorder waits until it's done.
  markSessionRelease(Date.now() + (player.duration > 0 ? player.duration * 1000 : UNKNOWN_LENGTH_MS));
}

export function soundsEnabled() {
  return enabled;
}

/** Plays a sound effect, unless they're off or the mic is open. */
export function playSound(name: SoundName) {
  if (!enabled || isMicOpen()) return;
  start(playerFor(name)).catch(() => undefined);
}

/** A swoosh as a sheet or menu opens, and another as it closes or goes away. */
export function useSheetSound(open = true) {
  useEffect(() => {
    if (!open) return undefined;
    playSound('open');
    return () => playSound('close');
  }, [open]);
}
