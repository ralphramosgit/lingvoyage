// Mirrors the backend models in backend/app/*.py. Keep the two in sync.

export type Character = {
  name_hanzi: string;
  name_pinyin: string;
  name_english: string;
  role: string;
  avatar_char: string;
};

export type Goal = {
  id: string;
  label: string;
};

export type KeyPhrase = {
  hanzi: string;
  pinyin: string;
  english: string;
};

export type Scenario = {
  id: string;
  language: string;
  title: string;
  subtitle: string;
  city: string;
  setting: string;
  icon: string;
  difficulty: string;
  minutes: number;
  character: Character;
  goals: Goal[];
  key_phrases: KeyPhrase[];
};

export type Phrase = {
  hanzi: string;
  pinyin: string;
  english: string;
};

export type TutorReply = {
  /** What the learner just said: in Chinese as said, its pinyin, and its English meaning. "" when not applicable. */
  learner_hanzi: string;
  learner_pinyin: string;
  learner_english: string;
  hanzi: string;
  pinyin: string;
  english: string;
  feedback: string;
  corrected_hanzi: string;
  corrected_pinyin: string;
  suggestions: Phrase[];
  completed_goal_ids: string[];
  scenario_complete: boolean;
};

export type ChatLine = {
  role: 'npc' | 'learner';
  text: string;
};

export type AudioMime = 'audio/mpeg';

export type TurnResponse = {
  transcript: string | null;
  reply: TutorReply;
  audio_base64: string | null;
  audio_mime: AudioMime;
};

export type TtsResponse = {
  audio_base64: string;
  audio_mime: AudioMime;
};

export type LiveTokenResponse = {
  token: string;
  model_id: string;
};

type TurnBase = {
  scenario_id: string;
  history: ChatLine[];
  completed_goal_ids: string[];
};

export type TurnRequest =
  | (TurnBase & { user_text: string; audio_base64?: undefined; audio_mime?: undefined })
  | (TurnBase & { audio_base64: string; audio_mime: string; user_text?: undefined });

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};
