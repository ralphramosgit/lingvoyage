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
  /** Practice before the encounter. Missing from servers older than the lessons feature. */
  lessons?: Lesson[];
};

/** A multiple-choice answer: Chinese (hanzi and pinyin), or English for "what does it mean?" questions. */
export type LessonOption = {
  hanzi: string;
  pinyin: string;
  english: string;
};

export type Tile = {
  hanzi: string;
  pinyin: string;
};

export type ChoiceExercise = {
  kind: 'choice';
  prompt: string;
  /** Chinese the question is about, "" if none. BLANK marks a gap. */
  hanzi: string;
  pinyin: string;
  options: LessonOption[];
  /** Index of the right option. */
  answer: number;
  hint: string;
  solution: KeyPhrase;
};

export type BuildExercise = {
  kind: 'build';
  prompt: string;
  /** The answer, in order. */
  tiles: Tile[];
  extra_tiles: Tile[];
  hint: string;
  solution: KeyPhrase;
};

export type Exercise = ChoiceExercise | BuildExercise;

export type Lesson = {
  id: string;
  title: string;
  summary: string;
  /** The sentence pattern taught, with [slots]. */
  pattern: KeyPhrase | null;
  examples: KeyPhrase[];
  words: KeyPhrase[];
  tip: string;
  exercises: Exercise[];
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

export type TranscribeRequest = {
  scenario_id: string;
  audio_base64: string;
  audio_mime: string;
};

export type TranscribeResponse = {
  transcript: string;
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
