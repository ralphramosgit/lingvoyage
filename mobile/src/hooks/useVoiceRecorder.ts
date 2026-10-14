import {
  type AudioStreamBuffer,
  getRecordingPermissionsAsync,
  type RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioStream,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { invalidatePlaybackMode, stopPlayback, waitForAudioSessionToSettle } from '@/lib/audio';
import { bytesToBase64, PCM_SAMPLE_RATE, pcmDurationMs, pcmLevel, pcmToWav } from '@/lib/pcm';

// Recordings normally come from the mic *stream* (16 kHz PCM), which lets the app show live
// captions and a level meter while the learner speaks, and is sent as a WAV. If the stream can't
// start, the file recorder (mono AAC .m4a, 64 kbps) takes over, without live captions.
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

export const MAX_RECORDING_MS = 30_000;
export const MIN_RECORDING_MS = 600;
const FILE_MIME = 'audio/mp4';
const WAV_MIME = 'audio/wav';

export type MicPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

export type RecorderStatus = 'idle' | 'starting' | 'recording';

/** 'streaming': recording with live PCM (captions possible). 'recording': file fallback, no live audio. */
export type StartResult = 'streaming' | 'recording' | 'denied' | 'blocked' | 'busy' | 'error';

export type RecordingResult =
  | { status: 'ok'; base64: string; mime: string; durationMs: number }
  | { status: 'too_short' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const CUT_OFF_MESSAGE = 'The recording got cut off. Tap the mic and try again.';

function deleteQuietly(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache files get cleaned up by the OS eventually.
  }
}

async function leaveRecordingMode() {
  // Without this, iOS keeps the "play and record" session and plays replies quietly
  // through the earpiece instead of the speaker.
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  invalidatePlaybackMode();
}

export function useVoiceRecorder(options: { onPcm?: (pcm: Uint8Array) => void } = {}) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  /** Mic loudness, 0 to 1, for the recording animation. Stream recordings only. */
  const level = useSharedValue(0);

  const mode = useRef<'stream' | 'file' | null>(null);
  const startedAt = useRef(0);
  const busy = useRef(false);
  const chunks = useRef<Uint8Array[]>([]);
  const capturedBytes = useRef(0);
  const streamRate = useRef(PCM_SAMPLE_RATE);
  const onPcmRef = useRef(options.onPcm);
  useEffect(() => {
    onPcmRef.current = options.onPcm;
  }, [options.onPcm]);

  const onBuffer = (buffer: AudioStreamBuffer) => {
    if (mode.current !== 'stream') return;
    const chunk = new Uint8Array(buffer.data.slice(0));
    streamRate.current = buffer.sampleRate;
    chunks.current.push(chunk);
    capturedBytes.current += chunk.byteLength;
    level.set(withTiming(pcmLevel(chunk), { duration: 90 }));
    // Live captions are opened for 16 kHz; skip them if the device delivers another rate.
    if (buffer.sampleRate === PCM_SAMPLE_RATE) onPcmRef.current?.(chunk);
  };

  const { stream } = useAudioStream({ sampleRate: PCM_SAMPLE_RATE, channels: 1, encoding: 'int16', onBuffer });

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((result) => {
        if (result.granted) setPermission('granted');
        else if (!result.canAskAgain) setPermission('blocked');
      })
      .catch(() => undefined);
  }, []);

  // The timer only needs whole seconds, so re-render once a second instead of on every buffer.
  useEffect(() => {
    if (status !== 'recording') return undefined;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000) * 1000;
      setElapsedMs((current) => (current === seconds ? current : seconds));
    }, 250);
    return () => clearInterval(timer);
  }, [status]);

  /** Asks for the mic if needed and starts recording. */
  const start = useCallback(async (): Promise<StartResult> => {
    if (busy.current || mode.current) return 'busy';
    busy.current = true;
    try {
      let result = await getRecordingPermissionsAsync();
      if (!result.granted && result.canAskAgain) result = await requestRecordingPermissionsAsync();
      if (!result.granted) {
        const state = result.canAskAgain ? 'denied' : 'blocked';
        setPermission(state);
        return state;
      }
      setPermission('granted');
      setStatus('starting');

      stopPlayback();
      // Let expo-audio's delayed session shutdown (after playback) pass before we record.
      await waitForAudioSessionToSettle();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      invalidatePlaybackMode();

      chunks.current = [];
      capturedBytes.current = 0;
      try {
        mode.current = 'stream';
        await stream.start();
      } catch {
        mode.current = 'file';
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      startedAt.current = Date.now();
      // Reset before showing the timer, so the last recording's time can't trigger an instant auto-stop.
      setElapsedMs(0);
      setStatus('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return mode.current === 'stream' ? 'streaming' : 'recording';
    } catch {
      mode.current = null;
      setStatus('idle');
      await leaveRecordingMode().catch(() => undefined);
      return 'error';
    } finally {
      busy.current = false;
    }
  }, [recorder, stream]);

  /** Stops recording. 'send' returns the audio as base64; 'cancel' discards it. */
  const finish = useCallback(
    async (how: 'send' | 'cancel'): Promise<RecordingResult> => {
      const current = mode.current;
      if (busy.current || !current) return { status: 'cancelled' };
      busy.current = true;
      const durationMs = Date.now() - startedAt.current;
      try {
        if (current === 'stream') {
          mode.current = null;
          stream.stop();
          level.set(withTiming(0, { duration: 150 }));
          setStatus('idle');
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await leaveRecordingMode();

          const pcm = chunks.current;
          chunks.current = [];
          if (how === 'cancel') return { status: 'cancelled' };
          if (durationMs < MIN_RECORDING_MS) return { status: 'too_short' };
          // If iOS stopped the stream early (e.g. the audio session was taken away), most of the
          // audio is missing: don't send a fragment.
          const capturedMs = pcmDurationMs(capturedBytes.current, streamRate.current);
          if (capturedMs < Math.min(durationMs, MAX_RECORDING_MS) * 0.5) return { status: 'error', message: CUT_OFF_MESSAGE };
          const wav = pcmToWav(pcm, streamRate.current);
          return { status: 'ok', base64: bytesToBase64(wav), mime: WAV_MIME, durationMs };
        }

        // File fallback. recorder.isRecording reads the native recorder: if iOS stopped it early,
        // the file is near-empty.
        let cutOff = false;
        try {
          cutOff = !recorder.isRecording;
        } catch {
          cutOff = false;
        }
        mode.current = null;
        await recorder.stop();
        setStatus('idle');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await leaveRecordingMode();

        const uri = recorder.uri;
        if (how === 'cancel') {
          deleteQuietly(uri);
          return { status: 'cancelled' };
        }
        if (durationMs < MIN_RECORDING_MS) {
          deleteQuietly(uri);
          return { status: 'too_short' };
        }
        if (cutOff) {
          deleteQuietly(uri);
          return { status: 'error', message: CUT_OFF_MESSAGE };
        }
        if (!uri) return { status: 'error', message: "The recording couldn't be saved. Try again." };

        const file = new File(uri);
        const base64 = await file.base64();
        deleteQuietly(uri);
        return { status: 'ok', base64, mime: FILE_MIME, durationMs };
      } catch {
        mode.current = null;
        chunks.current = [];
        setStatus('idle');
        await leaveRecordingMode().catch(() => undefined);
        return { status: 'error', message: "The recording couldn't be read. Try again or type it." };
      } finally {
        busy.current = false;
      }
    },
    [recorder, stream, level],
  );

  // If the screen goes away mid-recording, stop and put the audio session back.
  useEffect(() => {
    return () => {
      const current = mode.current;
      mode.current = null;
      chunks.current = [];
      try {
        // expo-audio may already have released these by the time this runs.
        if (current === 'stream') stream.stop();
        if (current === 'file' && recorder.isRecording) {
          recorder
            .stop()
            .then(() => deleteQuietly(recorder.uri))
            .catch(() => undefined);
        }
      } catch {
        // Already released.
      }
      void leaveRecordingMode().catch(() => undefined);
    };
  }, [recorder, stream]);

  return {
    permission,
    status,
    isRecording: status === 'recording',
    elapsedMs: status === 'recording' ? elapsedMs : 0,
    level,
    start,
    finish,
  };
}
