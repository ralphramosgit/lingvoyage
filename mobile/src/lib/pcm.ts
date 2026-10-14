// Helpers for the 16-bit mono PCM the mic stream delivers: base64, WAV packing and loudness.

/** 16 kHz is what speech recognition wants, and it keeps a 30-second WAV under 1 MB. */
export const PCM_SAMPLE_RATE = 16_000;
const BYTES_PER_SAMPLE = 2;

/** Base64 for raw bytes. Chunked so String.fromCharCode never gets too many arguments. */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x2000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

export function pcmDurationMs(byteLength: number, sampleRate: number): number {
  return sampleRate > 0 ? (byteLength / BYTES_PER_SAMPLE / sampleRate) * 1000 : 0;
}

/** Wraps little-endian 16-bit mono PCM chunks in a WAV header. */
export function pcmToWav(chunks: Uint8Array[], sampleRate: number): Uint8Array {
  const dataLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const wav = new Uint8Array(44 + dataLength);
  const view = new DataView(wav.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) wav[offset + i] = text.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true); // byte rate
  view.setUint16(32, BYTES_PER_SAMPLE, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return wav;
}

/** Loudness of a chunk from 0 (room noise) to 1 (loud speech), on a decibel scale. */
export function pcmLevel(chunk: Uint8Array): number {
  const count = Math.floor(chunk.byteLength / BYTES_PER_SAMPLE);
  if (count === 0) return 0;
  const view = new DataView(chunk.buffer, chunk.byteOffset, count * BYTES_PER_SAMPLE);
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const sample = view.getInt16(i * BYTES_PER_SAMPLE, true) / 32768;
    sum += sample * sample;
  }
  const db = 20 * Math.log10(Math.sqrt(sum / count) || 1e-6);
  // About -55 dB is a quiet room, about -15 dB is speaking close to the phone.
  return Math.min(1, Math.max(0, (db + 55) / 40));
}
