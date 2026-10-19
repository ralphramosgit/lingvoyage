import { useCallback, useEffect, useReducer, useRef } from 'react';

import { api, errorMessage } from '@/lib/api';
import { clearConversationAudio, playUri, saveBase64Audio, stopPlayback } from '@/lib/audio';
import type { ChatLine, Phrase, Scenario, TurnResponse, TutorReply } from '@/types/api';

const MAX_HISTORY_LINES = 30;

export type Feedback = {
  feedback: string;
  corrected_hanzi: string;
  corrected_pinyin: string;
};

export type NpcMessage = {
  id: string;
  kind: 'npc';
  reply: TutorReply;
  audioUri: string | null;
  voiceUnavailable: boolean;
};

/** What the learner said, spelled out: in Chinese as said, its pinyin, and what it means in English. */
export type Gloss = {
  hanzi: string;
  pinyin: string;
  english: string;
};

export type LearnerMessage = {
  id: string;
  kind: 'learner';
  source: 'voice' | 'text';
  text: string;
  gloss: Gloss | null;
  pending: boolean;
  failed: boolean;
  feedback: Feedback | null;
};

/** What the learner typed, or the transcript of their recording that they checked before sending. */
export type TurnInput = { type: 'text' | 'voice'; text: string };

type RetryAction = { type: 'start' } | { type: 'turn'; input: TurnInput; learnerId: string };

export type ErrorMessage = { id: string; kind: 'error'; message: string; retry: RetryAction };

export type ChatMessage = NpcMessage | LearnerMessage | ErrorMessage;

type State = {
  messages: ChatMessage[];
  completedGoalIds: string[];
  suggestions: Phrase[];
  thinking: boolean;
  complete: boolean;
  linesPracticed: number;
};

const initialState: State = {
  messages: [],
  completedGoalIds: [],
  suggestions: [],
  thinking: false,
  complete: false,
  linesPracticed: 0,
};

type Action =
  | { type: 'reset' }
  | { type: 'thinking'; value: boolean }
  | { type: 'add'; message: ChatMessage }
  | { type: 'remove'; id: string }
  | { type: 'remove_errors' }
  | { type: 'update_learner'; id: string; patch: Partial<LearnerMessage> }
  | { type: 'reply'; npc: NpcMessage; learnerId?: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return initialState;
    case 'thinking':
      return { ...state, thinking: action.value };
    case 'add':
      return { ...state, messages: [...state.messages, action.message] };
    case 'remove':
      return { ...state, messages: state.messages.filter((message) => message.id !== action.id) };
    case 'remove_errors':
      return { ...state, messages: state.messages.filter((message) => message.kind !== 'error') };
    case 'update_learner':
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === action.id && message.kind === 'learner' ? { ...message, ...action.patch } : message,
        ),
      };
    case 'reply': {
      const { reply } = action.npc;
      const messages = state.messages.map((message) => {
        if (message.id !== action.learnerId || message.kind !== 'learner') return message;
        const hasFeedback = reply.feedback.trim() !== '' || reply.corrected_hanzi.trim() !== '';
        return {
          ...message,
          gloss: glossFrom(reply),
          pending: false,
          failed: false,
          feedback: hasFeedback
            ? { feedback: reply.feedback, corrected_hanzi: reply.corrected_hanzi, corrected_pinyin: reply.corrected_pinyin }
            : null,
        };
      });
      return {
        ...state,
        messages: [...messages, action.npc],
        completedGoalIds: reply.completed_goal_ids,
        suggestions: reply.suggestions,
        complete: reply.scenario_complete,
        linesPracticed: state.linesPracticed + (action.learnerId ? 1 : 0),
      };
    }
  }
}

function glossFrom(reply: TutorReply): Gloss | null {
  // `?? ''` because an older backend doesn't send these fields.
  const hanzi = (reply.learner_hanzi ?? '').trim();
  const pinyin = (reply.learner_pinyin ?? '').trim();
  const english = (reply.learner_english ?? '').trim();
  return hanzi || pinyin || english ? { hanzi, pinyin, english } : null;
}

/** Chat lines for the API: everything before `untilId`, npc lines as hanzi, no failed or pending turns. */
function buildHistory(messages: ChatMessage[], untilId?: string): ChatLine[] {
  const end = untilId ? messages.findIndex((message) => message.id === untilId) : -1;
  const before = end === -1 ? messages : messages.slice(0, end);
  const lines: ChatLine[] = [];
  for (const message of before) {
    if (message.kind === 'npc') lines.push({ role: 'npc', text: message.reply.hanzi });
    if (message.kind === 'learner' && !message.failed && !message.pending) {
      lines.push({ role: 'learner', text: message.text });
    }
  }
  return lines.slice(-MAX_HISTORY_LINES);
}

export function useConversation(scenario: Scenario | null, options: { autoPlay: boolean }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const idCounter = useRef(0);
  const autoPlayRef = useRef(options.autoPlay);
  useEffect(() => {
    autoPlayRef.current = options.autoPlay;
  }, [options.autoPlay]);

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `m${idCounter.current}`;
  }, []);

  const applyResponse = useCallback(
    (response: TurnResponse, learnerId?: string) => {
      const npcId = nextId();
      let audioUri: string | null = null;
      if (response.audio_base64) {
        try {
          audioUri = saveBase64Audio(response.audio_base64, `line-${npcId}.mp3`);
        } catch {
          audioUri = null;
        }
      }
      dispatch({
        type: 'reply',
        learnerId,
        npc: { id: npcId, kind: 'npc', reply: response.reply, audioUri, voiceUnavailable: audioUri === null },
      });
      if (audioUri && autoPlayRef.current) {
        playUri(audioUri, { key: `line:${npcId}` }).catch(() => undefined);
      }
    },
    [nextId],
  );

  const begin = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inFlight.current = true;
    dispatch({ type: 'thinking', value: true });
    return controller;
  }, []);

  const end = useCallback((controller: AbortController) => {
    if (controller.signal.aborted) return;
    inFlight.current = false;
    dispatch({ type: 'thinking', value: false });
  }, []);

  /** Asks the character to open the scene. */
  const start = useCallback(async () => {
    if (!scenario || inFlight.current) return;
    const controller = begin();
    try {
      const response = await api.startConversation(scenario.id, controller.signal);
      if (!controller.signal.aborted) applyResponse(response);
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({
        type: 'add',
        message: { id: nextId(), kind: 'error', message: errorMessage(error), retry: { type: 'start' } },
      });
    } finally {
      end(controller);
    }
  }, [scenario, begin, end, applyResponse, nextId]);

  /** Sends the learner's text or checked voice transcript. On retry, pass the existing learner message id. */
  const send = useCallback(
    async (input: TurnInput, retryLearnerId?: string): Promise<boolean> => {
      if (!scenario || inFlight.current) return false;

      const learnerId = retryLearnerId ?? nextId();
      const history = buildHistory(state.messages, retryLearnerId);
      dispatch({ type: 'remove_errors' });
      if (retryLearnerId) {
        dispatch({ type: 'update_learner', id: learnerId, patch: { pending: true, failed: false } });
      } else {
        dispatch({
          type: 'add',
          message: {
            id: learnerId,
            kind: 'learner',
            source: input.type,
            text: input.text,
            gloss: null,
            pending: true,
            failed: false,
            feedback: null,
          },
        });
      }

      const body = {
        scenario_id: scenario.id,
        history,
        completed_goal_ids: state.completedGoalIds,
        user_text: input.text,
      };

      const controller = begin();
      try {
        const response = await api.sendTurn(body, controller.signal);
        if (!controller.signal.aborted) applyResponse(response, learnerId);
        return true;
      } catch (error) {
        if (controller.signal.aborted) return false;
        dispatch({ type: 'update_learner', id: learnerId, patch: { pending: false, failed: true } });
        dispatch({
          type: 'add',
          message: { id: nextId(), kind: 'error', message: errorMessage(error), retry: { type: 'turn', input, learnerId } },
        });
        return false;
      } finally {
        end(controller);
      }
    },
    [scenario, state.messages, state.completedGoalIds, begin, end, applyResponse, nextId],
  );

  const retry = useCallback(
    (errorId: string) => {
      const target = state.messages.find((message) => message.id === errorId);
      if (!target || target.kind !== 'error') return;
      dispatch({ type: 'remove', id: errorId });
      if (target.retry.type === 'start') void start();
      else void send(target.retry.input, target.retry.learnerId);
    },
    [state.messages, start, send],
  );

  /** Clears the chat and asks the character to start over. */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    inFlight.current = false;
    stopPlayback();
    clearConversationAudio();
    dispatch({ type: 'reset' });
  }, []);

  // Cancel any request in flight when the screen goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const learnerCount = state.messages.filter((message) => message.kind === 'learner').length;

  return {
    ...state,
    learnerCount,
    hasProgress: learnerCount > 0,
    start,
    send,
    retry,
    reset,
  };
}
