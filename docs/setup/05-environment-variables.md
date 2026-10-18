# 05. Environment variables and API keys (local + online)

Every key from guides 02 to 04 goes in exactly one of two places. Getting this right is what keeps your ElevenLabs and Claude credits from being stolen.

## The one rule

| Kind | Examples | Where it may live |
|---|---|---|
| **Public** (safe in the app) | Supabase URL, Supabase **publishable** key, your backend URL | `mobile/.env` (prefixed `EXPO_PUBLIC_`) |
| **Secret** (backend only) | ElevenLabs key, Anthropic key | `backend/.env` locally, Lambda environment variables online |

Anything prefixed `EXPO_PUBLIC_` is **baked into the app bundle** and can be read by anyone who has the app. Never give a secret key that prefix.

---

## Part A: local (your PC)

Claude Code creates `mobile/.env.example` and `backend/.env.example` (committed, with no real values). You make the real `.env` files from them.

### 1. `mobile/.env`

```powershell
cd mobile
Copy-Item .env.example .env
code .env
```

```ini
# Supabase (public, safe in the app)
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx

# Naviglot backend. No trailing slash.
# Local backend on your PC (use YOUR_PC_LAN_IP from guide 01, not localhost):
EXPO_PUBLIC_API_URL=http://192.168.1.23:8000
# After deploying to AWS (guide 07), switch to:
# EXPO_PUBLIC_API_URL=https://xxxxxxxxxx.lambda-url.us-west-2.on.aws
```

Why not `localhost`? On the iPhone, `localhost` means the iPhone itself. The phone has to reach your PC by its network address.

**After every change to `mobile/.env`, restart Expo with a cleared cache**, because these values are inlined when the bundle is built:

```powershell
npx expo start -c
```

### 2. `backend/.env`

```powershell
cd ..\backend
Copy-Item .env.example .env
code .env
```

```ini
APP_ENV=local

# Supabase (used to verify the user's login token on each request)
SUPABASE_URL=https://abcdefghijkl.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx

# ElevenLabs (SECRET)
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=xxxxxxxxxxxxxxxxxxxx
# Optional: one voice per character (falls back to ELEVENLABS_VOICE_ID)
ELEVENLABS_VOICE_ID_RESTAURANT=
ELEVENLABS_VOICE_ID_TRAIN=
ELEVENLABS_VOICE_ID_HOTEL=
ELEVENLABS_TTS_MODEL=eleven_flash_v2_5
ELEVENLABS_STT_MODEL=scribe_v2

# Claude API (SECRET)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-haiku-5-5
```

No quotes needed around values. No spaces around `=`.

### 3. Make sure Git ignores them

The repo `.gitignore` (Claude Code creates it) must include:

```gitignore
.env
.env.*
!.env.example
```

Check before your first commit:

```powershell
cd ..
git check-ignore -v mobile/.env backend/.env
git status
```

`check-ignore` should print a line for each file (meaning "ignored"), and neither `.env` should appear in `git status`. If one does appear, **don't commit**; fix `.gitignore` first.

### 4. Sharing keys with teammates

Don't paste keys in the repo, a group chat that's saved forever, or a Google Doc. Send them privately (a password manager share is best), and have each teammate create their own `.env` files. Lin and Ran can use the same values; only one person needs to own each account.

---

## Part B: online (AWS + the app)

### 1. Backend secrets on AWS Lambda

On Lambda there's no `.env` file. The same names go into the function's settings:

1. AWS Console > **Lambda** > your function `lingvoyage-api`.
2. **Configuration** tab > **Environment variables** > **Edit**.
3. **Add environment variable** for each line of `backend/.env` (same names, same values), but set `APP_ENV=production`.
4. **Save**.

The backend reads environment variables first and only uses `backend/.env` when it exists, so the same code works in both places. Lambda encrypts these values at rest. Full deploy steps are in guide 07.

Later upgrade (not needed for the hackathon): move the two secret keys into **AWS Systems Manager Parameter Store** as `SecureString` parameters (standard parameters are free) and have the backend read them at startup.

### 2. The app pointing at the cloud

Change one line in `mobile/.env`:

```ini
EXPO_PUBLIC_API_URL=https://xxxxxxxxxx.lambda-url.us-west-2.on.aws
```

then `npx expo start -c`. Now the app works on any network, including school Wi-Fi and cellular, as long as your PC is running Expo (Expo Go still loads the JavaScript from your PC during development).

When you eventually make real builds with EAS (outside Expo Go), you'll set the same `EXPO_PUBLIC_` variables as **EAS environment variables** on expo.dev instead of a local file. Still never put secret keys there.

### 3. GitHub (optional, for later)

If you add automatic deploys with GitHub Actions, store AWS credentials and API keys under **repo Settings > Secrets and variables > Actions**. Not needed for the hackathon.

---

## If a key leaks

Rotate it immediately (create a new one, update `.env` and Lambda, delete the old one):

- **ElevenLabs**: API Keys page > delete the old key.
- **Anthropic**: Console > Settings > API Keys > disable/delete.
- **Supabase publishable key**: public by design, no action needed. A leaked **secret** key (you shouldn't have one in this project): Project Settings > API Keys > delete it.

A common accidental leak: committing `.env`, then deleting it in the next commit. It's still in Git history. Rotate the keys anyway.
