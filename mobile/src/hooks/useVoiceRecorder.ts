import {
  getRecordingPermissionsAsync,
  type RecordingOptions,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { invalidatePlaybackMode, stopPlayback, waitForAudioSessionToSettle } from '@/lib/audio';

// Mono AAC in an .m4a container at 64 kbps: clear enough for speech recognition, small to upload.
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

export const MAX_RECORDING_MS = 30_000;
export const MIN_RECORDING_MS = 600;
export const RECORDING_MIME = 'audio/mp4';

export type MicPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

export type StartResult = 'started' | 'denied' | 'blocked' | 'busy' | 'error';

export type RecordingResult =
  | { status: 'ok'; base64: string; mime: string; durationMs: number }
  | { status: 'too_short' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

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

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const startedAt = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((result) => {
        if (result.granted) setPermission('granted');
        else if (!result.canAskAgain) setPermission('blocked');
      })
      .catch(() => undefined);
  }, []);

  /** Asks for the mic if needed and starts recording. */
  const start = useCallback(async (): Promise<StartResult> => {
    if (busy.current) return 'busy';
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

      stopPlayback();
      // Let expo-audio's delayed session shutdown (after playback) pass before we record.
      await waitForAudioSessionToSettle();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      invalidatePlaybackMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setIsRecording(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return 'started';
    } catch {
      await leaveRecordingMode().catch(() => undefined);
      return 'error';
    } finally {
      busy.current = false;
    }
  }, [recorder]);

  /** Stops recording. 'send' returns the audio as base64 (and deletes the file); 'cancel' discards it. */
  const finish = useCallback(
    async (mode: 'send' | 'cancel'): Promise<RecordingResult> => {
      if (busy.current) return { status: 'cancelled' };
      busy.current = true;
      const durationMs = Date.now() - startedAt.current;
      // recorder.isRecording reads the native recorder. If iOS stopped it early (e.g. the audio
      // session was taken away), the file is near-empty: don't send silence.
      let cutOff = false;
      try {
        cutOff = !recorder.isRecording;
      } catch {
        cutOff = false;
      }
      try {
        await recorder.stop();
        setIsRecording(false);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await leaveRecordingMode();

        const uri = recorder.uri;
        if (mode === 'cancel') {
          deleteQuietly(uri);
          return { status: 'cancelled' };
        }
        if (durationMs < MIN_RECORDING_MS) {
          deleteQuietly(uri);
          return { status: 'too_short' };
        }
        if (cutOff) {
          deleteQuietly(uri);
          return { status: 'error', message: 'The recording got cut off. Tap the mic and try again.' };
        }
        if (!uri) return { status: 'error', message: "The recording couldn't be saved. Try again." };

        const file = new File(uri);
        const base64 = await file.base64();
        deleteQuietly(uri);
        return { status: 'ok', base64, mime: RECORDING_MIME, durationMs };
      } catch {
        setIsRecording(false);
        await leaveRecordingMode().catch(() => undefined);
        return { status: 'error', message: "The recording couldn't be read. Try again or type it." };
      } finally {
        busy.current = false;
      }
    },
    [recorder],
  );

  // If the screen goes away mid-recording, stop and put the audio session back.
  useEffect(() => {
    return () => {
      try {
        // expo-audio may already have released the recorder by the time this runs.
        if (recorder.isRecording) {
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
  }, [recorder]);

  return {
    permission,
    isRecording,
    // Only trust the polled duration once the poller sees this recording, so a stale value
    // from the previous (possibly 30 s) recording can't trigger an instant auto-stop.
    elapsedMs: isRecording && recorderState.isRecording ? recorderState.durationMillis : 0,
    start,
    finish,
  };
}
