# Lingvoyage mobile app

Expo SDK 57 app (Expo Router, TypeScript) that runs in **Expo Go** on iPhone.

## Run it

1. Copy `.env.example` to `.env` and fill in the values (see `docs/setup/05-environment-variables.md`).
2. Start the backend (see `backend/README.md`).
3. In this folder:

```bash
npm install
npx expo login        # same Expo account as the Expo Go app
npx expo start -c
```

Scan the QR code with the iPhone Camera app to open it in Expo Go. Restart with `-c` after any change to `.env`.

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## Layout

- `src/app/` routes (Expo Router): `(auth)` welcome, sign up, sign in; `setup`; `(tabs)` Encounters and Profile; `encounter/[id]` prep and `encounter/[id]/talk` conversation.
- `src/components/` shared UI (Button, TextField, Card, Pill, IconButton, Screen, CharacterAvatar, SkeletonCard, ...).
- `src/lib/` env, Supabase client, API client, audio helpers.
- `src/hooks/`, `src/theme/`, `src/types/`.
