# 02. Dev environment guide

For developers working on the Lingvoyage app. By the end you'll have the app running on your phone from your own computer, and you'll know how work moves from an issue to a merged pull request.

Time: about 30 minutes the first time.

> Commands work in **Git Bash** on Windows (installed with Git) and **Terminal** on Mac. Run them from the folder shown at the top of each block.

---

## What you're working with

- **The app** lives in `mobile/`: Expo SDK 57, Expo Router, TypeScript. It runs inside **Expo Go** on your phone.
- **The backend** (`backend/`, on AWS) and **the database** (Supabase) are run by Ralph. You don't run them and you don't need accounts for them. Your local app talks to the same live backend and database the testers use.

What that means for you:

- **No backend to start and no API keys to manage.** You only need the three app settings Ralph sends you.
- **Voice turns cost real money.** Every message to a character calls paid AI and voice services. Test as much as you need, but don't leave anything looping.
- **Your test account is real.** You'll sign up inside the app, and that account lives in the shared database. Use a test name, and a password you don't use anywhere else.
- **Need a new API route or database column?** You can't add it yourself. See [Need a backend change?](#8-need-a-backend-change). The shapes the API sends and receives are in `mobile/src/types/api.ts`.

---

## 1. Accounts (before anything else)

| Account | What to do |
|---|---|
| **GitHub** | You're a collaborator on [`ralphramosgit/lingvoyage`](https://github.com/ralphramosgit/lingvoyage). Accept the invite email if you haven't |
| **Expo** | Accept the email invite to the **lingvoyage-team** organization. If asked, create a free Expo account **with that same email** |
| **From Ralph** | The three lines for your `mobile/.env`, sent by private message. Wait for these before step 4 |

---

## 2. Install the tools

| Tool | Get it | Check |
|---|---|---|
| **Node.js** (LTS, version 24 or newer; the GitHub checks use 24) | [nodejs.org](https://nodejs.org), or on Windows: `winget install --id OpenJS.NodeJS.LTS -e` | `node -v` |
| **Git** | [git-scm.com](https://git-scm.com), or on Windows: `winget install --id Git.Git -e` | `git --version` |
| **VS Code** | [code.visualstudio.com](https://code.visualstudio.com) | |
| **Expo Go** on your phone | App Store (iPhone) or Play Store (Android) | Open it and sign in with your Expo account |

Close and reopen your terminal after installing, so it finds the new commands.

Tell Git who you are (once per computer). Use the email on your GitHub account:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## 3. Get the code

```bash
git clone https://github.com/ralphramosgit/lingvoyage.git
cd lingvoyage/mobile
npm install
code .
```

Open the **`mobile`** folder in VS Code (that's what `code .` does), not the whole repo. Its `.vscode` settings then apply: VS Code suggests the **Expo Tools** extension (install it), and imports are tidied when you save.

---

## 4. Add your `.env`

```bash
# in lingvoyage/mobile
cp .env.example .env
code .env
```

Replace everything in it with the three lines Ralph sent you. They look like this:

```ini
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
EXPO_PUBLIC_API_URL=https://xxxxxxxxxx.lambda-url.us-west-2.on.aws
```

- **Never commit `.env`, or paste it into an issue, a PR or a screenshot.** Git ignores it already. Check with `git check-ignore -v .env`: it should print a line.
- The `192.168...` address in `.env.example` is for running the backend on your own computer, which you don't do. Use the `https://` URL from Ralph.
- These values are baked in when the app is bundled. **After any change to `.env`, restart with `npx expo start -c`.**

---

## 5. Run it on your phone

```bash
# in lingvoyage/mobile
npx expo login        # the Expo account you accepted the invite with
npx expo start -c
```

A QR code appears in the terminal.

- **iPhone:** open the normal **Camera** app, point it at the QR code, tap the banner.
- **Android:** open Expo Go > **Scan QR code**.
- Your phone and computer must be on the **same Wi-Fi**.
- **Windows:** the first time, the firewall asks about Node.js. Tick **Private networks** and click **Allow**.

Lingvoyage opens in Expo Go. Tap **Get started** and create a Lingvoyage account (separate from your Expo account). Allow the microphone when asked. The prompt says "Expo Go"; that's normal.

Day to day:

- Save a file and the app reloads by itself.
- Press `r` in the terminal to reload by hand. Shake the phone for the developer menu.
- Press `Ctrl+C` to stop.

Can't connect? See [Troubleshooting](#10-troubleshooting).

---

## 6. House rules

**Stay in `mobile/`.** Don't edit `backend/`, `.github/` or `docs/setup/`. PRs that touch those paths, or any of these, wait for Ralph's review because they can break things for everyone:

- `mobile/app.json`
- `mobile/package.json`
- `mobile/src/types/api.ts` and `mobile/src/types/database.ts`
- `mobile/src/lib/env.ts`

**Adding a library:**

- Always use `npx expo install <package>`, never `npm install <package>`. It picks the version that matches SDK 57.
- **Only libraries that work in Expo Go.** A library with its own native code won't run for anyone, testers included. Check its page on [reactnative.directory](https://reactnative.directory) (filter by "Expo Go") or [docs.expo.dev](https://docs.expo.dev). If you're not sure, ask in the issue before you build on it.

**Don't:**

- Change `slug`, `owner`, `runtimeVersion` or `updates` in `app.json`. The app stops opening for every tester.
- Run `npx expo prebuild` or `npx expo run:ios|android`, or create `ios/` or `android/` folders. This project uses Expo Go only.
- Trust old tutorials (or an AI's memory) for Expo APIs. They change every SDK. Use the docs for this version: [docs.expo.dev/versions/v57.0.0](https://docs.expo.dev/versions/v57.0.0/). `mobile/AGENTS.md` has the same rules for AI coding assistants.

**Where things go** (more in `mobile/README.md`):

| Folder | What's there |
|---|---|
| `src/app/` | Screens (Expo Router). Every file is a route; `_layout.tsx` files are navigators |
| `src/components/` | Shared UI: `Button`, `TextField`, `Card`, `Screen`, ... Reuse these before making new ones |
| `src/hooks/` | Data and behavior hooks (`useConversation`, `useScenarios`, ...) |
| `src/lib/` | API client, Supabase client, audio helpers, settings |
| `src/theme/` | Colors, spacing, type, motion. Use these instead of hard-coded values |
| `src/types/` | API and database types (Ralph's, see above) |

---

## 7. The workflow: issue → branch → PR → merge

```
issue #12 ─> branch issue-12 ─> commits ─> push ─> pull request ─> review + checks ─> squash merge ─> testers get it (~5 min)
```

### 7.1 Pick an issue

All work starts from a GitHub issue. Open the [issues list](https://github.com/ralphramosgit/lingvoyage/issues), pick one, and **assign yourself** (Assignees > assign yourself) so nobody else starts it too. Have an idea with no issue? Create the issue first, or ask Ralph to.

### 7.2 Create the branch: `issue-<number>`

**Branch name = `issue-` + the issue number. Nothing else.** Issue #12 → `issue-12`.

```bash
# in lingvoyage
git switch main
git pull
git switch -c issue-12
```

| ✔ | ✘ |
|---|---|
| `issue-12` | `Issue-12`, `issue12`, `issue_12`, `issue-12-login-fix`, `yourname/issue-12`, `fix-login` |

- Always branch from an **up-to-date `main`** (the `git pull` above).
- **One issue, one branch, one PR.**
- Found an unrelated bug along the way? Make a new issue for it rather than fixing it in this branch.

### 7.3 Commit as you go

```bash
git status                     # see what changed; make sure .env isn't listed
git add -A                     # stage everything listed
git commit -m "add hint button to lesson exercises"
```

Write short, lowercase messages that say what changed, like the rest of the history (`add prelessons practice before encounters`). Small commits are fine. They're squashed into one when the PR merges.

### 7.4 Check before you push

```bash
# in lingvoyage/mobile
npm run typecheck
npm run lint
```

Both must pass. The PR runs the same two commands and won't let it merge if either fails. Also try your change on your phone, including the screens around it.

### 7.5 Push and open the pull request

```bash
git push -u origin issue-12
```

(After the first push, plain `git push` is enough.)

Open the PR: GitHub shows a **Compare & pull request** banner on the repo page, or use the link that `git push` printed.

- **Base:** `main`. **Compare:** `issue-12`.
- **Title:** what the change does, in plain words: `Add hint button to lesson exercises`. This becomes the commit message on `main`.
- **Description:** copy this in and fill it out:

    ```markdown
    Closes #12

    ## What changed
    -

    ## How to test
    1.

    ## Screenshots / recording
    <!-- Before and after, for anything you can see. Drag images or a screen recording here. -->
    ```

    `Closes #12` links the PR to the issue and closes the issue when the PR merges.

- **Reviewers:** request one teammate. If you touched one of Ralph's files (section 6), GitHub adds Ralph automatically.
- Want feedback before it's finished? Choose **Create draft pull request** instead, then **Ready for review** when it's done.

### 7.6 Checks and review

- **`mobile typecheck and lint`** and **`backend tests`** must be green. If one is red, click **Details** to see the error, fix it on your computer, and push again.
- **Feedback:** fix it on the same branch and `git push`. The PR updates by itself. Reply to each comment or click **Resolve conversation**. All conversations must be resolved before merging.
- **A new push clears earlier approvals.** Re-request review (the 🔄 icon next to the reviewer's name).

**Reviewing someone else's PR:** read **Files changed**, then try it on your phone:

```bash
# in lingvoyage
git fetch origin
git switch issue-15
cd mobile
npm install            # in case they added a package
npx expo start -c
```

Then **Files changed** > **Review changes** > **Approve**, or **Request changes** with what to fix.

### 7.7 Keep your branch up to date

When GitHub says **This branch has conflicts**, or you need something that was merged after you branched:

```bash
# in lingvoyage
git switch main
git pull
git switch issue-12
git merge main
```

If there are conflicts, VS Code highlights them. Pick what to keep, save, then:

```bash
git add -A
git commit             # keeps Git's default "Merge branch 'main'..." message
git push
```

Use `merge`, not `rebase`: it never needs a force push.

### 7.8 Merge

Once the PR is **approved** and the checks are **green**, the author clicks **Squash and merge** (the only option), then **Delete branch**.

**Merging is publishing.** About 5 minutes later, every tester gets your change in Expo Go. Only merge work that's finished.

Then clean up locally:

```bash
# in lingvoyage
git switch main
git pull
git branch -D issue-12
```

(`-D`, capital: after a squash merge Git doesn't recognize the branch as merged, so `-d` refuses.)

---

## 8. Need a backend change?

The backend can't run on your computer (it needs the secret keys) and you can't deploy it. So when your feature needs something new from it:

1. **Open an issue** describing what you need: the endpoint, what the app sends, what it should get back, and why. Example: "`POST /lessons/progress` with `{ lessonId, score }`, returns the updated progress. Needed for #12." Same for a new database table or column.
2. Ralph builds and deploys it, and updates `mobile/src/types/api.ts` (or `database.ts`).
3. Build your screen against the agreed shape in the meantime. **Don't merge your app PR until Ralph says the backend change is live**, or testers get a screen that calls something that doesn't exist yet.

---

## 9. Seeing what testers see

`npx expo start` shows **your** code. To see the published version (whatever was last merged to `main`), stop Expo and open Lingvoyage the way testers do: [team guide 03](03-test-on-your-phone.md) has the permanent QR code. That's the way to check your change after it merges.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Red screen: **"Missing EXPO_PUBLIC_..."** | `.env` is missing, misnamed or in the wrong folder (it must be `mobile/.env`). Fix it, then restart with `npx expo start -c` |
| Phone can't open the QR code, or it hangs on "Opening project..." | Same Wi-Fi on both? Firewall allowed Node.js on **Private** networks? School, office and café Wi-Fi often block phone-to-computer traffic: run `npx expo start --tunnel` instead (installs a helper the first time) |
| **"Can't reach the Lingvoyage server"** | `EXPO_PUBLIC_API_URL` must be the `https://...lambda-url...` address from Ralph. Fix it and restart with `-c`. If it's right and still failing, the backend may be down: tell Ralph |
| **"Please log in again"** | Sign out and back in, in the app (Profile tab) |
| Expo Go says the project needs a **different SDK** | Update Expo Go. The project is SDK 57. Android can install a specific SDK's Expo Go from [expo.dev/go](https://expo.dev/go) |
| **"Cannot find native module..."** after adding a library | That library needs native code Expo Go doesn't have. Remove it and look for an Expo alternative |
| `npm install` errors about versions | `npx expo install --fix`. Still stuck: delete `node_modules` and run `npm install` again. Don't use `--force` or `--legacy-peer-deps` without asking |
| `git push` refused: **"repository rule violations"** | You're on `main`. Move your work to a branch: `git switch -c issue-12`, then `git push -u origin issue-12` |
| PR says **Review required** after it was approved | You pushed after the approval (re-request review), or you touched one of Ralph's files and Ralph hasn't approved yet |
| `git branch -d` says **not fully merged** | Normal after a squash merge. Use `git branch -D issue-12` |
| Typecheck passes on your computer but fails on the PR | Run `npm ci` (a clean install from the lockfile, like the PR check does), then check again |
