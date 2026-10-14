# Claude Code build prompt: Naviglot hackathon MVP

## How to use this

1. Finish setup guides 01 to 05 in `docs/setup/` first (accounts, keys, `.env` values ready).
2. Make sure this `docs/` folder is in the root of your repo, open the repo in VS Code, and open Claude Code.
3. Send Claude Code this one line:

```
Read docs/CLAUDE_CODE_PROMPT.md (everything under "The prompt") and docs/setup/*.md, then build Naviglot exactly as specified, phase by phase.
```

(Or copy everything under "The prompt" below and paste it in directly.)

If your Expo Go needs a different SDK than 57 (guide 01, step 7), change the two places that say `sdk-57` / `SDK 57` before sending.

---

# The prompt

You are building the hackathon MVP of **Naviglot** (Navigate + glot), a mobile app that helps travelers learn the language of the country they're visiting. The first (and only, for now) target language is **Mandarin Chinese**, taught in **English**. The core feature is **Encounters**: the learner picks a travel scenario and has a spoken (or typed) conversation with an AI character who replies out loud in Mandarin, like the Speak app's "Free Talk".

Read `docs/setup/*.md` before you start. They describe the accounts, environment variable names, scripts and commands that this spec relies on, and the user follows them, so your code must match them exactly.

## 0. Working environment and ground rules

- Dev machine: **Windows 11, PowerShell**. Every command you run or tell me to run must work in PowerShell (use `;` not `&&`, `Copy-Item` not `cp`, `.\.venv\Scripts\Activate.ps1`, `py -3.13`, `curl.exe` not `curl`).
- Test device: **iPhone running Expo Go** from the App Store, which runs **Expo SDK 57**. Everything must work **in Expo Go**: do not add any library that needs a custom native build (no `@elevenlabs/react-native`, no `react-native-mmkv`, no `react-native-vision-camera`, no `react-native-keyboard-controller` unless you verify it ships in Expo Go). Install React Native/Expo packages with `npx expo install` so versions match SDK 57.
- Use the **SDK 57 versioned docs** (the `AGENTS.md` the template generates points to them) rather than memory for Expo APIs. `expo-audio`, `expo-file-system` and `expo-router` changed a lot in SDK 54 to 57.
- **No emojis anywhere**: not in UI text, not in code comments, not in AI output (strip them server-side as a safety net). Use icons from **`lucide-react-native`** instead.
- Secrets (`ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`) live **only in the backend**. The app only ever sees the Supabase URL, the Supabase **publishable** key and the backend URL, all via `EXPO_PUBLIC_` variables.
- TypeScript strict mode. No `any` except where a library's types force it (comment why).
- Don't stop to ask me questions unless you are truly blocked. Make sensible choices and list them in your final summary.
- If `mobile/.env` or `backend/.env` don't exist, create them from the `.env.example` files with placeholder values and tell me to fill them in (guide 05). Never print, log or commit real key values.
- Commit after each phase with a clear message. Don't push; I'll push.

## 1. Repo layout

```
<repo root>/
├── mobile/        Expo app (create it, see Phase 1)
├── backend/       FastAPI app (Python 3.13), runs locally with uvicorn and on AWS Lambda via Mangum
├── docs/          already exists (guides, architecture.png, this prompt) - don't modify
├── .gitignore     root-level: node_modules, .env, .env.*, !.env.example, .venv, __pycache__, build/, lambda.zip, dist/, .expo/, *.log
└── README.md      what Naviglot is, quickstart pointing to docs/setup, team: Ralph, Lin, Ran
```

## 2. Tech stack (exact)

**Mobile (`mobile/`)**
- Expo SDK 57, Expo Router (file-based routing), TypeScript.
- `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill` (auth, set up exactly like Supabase's React Native quickstart: AsyncStorage storage, `autoRefreshToken`, `persistSession`, `detectSessionInUrl: false`, and the `AppState` listener that starts/stops auto refresh).
- `expo-audio` (record + play), `expo-file-system` (new `File` / `Paths` API), `expo-haptics`, `expo-font` + `@expo-google-fonts/plus-jakarta-sans`, `expo-linear-gradient`, `expo-splash-screen`.
- `lucide-react-native` + `react-native-svg` for icons.
- `react-native-reanimated` (already in the template) for animations.
- Styling: React Native `StyleSheet` plus a typed theme module (`theme.ts`). No NativeWind or other styling library.

**Backend (`backend/`)**
- Python 3.13, FastAPI, Mangum (Lambda adapter), httpx (sync client), `anthropic` SDK, `pydantic-settings`.
- `requirements.txt` = runtime deps only (this is what goes to Lambda). `requirements-dev.txt` = `-r requirements.txt` plus `uvicorn[standard]` and `pytest`.
- **Use sync (`def`) route handlers and sync clients** (module-level `httpx.Client` and `anthropic.Anthropic`). FastAPI runs them in a threadpool. This avoids event-loop reuse problems under Mangum on Lambda.

## 3. Environment variables (names must match docs/setup/05)

`mobile/.env.example`
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_URL=http://192.168.1.23:8000
```

`backend/.env.example`
```
APP_ENV=local
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_VOICE_ID_RESTAURANT=
ELEVENLABS_VOICE_ID_TRAIN=
ELEVENLABS_VOICE_ID_HOTEL=
ELEVENLABS_TTS_MODEL=eleven_flash_v2_5
ELEVENLABS_STT_MODEL=scribe_v2
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-5-5
```

`backend/app/config.py`: a `pydantic-settings` `Settings` class that reads real environment variables first and falls back to `backend/.env` (resolve the path from `__file__`, not the working directory). Empty per-scenario voice IDs fall back to `ELEVENLABS_VOICE_ID`. In the app, read env vars only as literal `process.env.EXPO_PUBLIC_...` expressions (Expo inlines them at build time) in one `src/lib/env.ts` module that throws a clear error if one is missing.

## 4. Supabase (already set up by the user, see docs/setup/02)

Tables (do not create them; the user ran the SQL):
- `profiles(id uuid pk = auth.users.id, display_name text, target_language text, native_language text default 'en', onboarding_complete bool default false, created_at)`. A trigger creates the row on sign-up using `raw_user_meta_data.display_name`.
- `encounter_progress(id uuid, user_id uuid default auth.uid(), scenario_id text, goals_completed int, goals_total int, completed bool, created_at)`.
- RLS: users can read/insert/update only their own rows.

App behavior:
- Sign up with `supabase.auth.signUp({ email, password, options: { data: { display_name } } })`. Email confirmation is turned off, so a session comes back immediately. If it ever comes back without a session, show a "Check your email to confirm, then log in" state instead of failing.
- After any login, load the profile. If the row is missing (trigger didn't run), upsert `{ id }` as a fallback.
- Setup page writes `target_language = 'zh-CN'` and `onboarding_complete = true`.
- When an Encounter finishes, insert one `encounter_progress` row.

## 5. Navigation and screens

Use Expo Router **protected routes** (`Stack.Protected` with `guard`, per the SDK 57 docs) in the root layout, driven by an `AuthProvider` context (`session`, `profile`, `loading`, `refreshProfile`, `signOut`). Keep the splash screen up until fonts are loaded and the initial session/profile check finishes.

| State | Allowed routes |
|---|---|
| No session | `(auth)/welcome`, `(auth)/sign-up`, `(auth)/sign-in` |
| Session, `onboarding_complete = false` | `setup` |
| Session, onboarded | `(tabs)` (Encounters, Profile), `encounter/[id]` (prep), `encounter/[id]/talk` (conversation) |

Follow whatever folder convention the SDK 57 default template uses (`app/` or `src/app/`) and put shared code under `src/` (`src/components`, `src/lib`, `src/theme`, `src/hooks`, `src/types`). Delete the template's demo screens and assets you don't use.

### 5.1 Welcome
Full-screen sky-blue gradient. Logo mark: lucide `Compass` in a white rounded square with a small yellow dot accent, wordmark **Naviglot** in Plus Jakarta Sans ExtraBold, tagline "Speak your way around the world." Short line under it: "Practice real travel conversations in Mandarin before you land." Primary button **Get started** (to sign-up), secondary text button **I already have an account** (to sign-in). Gentle entrance animation (logo fades and rises, buttons follow).

### 5.2 Sign up / Sign in
Clean form cards on the light background. Fields with leading icons (`User`, `Mail`, `Lock`), password show/hide toggle (`Eye`/`EyeOff`), inline validation (valid email, password at least 6 characters, name required on sign-up), loading state on the button, friendly error messages mapped from Supabase errors (already registered, invalid credentials, network). Keyboard-safe (`KeyboardAvoidingView`, tap outside to dismiss), `textContentType`/`autoComplete` set so iOS offers password autofill. Links to switch between the two screens. Back button to Welcome.

### 5.3 Setup (onboarding)
Built as a one-step stepper (so more steps can be added later, e.g. travel goals: food, sights, culture). Title "Which language are you learning?", subtitle "You can add more languages later." Selectable cards:
- **Mandarin Chinese** with "中文" and "Pǔtōnghuà" as secondary text, selectable, selected state with sky border + check icon.
- Japanese, Korean, Spanish, French shown **disabled** with a `Lock` icon and "Coming soon" pill.

**Continue** button (disabled until a language is chosen) saves to `profiles` and `refreshProfile()` so the guard moves the user into the tabs.

### 5.4 Encounters tab (main page; tab label "Encounters", icon `MessagesSquare`)
- Header: "Nǐ hǎo, {display_name}" (pinyin with tone marks, plus "你好" beside it) and subtitle "Pick a scene and start talking."
- A small "Mandarin Chinese" language pill with `Languages` icon.
- Scenario cards from `GET /scenarios` (cache the last good response in memory; show skeleton loaders while loading; error state with Retry). Each card: colored icon tile (lucide icon named by the scenario), title, subtitle, city chip with `MapPin`, character name, "4 goals", difficulty, and a "Completed" badge with `CircleCheck` if `encounter_progress` has a completed row for it. Cards animate in with a short stagger.
- Below, a "Coming soon" section with two locked cards: "Shopping at a market" (`ShoppingBag`) and "Taking a taxi" (`CarTaxiFront`), each with a `Lock` icon.

### 5.5 Encounter prep screen (`encounter/[id]`)
Hero header with the scenario's icon and gradient, title, city/setting, and the character: a circular avatar showing the character's surname in Chinese (for example 王) on a tinted background, plus name in pinyin and English and their role. Sections:
- **Your goals**: checklist of the 4 goals (unchecked here).
- **Key phrases**: 5 rows, each with hanzi (large), pinyin, English and a speaker button (`Volume2`) that plays the phrase via `POST /tts`. Cache each phrase's audio file on the device (see audio notes) so replays cost no credits. While loading, the speaker icon shows a small spinner.
- Sticky bottom button **Start encounter** (`Mic` icon) to the talk screen.

### 5.6 Conversation screen (`encounter/[id]/talk`), the core feature
Layout, top to bottom:
1. **Header**: back (`ChevronLeft`, confirms "Leave this encounter?" if there's progress), character avatar + name + role, and a goals progress pill "2/4" (`Target`). Tapping the pill expands a goals panel (animated height) with checkmarks that animate in when a goal completes.
2. **Chat list** (auto-scrolls to newest):
   - **Character bubble** (left, white card): hanzi large (22 to 24), pinyin under it (muted, toggleable from Profile settings), English hidden behind a "Show translation" tap (or shown if the setting says so). Row of small icon buttons: replay (`Volume2`), slow replay (`Turtle`, plays at 0.75x with pitch correction), translate toggle (`Languages`).
   - **Learner bubble** (right, sky tint): what they said or typed. If the reply includes feedback, show a **feedback card** under it: yellow tint, `Lightbulb` icon, the feedback sentence, and if present the corrected line in hanzi + pinyin with its own speaker button.
   - **Thinking indicator**: three bouncing dots in a character-side bubble while waiting.
3. **Suggestions row** ("Try saying", toggled by a `Lightbulb` button in the input bar, on by default for the first two turns): horizontally scrollable chips showing hanzi + pinyin (English on long-press or in small text). Tapping a chip plays its audio; a small "use" arrow on the chip puts the text into the typing box.
4. **Input bar**:
   - Default **voice mode**: a large circular **yellow mic button** (ink-colored `Mic` icon) centered. Tap to start recording, tap again to stop and send. While recording: pulsing ring animation, elapsed timer, a `X` cancel button on the left, haptic feedback on start/stop. Auto-stop at 30 s. Ignore recordings shorter than 0.6 s with a hint "Hold on a little longer".
   - Left: `Keyboard` button switches to **text mode** (text input + `SendHorizontal` button; `Mic` button switches back). Typing can be Chinese characters, pinyin or English.
   - Disabled (and visibly so) while a request is in flight.
5. When the response has `scenario_complete: true`, show a **completion sheet** (animated bottom sheet): `Award` icon, "Encounter complete", the goals with checks, "You practiced N lines in Mandarin", buttons **Practice again** (resets) and **Back to Encounters**. Insert the `encounter_progress` row once.

On open, the screen calls `POST /conversation/start` so the character greets the learner (auto-play the greeting audio if the setting is on).

Error handling on this screen: request failures show an inline retry row in the chat (no lost input; the learner's text or recording is kept for retry). HTTP 422 `no_speech` shows "We didn't catch that. Try again or type it." If microphone permission is denied, show a short explanation with a button that calls `Linking.openSettings()`. If audio is missing in a response (TTS failed), still show the text and a small "Voice unavailable" note.

### 5.7 Profile tab (icon `UserRound`)
Avatar with initials, display name, email, "Learning Mandarin Chinese" row, stats card (Encounters completed, from `encounter_progress`), settings toggles stored in AsyncStorage: **Show pinyin** (default on), **Show English automatically** (default off), **Auto-play voice** (default on). **Log out** button (`LogOut`) with confirmation. App version at the bottom.

## 6. Design system

Light theme only for now (set `"userInterfaceStyle": "light"` in app config). Base colors are sky blue and yellow for travel.

```ts
colors = {
  sky500: '#0EA5E9',   // brand, gradients, highlights
  sky600: '#0284C7',   // primary buttons (white text, bold, 16+)
  sky700: '#0369A1',   // links, pressed states
  sky100: '#E0F2FE',   // learner bubble, selected backgrounds
  sky50:  '#F0F9FF',
  sun400: '#FACC15',   // mic button, accents
  sun300: '#FDE047',
  sun100: '#FEF9C3',   // feedback card background
  ink:    '#0B1F33',   // primary text, icon on yellow
  inkMuted: '#4B5D70', // secondary text, pinyin
  line:   '#D9E6F2',   // borders, dividers
  surface:'#FFFFFF',
  bg:     '#F5FAFF',
  success:'#16A34A',
  danger: '#DC2626',
}
```

- Typography: Plus Jakarta Sans (400, 500, 600, 700, 800). Chinese text uses the system font automatically; give hanzi slightly larger sizes and line height.
- Spacing scale 4/8/12/16/20/24/32; radii 12 (inputs), 16 (cards), 24 (sheets), full (pills, mic). Soft shadows on cards.
- Every interactive element at least 44x44 pt; icon-only buttons have `accessibilityLabel`. Pressables scale to 0.97 on press.
- Responsive: looks right from iPhone SE width (375) to Pro Max and iPad portrait; content max width 640, centered. Respect safe areas.
- Animations with Reanimated: entering/exiting layout animations (FadeInDown, FadeIn, ZoomIn), the mic pulse (`withRepeat`), typing dots, goal-check pop. Keep them short (150 to 350 ms) and respect Reduce Motion (`useReducedMotion`).
- Build small reusable components: `Button` (primary/secondary/ghost, loading), `TextField`, `Card`, `Pill`, `IconButton`, `Screen` (safe area + max width), `CharacterAvatar`, `SkeletonCard`.

## 7. Encounter content (backend `app/scenarios.py`, the single source of truth)

Each scenario: `id`, `language` (`'zh-CN'`), `title`, `subtitle`, `city`, `setting`, `icon` (lucide component name), `difficulty`, `minutes`, `character` (`name_hanzi`, `name_pinyin`, `name_english`, `role`, `avatar_char`), `goals` (`id`, `label`), `key_phrases` (`hanzi`, `pinyin`, `english`), `scene_details` (used only in the AI prompt, never sent to the app), `voice_env` (which per-scenario voice variable to use).

**restaurant**: "Ordering at a noodle shop" / "Order a meal like a local". Beijing, a small family noodle shop in a hutong. Character 王阿姨 (Wáng Āyí, "Auntie Wang"), owner. Icon `UtensilsCrossed`. Beginner, 3 min.
- Goals: `party_size` Say how many people; `order_dish` Order a dish; `special_request` Ask for no spice or order a drink; `pay` Ask for the bill.
- Key phrases: 你好 / nǐ hǎo / Hello; 两位 / liǎng wèi / Two people; 我要一碗牛肉面。/ Wǒ yào yì wǎn niúròu miàn. / I'd like a bowl of beef noodles.; 不要辣。/ Bú yào là. / Not spicy, please.; 买单。/ Mǎidān. / The bill, please.
- Scene details: lunchtime; menu: 牛肉面 beef noodles 25 yuan, 炸酱面 zhajiang noodles 22 yuan, 饺子 dumplings 20 yuan a plate, 可乐 cola 5 yuan, 茶 tea free; pays by phone or cash.

**train**: "Asking for train directions" / "Find your train at a busy station". Shanghai, the information desk at Shanghai Hongqiao Railway Station. Character 李明 (Lǐ Míng), information desk staff. Icon `TrainFront`. Beginner, 3 min.
- Goals: `ask_politely` Ask politely for help; `departure_time` Ask when the train to Hangzhou leaves; `where_board` Ask where to board; `thank_bye` Say thank you and goodbye.
- Key phrases: 请问 / qǐngwèn / Excuse me (may I ask); 去杭州的火车几点出发？/ Qù Hángzhōu de huǒchē jǐ diǎn chūfā? / What time does the train to Hangzhou leave?; 在哪儿上车？/ Zài nǎr shàng chē? / Where do I board?; 洗手间在哪儿？/ Xǐshǒujiān zài nǎr? / Where's the restroom?; 谢谢，再见！/ Xièxie, zàijiàn! / Thank you, goodbye!
- Scene details: the learner has a ticket for the next high-speed train to Hangzhou, leaving at 3:30 pm (下午三点半) from gate B12 (B12检票口) on the second floor (二楼); restrooms are to the left (左边).

**hotel**: "Checking in at a hotel" / "Get your room key and the wifi". Chengdu, the front desk of a mid-range hotel. Character 陈经理 (Chén jīnglǐ, "Manager Chen"), front desk manager. Icon `BedDouble`. Beginner, 3 min.
- Goals: `reservation` Say you have a reservation; `name_passport` Give your name and passport; `breakfast` Ask what time breakfast is; `wifi` Ask for the wifi password.
- Key phrases: 我有预订。/ Wǒ yǒu yùdìng. / I have a reservation.; 我叫…… / Wǒ jiào... / My name is...; 这是我的护照。/ Zhè shì wǒ de hùzhào. / Here is my passport.; 早餐几点？/ Zǎocān jǐ diǎn? / What time is breakfast?; WiFi 密码是多少？/ WiFi mìmǎ shì duōshao? / What's the wifi password?
- Scene details: reservation for 2 nights under the learner's name, room 808 on the 8th floor (八楼); breakfast 7:00 to 10:00 on the 2nd floor; wifi password chengdu2026.

## 8. Backend API

Base: FastAPI app in `backend/app/main.py`, ending with `handler = Mangum(app, lifespan="off")`. CORS: allow all origins (mobile app, no cookies). JSON errors shaped `{ "error": { "code": "...", "message": "..." } }`. Log errors with tracebacks, never log keys or full audio.

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/health` | no | | `{ "status": "ok" }` |
| GET | `/scenarios` | no | | `Scenario[]` (public fields only, no `scene_details`) |
| POST | `/tts` | yes | `{ text: str (1-200 chars) }` | `{ audio_base64, audio_mime: "audio/mpeg" }` |
| POST | `/conversation/start` | yes | `{ scenario_id }` | `TurnResponse` |
| POST | `/conversation/turn` | yes | `{ scenario_id, history: ChatLine[], completed_goal_ids: str[], user_text?: str, audio_base64?: str, audio_mime?: str }` | `TurnResponse` |

- Exactly one of `user_text` / `audio_base64` on `/conversation/turn` (422 otherwise). Audio arrives as base64 JSON (simpler and more reliable than multipart from React Native, and works the same on Lambda). Reject audio over 2 MB decoded.
- `ChatLine = { role: "npc" | "learner", text: str }`; keep at most the last 30 lines.
- `TurnResponse = { transcript: str | null, reply: TutorReply, audio_base64: str | null, audio_mime: "audio/mpeg" }`. If TTS fails, return the reply with `audio_base64: null` rather than failing the whole turn.
- If speech-to-text returns empty text, respond 422 with code `no_speech`.

**Auth (`app/auth.py`)**: FastAPI dependency reading `Authorization: Bearer <access_token>`. Verify by calling `GET {SUPABASE_URL}/auth/v1/user` with headers `apikey: SUPABASE_PUBLISHABLE_KEY` and `Authorization: Bearer <token>`. 200 means valid (take `id` from the JSON); anything else is 401. Cache valid tokens in memory for 5 minutes (bounded dict) to keep latency down. This works whatever JWT signing method the Supabase project uses.

**Speech (`app/speech.py`, httpx, timeout 20 s)**:
- TTS: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_64`, header `xi-api-key`, JSON `{ "text": ..., "model_id": ELEVENLABS_TTS_MODEL }`. Response body is raw MP3 bytes; base64-encode it. Voice: the scenario's override if set, otherwise `ELEVENLABS_VOICE_ID`.
- STT: `POST https://api.elevenlabs.io/v1/speech-to-text`, header `xi-api-key`, multipart form: `model_id=ELEVENLABS_STT_MODEL`, `file=(speech.m4a, bytes, audio_mime or "audio/mp4")`, `tag_audio_events=false`. No `language_code` (auto-detect, since learners mix English and Mandarin). Read `text` from the JSON.
- Map ElevenLabs errors to clear messages (402 `paid_plan_required` means a library voice on the free plan; see docs/setup/03).

**Tutor (`app/tutor.py`)**:
- Model `ANTHROPIC_MODEL` (`claude-haiku-5-5`), `max_tokens` 2000, effort **low** (`output_config={"effort": "low"}`), and **structured outputs** with this schema (Pydantic model, every field required):
  ```python
  class Phrase(BaseModel):
      hanzi: str
      pinyin: str
      english: str

  class TutorReply(BaseModel):
      hanzi: str               # the character's line, Simplified Chinese
      pinyin: str              # tone marks, words spaced
      english: str             # natural translation
      feedback: str            # one short English sentence about the learner's last message, "" on the opening line
      corrected_hanzi: str     # natural Chinese for what the learner meant, "" if not needed
      corrected_pinyin: str
      suggestions: list[Phrase]       # exactly 3, easiest first
      completed_goal_ids: list[str]   # cumulative
      scenario_complete: bool
  ```
  Use the SDK's structured-output support (`client.messages.parse(..., output_format=TutorReply)` or `output_config={"format": {"type": "json_schema", "schema": ...}}` with `messages.create`). Check that combining it with `output_config.effort` works with the installed SDK version; if `parse()` won't accept both, use `messages.create` with `output_config={"effort": "low", "format": {...}}` and validate the JSON with Pydantic yourself.
- **Do not send `temperature`, `top_p` or `top_k`**: Claude Haiku 5.5 rejects them.
- Retry once on 529/overloaded or a timeout.
- Message building: the first message is always a user message `"[Scene starts. The learner has just walked up to you. Greet them and open the conversation.]"`. Then history maps `npc` to `assistant` (content = the hanzi line) and `learner` to `user`; merge consecutive same-role messages; then the new learner text as the final user message.
- Post-processing: strip emojis from every string; keep only valid goal ids and union them with the client's `completed_goal_ids`; trim suggestions to 3; `scenario_complete` only true if all goals are done.
- System prompt (fill from the scenario; refine wording if you like, but keep every rule):

  ```
  You are {name_hanzi} ({name_pinyin}), {role} at {setting} in {city}, China. You are role-playing a real travel situation with a beginner Mandarin learner, a traveler whose first language is English.

  Scene details: {scene_details}

  The learner's goals for this scene (ids in brackets):
  {for each goal: "- [id] label"}
  Goals already completed: {comma list or "none"}

  Rules for every reply:
  1. Stay in character as a friendly, patient local. Speak only Simplified Chinese in "hanzi": one or two short sentences, at most about 20 characters, using HSK 1-2 vocabulary wherever possible.
  2. Move the scene forward. React naturally to what the learner said, then, if goals remain, ask one simple question or give one prompt that invites the learner toward the next unfinished goal. Never list or mention the goals.
  3. The learner may write or speak Chinese, pinyin, English or a mix, and speech recognition may garble their words. Work out what they meant and respond to that.
  4. "pinyin": pinyin for "hanzi" with tone marks (nǐ hǎo), words separated by spaces, punctuation kept.
  5. "english": a natural English translation of "hanzi".
  6. "feedback": one short, warm sentence in English about the learner's last message. Praise what was right; if something was wrong, or they used English, say how to say it in Chinese. Use "" for the opening line.
  7. "corrected_hanzi" and "corrected_pinyin": the natural Chinese version of what the learner meant, when their message had mistakes or wasn't in Chinese; otherwise "". Use "" for the opening line.
  8. "suggestions": exactly 3 short things the learner could say next, easiest first, each with hanzi, pinyin and english. At least one should move toward the next unfinished goal.
  9. "completed_goal_ids": every goal id completed so far, including earlier ones. A goal counts when the learner attempted it in Chinese or pinyin, even with mistakes. If they only used English, don't count it yet; teach the Chinese in "feedback" instead.
  10. "scenario_complete": true only when every goal is completed and your line in this reply is a natural goodbye.
  11. Never use emojis or emoticons. Don't mention being an AI or that this is a lesson unless the learner asks directly. If the learner goes off topic or says something inappropriate, politely steer back to the scene, in character.
  ```

**Scripts and tests**
- `backend/scripts/check_keys.py`: loads settings and checks, printing OK/FAIL with a hint per service: Supabase (`GET {SUPABASE_URL}/auth/v1/settings` with `apikey` header returns 200), ElevenLabs TTS (synthesize "Ni hao, welcome to Naviglot." with the default voice), ElevenLabs STT (send that same audio back and expect non-empty text), Claude (a one-line request to the configured model). Never print key values.
- `backend/scripts/build_lambda.ps1`: exactly the script shown in docs/setup/07 (Linux wheels via `pip install --platform manylinux2014_x86_64 --implementation cp --python-version 3.13 --only-binary=:all: --target build`, copy `app/`, remove `__pycache__`, zip with Python's `shutil.make_archive`). Lambda handler path is `app.main.handler`.
- `backend/tests/`: pytest with FastAPI `TestClient` and mocks (no real network): `/health`, `/scenarios` hides `scene_details`, private endpoints return 401 without a token, `/conversation/turn` 422 when both or neither of text/audio are sent, emoji stripping, history normalization (role mapping, merging, 30-line cap), goal-id filtering and union.
- `backend/README.md`: run locally, run tests, check keys, deploy (link to docs/setup/07).

## 9. Mobile implementation notes

- `src/lib/api.ts`: typed client for the endpoints above. Adds `Authorization: Bearer <access_token>` from `supabase.auth.getSession()`, 30 s timeout with `AbortController`, parses the error shape into a typed `ApiError` (code, message, status). Mirror the backend types in `src/types/api.ts`.
- **Recording** (`src/hooks/useVoiceRecorder.ts`): `expo-audio` `useAudioRecorder` with `{ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 }` (m4a/AAC) and `useAudioRecorderState` (100 ms interval) for the timer. Request permission with `requestRecordingPermissionsAsync`. Before recording: `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })`. **After stopping, set `allowsRecording: false`** again, otherwise iOS plays the reply quietly through the earpiece. Stop any playing audio before recording. Read the file as base64 with the SDK 57 `expo-file-system` `File` API, send it, then delete the file.
- **Playback** (`src/lib/audio.ts`): one shared player from `createAudioPlayer` (release it when the talk screen unmounts). To play a base64 MP3, write it to a file under `Paths.cache` (`naviglot-audio/` folder) using the SDK 57 `File` API, then `player.replace({ uri })` and `play()`. Slow replay: `setPlaybackRate(0.75, 'high')`; normal: `1.0`. Phrase cache: key = a simple hash of the text; if the file already exists, play it without calling the backend.
- Settings (pinyin, auto English, auto-play) in a small context backed by AsyncStorage.
- Haptics: light impact on mic start/stop, success notification on goal completion.

## 10. Work plan (do the phases in order; verify each before moving on)

1. **Scaffold**: root `.gitignore` and `README.md`. Create the app: `npx create-expo-app@latest mobile --template default@sdk-57` (non-interactive; if it prompts, accept defaults). If it created `mobile/.git`, delete that folder (the repo root is the git repo). Remove demo screens. Install all mobile packages with `npx expo install ...`. Create `backend/` with the structure in section 8, both requirements files, `.env.example` files. Verify: `npx expo-doctor` passes in `mobile/`; `py -3.13 -m venv .venv`, install dev requirements, `pytest` runs.
2. **Backend**: config, scenarios, auth, speech, tutor, routes, scripts, tests. Verify: `pytest` green; run `uvicorn app.main:app --host 0.0.0.0 --port 8000` briefly and hit `/health` and `/scenarios` with `Invoke-RestMethod`; if `backend/.env` has real values, run `python scripts/check_keys.py` and report results.
3. **App foundation**: theme, fonts, components, env module, Supabase client, AuthProvider, protected routing, Welcome, Sign up, Sign in, Setup. Verify: `npx tsc --noEmit` clean.
4. **Encounters**: list tab, prep screen with key-phrase audio, Profile tab with settings, stats and logout.
5. **Conversation**: text mode end to end first, then voice mode, suggestions, feedback cards, goals panel, completion sheet and progress insert.
6. **Polish and verify**: animations, empty/loading/error states, accessibility labels, small-screen check. Run `npx tsc --noEmit`, `npx expo-doctor`, and a bundling smoke test `npx expo export --platform ios --output-dir .expo-export-check` (then delete that folder). Run backend `pytest`. Grep the whole repo for emoji characters and remove any.

## 11. Definition of done

- On my iPhone in Expo Go: sign up, land on Setup, choose Mandarin, land on Encounters; kill and reopen the app and stay logged in; log out returns to Welcome.
- Each of the 3 Encounters: prep screen phrases play audio; the character greets me out loud; I can speak or type; I see my transcript, a reply in hanzi + pinyin + tap-to-reveal English, feedback, 3 suggestions; goals tick off; finishing shows the completion sheet and the Encounters list shows "Completed".
- No emojis anywhere. Icons are lucide. Colors follow the sky-blue and yellow theme. Animations are smooth and subtle.
- No secret keys in `mobile/` or in git history; `.env` files are ignored.
- `backend/scripts/build_lambda.ps1` produces a `lambda.zip` that runs on Lambda Python 3.13 x86_64 with handler `app.main.handler` (docs/setup/07).

## 12. Final report

When finished, give me: what you built (short), anything you changed from this spec and why, the exact commands to run the backend and the app (PowerShell), what I still need to fill in or do (keys, Lambda deploy), and known limitations. Keep it concise.
