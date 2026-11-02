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
  /** Local encounters (a city's pack): the pages their real details came from. Empty for built-in scenes. */
  sources?: Source[];
  /** Local encounters: the day those details were checked (YYYY-MM-DD). */
  checked_at?: string | null;
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

/** A page that a local pack's facts came from. */
export type Source = {
  url: string;
  title: string;
};

/** One short note in a unit's "In Chengdu" section. Mirrors LocalNote in backend/app/content/models.py. */
export type LocalNote = {
  title: string;
  body: string;
  /** 0 to 4 Chinese words from the note. */
  terms: KeyPhrase[];
  fact_ids: string[];
};

/** What a city's pack adds to one unit of the Lessons tab (issue #36). */
export type LocalUnitNotes = {
  /** A unit id from src/content/lessons/units.ts. */
  unit_id: string;
  /** 2 to 4. */
  notes: LocalNote[];
  /** "Local practice: Chengdu", id local-<city>-<unit_id>. Doesn't count toward finishing the unit. */
  lesson: Lesson | null;
  sources: Source[];
  /** The day the facts were found (YYYY-MM-DD). */
  checked_at: string | null;
};

/** A quiz in the Quiz tab's section for the city (issue #36). */
export type LocalQuiz = {
  /** local-<city>-transport, -food or -culture. */
  id: string;
  title: string;
  summary: string;
  /** A lucide icon name: TrainFront, UtensilsCrossed or Landmark. */
  icon: string;
  /** 6 to 10. */
  exercises: Exercise[];
  fact_ids: string[];
  sources: Source[];
  checked_at: string | null;
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

// ---------------------------------------------------------------------------
// Local packs (backend/app/locations): the cities, and each city's pack
// ---------------------------------------------------------------------------

/** A supported city, from GET /cities. */
export type City = {
  /** Permanent once shipped: profiles and packs point at it. */
  slug: string;
  name: string;
  hanzi: string;
  pinyin: string;
  /** "" for the municipalities (Beijing, Shanghai, Chongqing). */
  province: string;
  /** The city center, for "Use my location". */
  lat: number;
  lng: number;
};

export type PackStage = 'plan' | 'research' | 'deep_dive' | 'verify' | 'generate' | 'publish';

/** One line of the agent's trace: what it's doing, written for the learner to read. */
export type PackStep = {
  /** ISO time, UTC. */
  t: string;
  stage: PackStage;
  /** stage, search, read, found, write, check, done or error. */
  kind: string;
  text: string;
  /** Which agent: food, transport, menu:chen-mapo-tofu, scene:airport, unit:food… */
  worker?: string | null;
  url?: string | null;
};

/** From POST /packs/{city} and GET /packs/{city}/status. */
export type PackStatus = {
  city: string;
  /** none: nothing built and nothing running. Only queued and running mean the agent is working right now. */
  status: 'none' | 'queued' | 'running' | 'ready' | 'failed';
  stage: PackStage | null;
  /** The last 50 trace steps, newest last. */
  steps: PackStep[];
  counts: { facts: number; places: number; sources: number };
  /** Set when a ready pack exists, even an expired one that's being refreshed. */
  ready_pack_id: string | null;
  refreshing: boolean;
  error: { code: string; message: string } | null;
};

/** From GET /packs/{city}: what the city's pack adds to the app. */
export type LocalPack = {
  id: string;
  city: string;
  built_at: string;
  encounters: Scenario[];
  unit_notes: LocalUnitNotes[];
  quizzes: LocalQuiz[];
  sources: Source[];
};
