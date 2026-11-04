import { useCallback, useEffect, useRef, useState } from 'react';

import type { Gloss } from '@/hooks/useConversation';
import { api, ApiError, errorMessage } from '@/lib/api';

// A finished recording waits here until the learner sends it: the backend transcribes it, the
// learner checks the words (and, if they ask, what they mean), then sends them as their turn or
// records again. Nothing reaches the character until they tap send.

/** What the ready transcript means, fetched when the learner asks to see it. */
export type DraftTranslation =
  | { status: 'loading' }
  | { status: 'done'; gloss: Gloss }
  | { status: 'failed'; message: string };

export type VoiceDraft =
  /** Being transcribed. `preview` is the last live caption, shown meanwhile. */
  | { status: 'checking'; preview: string }
  /** Ready to send. `translation` is null until the learner asks for it. */
  | { status: 'ready'; text: string; translation: DraftTranslation | null }
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
  const translateAbortRef = useRef<AbortController | null>(null);

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
        setDraft({ status: 'ready', text: transcript, translation: null });
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

  /** Fetches the ready transcript's pinyin and English, once (again after a failure). */
  const translate = useCallback(() => {
    if (draft?.status !== 'ready' || !scenarioId) return;
    if (draft.translation?.status === 'loading' || draft.translation?.status === 'done') return;
    const { text } = draft;
    translateAbortRef.current?.abort();
    const controller = new AbortController();
    translateAbortRef.current = controller;

    // Only lands on the same transcript: a new recording or a send in between drops it.
    const settle = (translation: DraftTranslation) =>
      setDraft((current) => (current?.status === 'ready' && current.text === text ? { ...current, translation } : current));

    settle({ status: 'loading' });
    api
      .translate({ scenario_id: scenarioId, text }, controller.signal)
      .then((gloss) => {
        if (!controller.signal.aborted) settle({ status: 'done', gloss });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) settle({ status: 'failed', message: errorMessage(error, "Couldn't translate that.") });
      });
  }, [draft, scenarioId]);

  /** Drops the recording and its transcript, e.g. to record again or after sending. */
  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    translateAbortRef.current?.abort();
    translateAbortRef.current = null;
    recording.current = null;
    setDraft(null);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      translateAbortRef.current?.abort();
    },
    [],
  );

  return { draft, check, retry, translate, clear };
}
