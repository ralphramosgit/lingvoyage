# Lingvoyage setup: start here

Lingvoyage (language + voyage) helps travelers learn the language of where they're going. The hackathon version is Mandarin Chinese, taught in English, with one main feature: **Encounters**, where you talk (by voice or by typing) to an AI character in a travel scene and hear them answer in a real Mandarin voice.

These guides get every account, key and tool ready so Claude Code can build the app in one go. Do them in order. Total time is roughly 60 to 90 minutes, most of it waiting for installs and sign-ups.

> Checked against each platform's docs on October 12, 2026. Dashboards move buttons around; if a menu name doesn't match exactly, look for the closest equivalent.

---

## The plan in one picture

See `docs/architecture.png`. In words:

```
iPhone (Expo Go)
  ├── Supabase Auth ......... sign up / log in, profile, progress (direct from the app)
  └── Lingvoyage API (Python) .. one backend you own, running on your PC now, AWS Lambda later
         ├── ElevenLabs Speech-to-Text (Scribe v2) .. your voice  -> text
         ├── Claude API (Haiku 5.5) ................. the character's brain (reply, corrections, hints)
         └── ElevenLabs Text-to-Speech (Flash v2.5) .. reply text -> Mandarin voice
```

The secret keys (ElevenLabs, Claude) only ever live on the backend. The phone only holds the Supabase publishable key, which is designed to be public.

---

## Why these choices (short version)

| Need | Choice | Why |
|---|---|---|
| Login / sign up | **Supabase** | Yes, use it. Email + password auth, a Postgres database and row-level security in one free project, with an official React Native client. Far less work than building auth on AWS Cognito for a hackathon. |
| Mobile app | **Expo SDK 57 + Expo Router + TypeScript** | SDK 57 is the version the App Store Expo Go app currently runs. |
| Styling | **React Native StyleSheet + a theme file** | Zero setup and can't break in Expo Go. NativeWind's version for SDK 57 is still a release candidate, which is a risk you don't need during a hackathon. You can add it later. |
| Icons | **lucide-react-native** | Clean, consistent icon set that works in Expo Go. No emojis anywhere in the app. |
| Voice conversation | **Record, upload, reply** (push-to-talk) | ElevenLabs' real-time voice-agent SDK for React Native needs native WebRTC modules that Expo Go doesn't include. Push-to-talk works in Expo Go today and feels like the Speak app's Free Talk. |
| Backend | **Python FastAPI** | Your stack choice. Runs locally with one command, deploys to Lambda unchanged. |
| Cloud | **AWS Lambda + Function URL** | Cheapest AWS option: 1 million requests a month are always free, and there's no server to pay for when nobody's using it. (AWS App Runner stopped taking new customers in April 2026.) |
| AI brain | **Claude Haiku 5.5** | Fast and cheap (from $0.10 per million input tokens), returns strict JSON so the app always gets Chinese, pinyin, English, feedback and hints in a predictable shape. |

---

## Accounts you need

| Service | Free? | Who on the team | Guide |
|---|---|---|---|
| GitHub | Free | Everyone (you already have the repo) | 01 |
| Expo | Free | Everyone who runs the app | 01 |
| Supabase | Free plan | One owner, invite teammates | 02 |
| ElevenLabs | Free plan works for testing (10,000 credits/month); Starter if you want Voice Library voices | One owner | 03 |
| Anthropic (Claude API) | Pay as you go; a $5 credit lasts a long time on Haiku | One owner | 04 |
| AWS | Free plan with sign-up credits | One owner | 07 |

---

## Order of operations

1. **01-windows-dev-environment.md**: Node, Python, Git, VS Code, Claude Code, Expo Go on your iPhone, Expo login.
2. **02-supabase.md**: project, keys, turn off email confirmation, run the database SQL.
3. **03-elevenlabs.md**: API key, pick a Mandarin voice, test it.
4. **04-claude-api.md**: API key, credits, test it.
5. **05-environment-variables.md**: where every key goes, locally and online.
6. **Run the Claude Code prompt** (`docs/CLAUDE_CODE_PROMPT.md`) to build the app.
7. **06-run-on-your-iphone.md**: start the backend and the app, open it in Expo Go.
8. **07-aws-deploy.md**: put the backend on Lambda so the app works anywhere (do this before the demo).
9. **08-troubleshooting.md**: when something breaks.
10. **09-share-with-teammates.md**: let teammates try the app in Expo Go on their own phones, with no coding setup and without your PC running.
11. **10-expo-testing-guide.md**: day to day after that: getting the QR code, publishing new versions, undoing one, SDK upgrades.
12. **11-rebrand-to-lingvoyage.md**: renaming the app from Naviglot to Lingvoyage on GitHub, Supabase, AWS Lambda and Expo.
13. **12-auto-deploy-backend.md**: have GitHub deploy the backend to Lambda on every push to `main`, with no AWS key stored anywhere.

Keep a scratch note (not in the repo) as you go, with these values. You'll paste them into `.env` files in guide 05:

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ANTHROPIC_API_KEY=
YOUR_PC_LAN_IP=
LAMBDA_FUNCTION_URL=
```

---

## Repo layout Claude Code will create

```
lingvoyage/                 <- your GitHub repo
├── mobile/               Expo app (React Native + TypeScript)
├── backend/              FastAPI app (Python 3.13), deployable to AWS Lambda
├── docs/
│   ├── setup/            these guides
│   ├── architecture.png
│   └── CLAUDE_CODE_PROMPT.md
├── .gitignore
└── README.md
```

Put this whole `docs/` folder in the root of your repo before you run the Claude Code prompt, so Claude Code can read the guides too.
