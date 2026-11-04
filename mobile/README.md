# Lingvoyage mobile app

Expo SDK 58 app (Expo Router, TypeScript) that runs in **Expo Go** on iPhone.

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

- `src/app/` routes (Expo Router): `(auth)` welcome, sign up, sign in; `setup`; `(tabs)` Encounters and Profile; `encounter/[id]` prep, `encounter/[id]/lesson/[lessonId]` practice lesson and `encounter/[id]/talk` conversation.
- `src/components/` shared UI (Button, TextField, Card, Pill, IconButton, Screen, CharacterAvatar, SkeletonCard, ...).
- `src/components/art/` the illustrations, all SVG animated with Reanimated (no image files): the seagull pal, the chibi characters (their looks come from `src/lib/characterLooks.ts`), the scene backgrounds, the sailboat and waves.
- `src/lib/` env, Supabase client, API client, audio helpers, sound effects (`sounds.ts`).
- `assets/sounds/` the sound effects (taps, tiles, right and wrong, the hull, a harp flourish for finishing, the seagull...), synthesized by `scripts/make-sounds.mjs` (no sample packs). To change one, edit its recipe there and run `npm run sounds`. Learners can turn them off on Profile (Sound effects).
- `src/hooks/`, `src/theme/`, `src/types/`.
