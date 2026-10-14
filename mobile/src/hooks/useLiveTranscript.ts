import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { bytesToBase64, PCM_SAMPLE_RATE } from '@/lib/pcm';

// Live captions while the learner records: the mic's PCM goes straight to ElevenLabs realtime
// Speech to Text with a single-use token from our backend. Captions are only a preview; the
// recording is still sent to /conversation/turn, and that transcript is the one that counts.

const REALTIME_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
// Tokens are single-use and expire after 15 minutes; one is kept ready so captions start quickly.
const TOKEN_MAX_AGE_MS = 12 * 60 * 1000;
// Audio captured while the socket connects (100 ms chunks), sent once it opens.
const MAX_QUEUED_CHUNKS = 100;

export type LiveStatus = 'idle' | 'connecting' | 'live' | 'unavailable';

type Token = { token: string; modelId: string; fetchedAt: number };

type ServerMessage = { message_type?: string; text?: string; error?: string };

async function fetchToken(): Promise<Token | null> {
  try {
    const { token, model_id } = await api.liveToken();
    return { token, modelId: model_id, fetchedAt: Date.now() };
  } catch {
    return null;
  }
}

/** Joins transcript segments: no space between Chinese characters, one between words. */
function joinSegments(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b) ? `${a} ${b}` : `${a}${b}`;
}

function sendChunk(socket: WebSocket, audio: string) {
  socket.send(
    JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: audio, commit: false, sample_rate: PCM_SAMPLE_RATE }),
  );
}

export function useLiveTranscript() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<LiveStatus>('idle');

  const socketRef = useRef<WebSocket | null>(null);
  const nextToken = useRef<Promise<Token | null> | null>(null);
  const queue = useRef<string[]>([]);
  const committed = useRef('');
  const latestText = useRef('');
  const active = useRef(false);
  // Bumped on every begin/end so callbacks from an old socket are ignored.
  const session = useRef(0);

  const show = useCallback((value: string) => {
    latestText.current = value;
    setText(value);
  }, []);

  /** Fetches a token in the background for the next recording, if one isn't on the way. */
  const prefetch = useCallback(() => {
    nextToken.current ??= fetchToken();
  }, []);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // Already closed.
    }
  }, []);

  const fail = useCallback(() => {
    active.current = false;
    queue.current = [];
    closeSocket();
    setStatus('unavailable');
  }, [closeSocket]);

  /** Call right after the mic stream starts. Audio pushed before the socket opens is queued. */
  const begin = useCallback(() => {
    session.current += 1;
    const id = session.current;
    closeSocket();
    queue.current = [];
    committed.current = '';
    active.current = true;
    show('');
    setStatus('connecting');

    void (async () => {
      const pending = nextToken.current ?? fetchToken();
      nextToken.current = null;
      let token = await pending;
      if (!token || Date.now() - token.fetchedAt > TOKEN_MAX_AGE_MS) token = await fetchToken();
      if (session.current !== id) {
        // Recording already over: keep the unused token for the next one.
        if (token) nextToken.current ??= Promise.resolve(token);
        return;
      }
      if (!token) {
        fail();
        return;
      }
      prefetch();

      const query = [
        `model_id=${encodeURIComponent(token.modelId)}`,
        `token=${encodeURIComponent(token.token)}`,
        `audio_format=pcm_${PCM_SAMPLE_RATE}`,
        'commit_strategy=manual',
      ].join('&');
      const socket = new WebSocket(`${REALTIME_URL}?${query}`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (session.current !== id) return;
        setStatus('live');
        for (const chunk of queue.current) sendChunk(socket, chunk);
        queue.current = [];
      };
      socket.onmessage = (event) => {
        if (session.current !== id) return;
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (message.message_type === 'partial_transcript') {
          show(joinSegments(committed.current, (message.text ?? '').trim()));
        } else if (message.message_type === 'committed_transcript') {
          committed.current = joinSegments(committed.current, (message.text ?? '').trim());
          show(committed.current);
        } else if (typeof message.error === 'string') {
          fail();
        }
      };
      socket.onerror = () => {
        if (session.current === id) fail();
      };
      socket.onclose = () => {
        if (session.current === id) fail();
      };
    })();
  }, [closeSocket, fail, prefetch, show]);

  /** Feeds one chunk of 16 kHz 16-bit mono PCM from the mic. */
  const push = useCallback((pcm: Uint8Array) => {
    if (!active.current) return;
    const audio = bytesToBase64(pcm);
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) sendChunk(socket, audio);
    else if (queue.current.length < MAX_QUEUED_CHUNKS) queue.current.push(audio);
  }, []);

  /** For recordings that can't stream audio (the file-recorder fallback). */
  const markUnavailable = useCallback(() => {
    session.current += 1;
    show('');
    fail();
  }, [fail, show]);

  /** Stops captions and returns the last text shown, to use as a preview while the turn is sent. */
  const end = useCallback((): string => {
    session.current += 1;
    active.current = false;
    queue.current = [];
    closeSocket();
    const finalText = latestText.current;
    show('');
    setStatus('idle');
    return finalText;
  }, [closeSocket, show]);

  useEffect(
    () => () => {
      session.current += 1;
      active.current = false;
      closeSocket();
    },
    [closeSocket],
  );

  return { text, status, prefetch, begin, push, end, markUnavailable };
}
