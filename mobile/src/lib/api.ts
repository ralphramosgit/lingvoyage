import type { ApiErrorBody, LiveTokenResponse, Scenario, TtsResponse, TurnRequest, TurnResponse } from '@/types/api';

import { env } from './env';
import { supabase } from './supabase';

const TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

type RequestOptions = {
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

async function request<T>(method: 'GET' | 'POST', path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (options.auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError('unauthorized', 'Please log in again.', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    if (options.signal?.aborted) throw new ApiError('cancelled', 'Request cancelled.', 0);
    if (controller.signal.aborted) {
      throw new ApiError('timeout', 'The server took too long to answer. Try again.', 0);
    }
    throw new ApiError(
      'network',
      "Can't reach the Naviglot server. Check your connection and that the backend is running.",
      0,
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (isErrorBody(payload)) {
      throw new ApiError(payload.error.code, payload.error.message, response.status);
    }
    throw new ApiError('http_error', `The server answered with an error (HTTP ${response.status}).`, response.status);
  }
  return payload as T;
}

export const api = {
  getScenarios: () => request<Scenario[]>('GET', '/scenarios'),
  tts: (text: string) => request<TtsResponse>('POST', '/tts', { body: { text }, auth: true }),
  liveToken: () => request<LiveTokenResponse>('POST', '/speech/live-token', { auth: true }),
  startConversation: (scenarioId: string, signal?: AbortSignal) =>
    request<TurnResponse>('POST', '/conversation/start', { body: { scenario_id: scenarioId }, auth: true, signal }),
  sendTurn: (body: TurnRequest, signal?: AbortSignal) =>
    request<TurnResponse>('POST', '/conversation/turn', { body, auth: true, signal }),
};

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
