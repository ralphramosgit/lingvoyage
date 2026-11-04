// Writes the app's sound effects (issue #76) to assets/sounds/ as small mono WAVs.
//
// Every sound is synthesized here from sine waves and filtered noise: no sample packs, nothing to
// license, and each one is easy to tweak. Change a recipe below, run `npm run sounds`, and the app
// picks up the new file (src/lib/sounds.ts lists them). The noise is seeded, so the same recipes
// always write the same files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** mulberry32: a tiny seeded random number generator. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quick rise, then an exponential fade with time constant `decay` (seconds). */
const pluck = (attack, decay) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** Smooth rise to full at `peakAt`, smooth fall to silence at `end`. */
const swell = (peakAt, end) => (t) => {
  if (t >= end) return 0;
  if (t < peakAt) return Math.sin((Math.PI / 2) * (t / peakAt)) ** 2;
  return Math.cos((Math.PI / 2) * ((t - peakAt) / (end - peakAt))) ** 2;
};

/** A pitch (Hz) that slides from `from` to `to` over `over` seconds, then holds. */
const glide = (from, to, over) => (t) => from * (to / from) ** Math.min(t / over, 1);

// Partials as [ratio to the base pitch, level, decay scale]. Higher partials fade sooner.
const PURE = [[1, 1]];
const SOFT = [[1, 1], [3, 0.11], [5, 0.04]]; // close to a triangle wave: round and gentle
const WARM = [[1, 1], [2, 0.3, 0.7], [3, 0.12, 0.5]]; // low notes, with enough overtones for a phone speaker
const BELL = [[1, 1], [2, 0.22, 0.55], [3, 0.08, 0.35], [4.16, 0.05, 0.2]]; // a glassy mallet bell
const WOOD = [[1, 1], [2.57, 0.35, 0.4], [4.3, 0.12, 0.25]]; // a little wood block
const METAL = [[1, 1], [2.32, 0.5, 0.5], [4.25, 0.25, 0.3]]; // a hammer on a nail
const REED = [[1, 1], [2, 0.45], [3, 0.22], [4, 0.1]]; // a bit nasal, for the seagull
const HARP = [[1, 1], [2, 0.3, 0.5], [3, 0.1, 0.3]]; // a plucked string

/** Adds `voice(t)` into `out` for `seconds`, starting `at` seconds in. */
function mix(out, at, seconds, voice) {
  const start = Math.round(at * RATE);
  const count = Math.round(seconds * RATE);
  for (let i = 0; i < count && start + i < out.length; i += 1) out[start + i] += voice(i / RATE);
}

/** A pitched voice. `freq` is Hz or a function of time; `env` is the loudness over time, 0 to 1. */
function tone(out, at, { seconds, freq, env, partials = PURE, gain = 1, vibrato = null }) {
  const phases = partials.map(() => 0);
  const pitchAt = typeof freq === 'function' ? freq : () => freq;
  mix(out, at, seconds, (t) => {
    const wobble = vibrato ? 1 + vibrato.depth * Math.sin(2 * Math.PI * vibrato.rate * t) : 1;
    const base = pitchAt(t) * wobble;
    let sample = 0;
    partials.forEach(([ratio, level, decayScale = 1], k) => {
      const f = base * ratio;
      phases[k] += (2 * Math.PI * f) / RATE;
      if (f >= RATE / 2) return;
      // Partials with a decay scale fade faster: env(t) ** (1 / scale) for a plucked envelope.
      const shape = decayScale === 1 ? env(t) : env(t) ** (1 / decayScale);
      sample += level * Math.sin(phases[k]) * shape;
    });
    return gain * sample;
  });
}

/** RBJ biquad coefficients, normalized. Band-pass is the constant 0 dB peak kind. */
function biquad(type, f, q) {
  const w = (2 * Math.PI * Math.min(f, RATE * 0.45)) / RATE;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b;
  if (type === 'lowpass') b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else b = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

/** Filtered white noise. `filter` is [type, Hz or a function of time, q]. */
function noise(out, at, { seconds, env, filter, gain = 1, seed = 1 }) {
  const rand = seeded(seed);
  const [type, freq, q = 0.7] = filter;
  const freqAt = typeof freq === 'function' ? freq : () => freq;
  let c = biquad(type, freqAt(0), q);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let i = 0;
  mix(out, at, seconds, (t) => {
    // A moving filter only needs new coefficients every few samples.
    if (typeof freq === 'function' && i % 16 === 0) c = biquad(type, freqAt(t), q);
    i += 1;
    const x = rand() * 2 - 1;
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return gain * y * env(t);
  });
}

// ---------------------------------------------------------------------------
// The sounds. `peak` is the loudest sample in dBFS: taps sit well under the spoken Chinese,
// cheers a little louder.
// ---------------------------------------------------------------------------

const SOUNDS = {
  /** Any button or card: a soft, short tick. */
  tap: {
    seconds: 0.05,
    peak: -17,
    make(out) {
      tone(out, 0, { seconds: 0.05, freq: glide(1500, 900, 0.012), env: pluck(0.0006, 0.007), partials: [[1, 1], [2.1, 0.2, 0.5]] });
      noise(out, 0, { seconds: 0.012, env: pluck(0.0002, 0.0018), filter: ['bandpass', 3200, 0.9], gain: 0.35 });
    },
  },

  /** Picking an answer or a pair: a little bubble pop. */
  select: {
    seconds: 0.09,
    peak: -13,
    make(out) {
      tone(out, 0, { seconds: 0.09, freq: glide(480, 1150, 0.035), env: pluck(0.001, 0.016) });
    },
  },

  /** A word tile going into the sentence: a wooden tock. */
  tilePlace: {
    seconds: 0.11,
    peak: -11,
    make(out) {
      tone(out, 0, { seconds: 0.11, freq: 820, env: pluck(0.0008, 0.022), partials: WOOD });
      noise(out, 0, { seconds: 0.02, env: pluck(0.0003, 0.003), filter: ['lowpass', 2500], gain: 0.25, seed: 2 });
    },
  },

  /** A word tile coming back out: a lower, quieter tock. */
  tileRemove: {
    seconds: 0.1,
    peak: -13,
    make(out) {
      tone(out, 0, { seconds: 0.1, freq: glide(600, 560, 0.05), env: pluck(0.0008, 0.018), partials: WOOD });
    },
  },

  /** Segmented tabs (scene sets, quiz sections, course parts): a soft double click. */
  segment: {
    seconds: 0.075,
    peak: -15,
    make(out) {
      tone(out, 0, { seconds: 0.03, freq: 1150, env: pluck(0.0005, 0.005), partials: SOFT });
      tone(out, 0.03, { seconds: 0.04, freq: 1550, env: pluck(0.0005, 0.005), partials: SOFT, gain: 0.7 });
    },
  },

  /** Switching tabs, as the boat sails along the tab bar: a swish of water and a plip. */
  swish: {
    seconds: 0.3,
    peak: -14,
    make(out) {
      const center = (t) => (t < 0.16 ? glide(500, 2200, 0.16)(t) : glide(2200, 1400, 0.12)(t - 0.16));
      noise(out, 0, { seconds: 0.28, env: swell(0.09, 0.28), filter: ['bandpass', center, 1.4], seed: 3 });
      tone(out, 0.17, { seconds: 0.08, freq: glide(700, 1300, 0.03), env: pluck(0.001, 0.02), gain: 0.35 });
    },
  },

  /** A switch turned on: two notes up. */
  toggleOn: {
    seconds: 0.15,
    peak: -14,
    make(out) {
      tone(out, 0, { seconds: 0.07, freq: 660, env: pluck(0.002, 0.03), partials: SOFT });
      tone(out, 0.055, { seconds: 0.095, freq: 990, env: pluck(0.002, 0.04), partials: SOFT });
    },
  },

  /** A switch turned off: two notes down. */
  toggleOff: {
    seconds: 0.15,
    peak: -15,
    make(out) {
      tone(out, 0, { seconds: 0.07, freq: 880, env: pluck(0.002, 0.03), partials: SOFT });
      tone(out, 0.055, { seconds: 0.095, freq: 587, env: pluck(0.002, 0.04), partials: SOFT });
    },
  },

  /** A right answer: two bright bell notes, a fifth apart. */
  correct: {
    seconds: 0.65,
    peak: -9,
    make(out) {
      tone(out, 0, { seconds: 0.4, freq: 880, env: pluck(0.002, 0.16), partials: BELL, gain: 0.85 });
      tone(out, 0.085, { seconds: 0.56, freq: 1318.5, env: pluck(0.002, 0.26), partials: BELL });
      // A hair sharp, for a little shimmer.
      tone(out, 0.085, { seconds: 0.56, freq: 1318.5 * 1.0023, env: pluck(0.002, 0.26), gain: 0.25 });
    },
  },

  /** A miss: two soft, low notes going down. Gentle, not a buzzer. */
  wrong: {
    seconds: 0.42,
    peak: -11,
    make(out) {
      tone(out, 0, { seconds: 0.17, freq: glide(330, 318, 0.15), env: pluck(0.004, 0.07), partials: WARM });
      tone(out, 0.11, { seconds: 0.3, freq: glide(262, 250, 0.25), env: pluck(0.004, 0.11), partials: WARM });
    },
  },

  /** A pair matched: a pop and a little bell. */
  match: {
    seconds: 0.28,
    peak: -12,
    make(out) {
      tone(out, 0, { seconds: 0.06, freq: glide(600, 1300, 0.025), env: pluck(0.001, 0.012), gain: 0.6 });
      tone(out, 0.015, { seconds: 0.26, freq: 1568, env: pluck(0.002, 0.09), partials: BELL });
    },
  },

  /** A hint appearing: a quick sparkle up. */
  hint: {
    seconds: 0.45,
    peak: -15,
    make(out) {
      [1568, 1760, 2093, 2637].forEach((freq, i) => {
        tone(out, i * 0.05, { seconds: 0.3, freq, env: pluck(0.002, 0.07), partials: [[1, 1], [2, 0.15, 0.5]], gain: 1 - i * 0.12 });
      });
      noise(out, 0, { seconds: 0.3, env: swell(0.05, 0.3), filter: ['highpass', 6000], gain: 0.05, seed: 4 });
    },
  },

  /** A lesson, quiz, encounter or city pack done: a harp sweeps up into a ringing chord with a shimmer. */
  complete: {
    seconds: 1.6,
    peak: -7,
    make(out) {
      // C major pentatonic, two octaves up from C5.
      [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760].forEach((freq, i) => {
        tone(out, i * 0.032, { seconds: 0.6, freq, env: pluck(0.002, 0.22), partials: HARP, gain: 0.45 + i * 0.03 });
      });
      const chord = 0.36;
      [
        [1046.5, 0.8],
        [1318.51, 0.6],
        [1567.98, 0.55],
      ].forEach(([freq, gain]) => {
        tone(out, chord, { seconds: 1.2, freq, env: pluck(0.003, 0.5), partials: BELL, gain });
      });
      tone(out, chord, { seconds: 1.2, freq: 523.25, env: pluck(0.006, 0.45), partials: SOFT, gain: 0.45 });
      tone(out, chord, { seconds: 1, freq: 261.63, env: pluck(0.01, 0.4), partials: WARM, gain: 0.35 });
      noise(out, chord, { seconds: 1.1, env: swell(0.15, 1.1), filter: ['highpass', 6500], gain: 0.07, seed: 90 });
    },
  },

  /** An encounter goal ticked off: three quick bells up. */
  goal: {
    seconds: 0.7,
    peak: -11,
    make(out) {
      [1318.5, 1568, 2093].forEach((freq, i) => {
        tone(out, i * 0.07, { seconds: 0.55, freq, env: pluck(0.002, 0.18), partials: BELL, gain: 0.6 + i * 0.15 });
      });
      noise(out, 0.05, { seconds: 0.45, env: swell(0.08, 0.45), filter: ['highpass', 5000], gain: 0.04, seed: 5 });
    },
  },

  /** Challenge mode: the hull takes a hit. A wooden thud and a creak. */
  hullHit: {
    seconds: 0.5,
    peak: -8,
    make(out) {
      tone(out, 0, { seconds: 0.45, freq: glide(150, 62, 0.14), env: pluck(0.002, 0.11), partials: WARM });
      // Phone speakers barely play the thud itself, so a knock in the middle carries it.
      tone(out, 0, { seconds: 0.2, freq: glide(330, 260, 0.08), env: pluck(0.001, 0.04), partials: WOOD, gain: 0.55 });
      noise(out, 0, { seconds: 0.15, env: pluck(0.001, 0.035), filter: ['lowpass', 900], gain: 0.7, seed: 6 });
      const creak = pluck(0.02, 0.12);
      tone(out, 0.06, {
        seconds: 0.4,
        freq: glide(210, 180, 0.3),
        env: (t) => creak(t) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 28 * t)),
        partials: [[1, 1], [2, 0.5], [3, 0.3]],
        gain: 0.22,
      });
    },
  },

  /** Challenge mode: the boat sinks. A splash, a long bloop down, and bubbles coming up. */
  sink: {
    seconds: 1.9,
    peak: -8,
    make(out) {
      noise(out, 0, { seconds: 0.45, env: pluck(0.004, 0.12), filter: ['bandpass', 900, 0.7], gain: 0.8, seed: 7 });
      noise(out, 0, { seconds: 0.8, env: pluck(0.01, 0.25), filter: ['lowpass', 500], gain: 0.5, seed: 8 });
      tone(out, 0.08, {
        seconds: 1.25,
        freq: glide(560, 110, 0.95),
        env: (t) => (t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) / 0.45)),
        partials: WARM,
        gain: 0.55,
        vibrato: { rate: 6, depth: 0.02 },
      });
      const rand = seeded(9);
      for (let i = 0; i < 14; i += 1) {
        const at = 0.45 + rand() * 1.3;
        const from = 350 + rand() * 450;
        tone(out, at, { seconds: 0.06, freq: glide(from, from * 1.9, 0.03), env: pluck(0.001, 0.018), gain: 0.5 - (at - 0.45) * 0.27 });
      }
    },
  },

  /** Challenge mode: a leak patched. Two hammer taps and a ding. */
  patch: {
    seconds: 0.6,
    peak: -12,
    make(out) {
      [
        [0, 1900],
        [0.14, 2150],
      ].forEach(([at, freq]) => {
        tone(out, at, { seconds: 0.12, freq, env: pluck(0.0005, 0.03), partials: METAL });
        tone(out, at, { seconds: 0.05, freq: 320, env: pluck(0.0005, 0.012), gain: 0.5 });
      });
      tone(out, 0.29, { seconds: 0.31, freq: 1760, env: pluck(0.002, 0.14), partials: BELL, gain: 0.55 });
    },
  },

  /** Sending a line in an encounter: a whoosh up. */
  send: {
    seconds: 0.28,
    peak: -15,
    make(out) {
      noise(out, 0, { seconds: 0.27, env: swell(0.13, 0.26), filter: ['bandpass', glide(450, 3800, 0.2), 1.1], seed: 10 });
      tone(out, 0, { seconds: 0.23, freq: glide(420, 1250, 0.18), env: swell(0.12, 0.22), gain: 0.18 });
    },
  },

  /** A character's reply arriving: two soft pops. */
  receive: {
    seconds: 0.17,
    peak: -16,
    make(out) {
      tone(out, 0, { seconds: 0.08, freq: glide(650, 1000, 0.025), env: pluck(0.001, 0.018), gain: 0.8 });
      tone(out, 0.065, { seconds: 0.1, freq: glide(900, 1350, 0.025), env: pluck(0.001, 0.022) });
    },
  },

  /** The mic closing after a recording: one soft note down. */
  micOff: {
    seconds: 0.14,
    peak: -15,
    make(out) {
      tone(out, 0, { seconds: 0.14, freq: glide(760, 520, 0.06), env: pluck(0.003, 0.045), partials: SOFT });
    },
  },

  /** A sheet or menu sliding up. */
  open: {
    seconds: 0.23,
    peak: -19,
    make(out) {
      noise(out, 0, { seconds: 0.22, env: swell(0.12, 0.22), filter: ['bandpass', glide(350, 1500, 0.18), 0.9], seed: 11 });
    },
  },

  /** A sheet or menu closing. */
  close: {
    seconds: 0.21,
    peak: -19,
    make(out) {
      noise(out, 0, { seconds: 0.2, env: swell(0.07, 0.2), filter: ['bandpass', glide(1500, 350, 0.16), 0.9], seed: 12 });
    },
  },

  /** Tapping the seagull: a cheerful "kyaa". */
  chirp: {
    seconds: 0.3,
    peak: -12,
    make(out) {
      const pitch = (t) => (t < 0.05 ? glide(1300, 2250, 0.05)(t) : glide(2250, 1500, 0.21)(t - 0.05));
      const env = (t) => (t < 0.012 ? t / 0.012 : t < 0.2 ? 1 : Math.max(0, 1 - (t - 0.2) / 0.07));
      tone(out, 0, { seconds: 0.28, freq: pitch, env, partials: REED, vibrato: { rate: 32, depth: 0.025 } });
      noise(out, 0, { seconds: 0.28, env, filter: ['bandpass', 2600, 2], gain: 0.08, seed: 13 });
    },
  },
};

// ---------------------------------------------------------------------------
// Mastering and WAV output
// ---------------------------------------------------------------------------

function master(samples, peakDb) {
  const mean = samples.reduce((sum, s) => sum + s, 0) / samples.length;
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] -= mean;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const scale = peak > 0 ? 10 ** (peakDb / 20) / peak : 0;
  // A 4 ms fade at the very end, so nothing clicks if a tail is cut short.
  const fade = Math.round(0.004 * RATE);
  for (let i = 0; i < samples.length; i += 1) {
    const tail = samples.length - 1 - i;
    samples[i] *= scale * (tail < fade ? tail / fade : 1);
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // bytes per second
  header.writeUInt16LE(2, 32); // bytes per frame
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, sound] of Object.entries(SOUNDS)) {
  const samples = new Float32Array(Math.ceil(sound.seconds * RATE));
  sound.make(samples);
  const file = wav(master(samples, sound.peak));
  writeFileSync(join(OUT_DIR, `${name}.wav`), file);
  console.log(`${name.padEnd(11)} ${String(Math.round(sound.seconds * 1000)).padStart(5)} ms  ${(file.length / 1024).toFixed(1)} KB`);
}
