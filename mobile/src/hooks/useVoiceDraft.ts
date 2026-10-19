import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiError, errorMessage } from '@/lib/api';

// A finished recording waits here until the learner sends it: the backend transcribes it, the
// learner checks the words, then sends them as their turn or records again. Nothing reaches the
// character until they tap send.

export type VoiceDraft =
  /** Being transcribed. `preview` is the last live caption, shown meanwhile. */
  | { status: 'checking'; preview: string }
  /** Ready to send. */
  | { status: 'ready'; text: string }
  /** Couldn't transcribe. `canRetry` when the same recording may work on a second try. */
  | { status: 'failed'; preview: string; message: string; canRetry: boolean };

type Recording = { base64: string; mime: string };

function isRetryable(error: unknown): boolean {
  // Network trouble, timeouts and server errors. A 4xx (no speech, not Mandarin, too long)
  // needs a new recording instead.
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

export function useVoiceDraft(scenarioId: string | undefined) {
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const recording = useRef<Recording | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const transcribe = useCallback(
    async (preview: string) => {
      const audio = recording.current;
      if (!audio || !scenarioId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setDraft({ status: 'checking', preview });
      try {
        const { transcript } = await api.transcribe(
          { scenario_id: scenarioId, audio_base64: audio.base64, audio_mime: audio.mime },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        recording.current = null;
        setDraft({ status: 'ready', text: transcript });
      } catch (error) {
        if (controller.signal.aborted) return;
        const canRetry = isRetryable(error);
        if (!canRetry) recording.current = null;
        setDraft({ status: 'failed', preview, message: errorMessage(error), canRetry });
      }
    },
    [scenarioId],
  );

  /** Holds a finished recording and transcribes it, showing `preview` (the live captions) meanwhile. */
  const check = useCallback(
    (audio: Recording, preview: string) => {
      recording.current = audio;
      void transcribe(preview);
    },
    [transcribe],
  );

  /** Transcribes the same recording again after a network or server error. */
  const retry = useCallback(() => {
    if (draft?.status === 'failed' && draft.canRetry) void transcribe(draft.preview);
  }, [draft, transcribe]);

  /** Drops the recording and its transcript, e.g. to record again or after sending. */
  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    recording.current = null;
    setDraft(null);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { draft, check, retry, clear };
}
