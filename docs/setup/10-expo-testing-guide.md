# 10. Expo testing guide (day to day)

How testing works in this project now that it's set up: where to get the QR code, how to send teammates a new version, how to undo one, and what to watch out for. The one-time setup is guide 09.

> Checked against Expo's docs and EAS CLI 24.13.0 on October 13, 2026. Commands are for Git Bash, run from the `mobile` folder.

---

## The permanent QR code (bookmark this)

This is the one QR code to give teammates. It always opens the **newest** published version, so nobody ever needs a new one after a publish (only after an Expo SDK upgrade).

**Link (open it in a browser to see the QR code):**

```
https://qr.expo.dev/eas-update?projectId=8df178cb-b14c-46da-8d18-090c3317ad28&runtimeVersion=exposdk%3A57.0.0&channel=preview
```

**The QR code itself** (scan it straight off this page with an iPhone camera):

<img src="lingvoyage-qr.svg" alt="Lingvoyage permanent QR code for Expo Go, preview channel" width="240">

> **Don't share the "Preview" QR codes from expo.dev.** Every **Preview** button on the Expo site belongs to one single update, and a new one appears with every publish. Whoever scans one stays on that old version forever. The Expo site has no button for the permanent code; it comes from the link above.

### How to rebuild the link yourself

The link isn't stored on expo.dev. It's Expo's QR code service ([docs](https://docs.expo.dev/more/qr-codes/), "Update by device traits") filled in with three values from this project:

```
https://qr.expo.dev/eas-update?projectId=PROJECT_ID&runtimeVersion=RUNTIME&channel=CHANNEL
```

| Fill in | Value | Where to find it |
|---|---|---|
| `PROJECT_ID` | `8df178cb-b14c-46da-8d18-090c3317ad28` | expo.dev > **lingvoyage** > **Details** (top right) > Project ID, or `mobile/app.json` > `extra.eas.projectId` |
| `RUNTIME` | `exposdk%3A57.0.0` | The **Runtime** shown on any update (`exposdk:57.0.0`). In a link, `:` is written `%3A` |
| `CHANNEL` | `preview` | The channel every publish goes to (the GitHub Action uses `--channel preview`) |

Paste the finished link into Chrome's address bar and press Enter: the page is just the QR code. Right-click > **Save image as** to send it. Add `&format=url` to the end to get the plain `exp://` address inside the code instead.

**After an Expo SDK upgrade** (say to 58), change `57` to `58` in the link, and replace `lingvoyage-qr.svg` in this folder with the new code (open the new link, then save the page as `lingvoyage-qr.svg`).

---

## Quick answers

### Do I have to run `npx expo start` for teammates?

**No.** `eas update` uploads a copy of the app's JavaScript and images to Expo's servers. Nothing *runs* there; Expo only stores the files.

When a teammate scans the QR code, Expo Go on their phone downloads that copy and runs it **on their phone**. The app then talks to Supabase and your Lambda backend directly, so your PC can be off.

It also isn't a "build": there's no app file to install. Expo Go is the installed app, and Lingvoyage loads inside it.

```
Your PC  --eas update-->  Expo's servers (store the files)
                                 |
                          downloads when opened
                                 v
Teammate's phone: Expo Go runs Lingvoyage  -->  Supabase + Lambda backend
```

You still use `npx expo start` for **your own** development (instant reloads while you code). It has nothing to do with what teammates see.

### If I change the code, do teammates get it automatically?

**Yes, once you push to `main`** (after the one-time setup in "Publishing automatically from GitHub" below). A GitHub Action runs the checks and publishes for you whenever a push to `main` changes something in `mobile/`. Saving files, committing, or pushing to another branch changes nothing for teammates.

To publish by hand instead (for example from a branch, or before the automation is set up):

```bash
eas update --channel preview --environment preview --message "What changed"
```

After that:

- **No new QR code.** The permanent link (Option 1 below) always loads the newest published version.
- **Teammates just reopen the app.** They swipe Expo Go closed and tap Lingvoyage under Recently opened. If they still see the old version, they reopen once more.
- **Nothing else changes for you.** Same command every time.

Exceptions:

| Situation | What's different |
|---|---|
| A teammate first opened it from a QR code on an **update's page** on expo.dev (Option 2) | That code is tied to one old version. Send them the permanent link once |
| You upgrade the Expo SDK | New QR link needed (see "When Expo Go moves to SDK 58") |
| You change backend code | Skip `eas update`: upload a new `lambda.zip` (guide 07), and everyone gets it on their next request |
| You add a library Expo Go doesn't include | Can't be shipped this way (see "What can go out as an update") |

---

## This project's Expo setup at a glance

| Thing | Value |
|---|---|
| Expo account (yours) | `ralphramosxpo` |
| Organization | `lingvoyage-team` (teammates join this) |
| Project | `lingvoyage` ([dashboard](https://expo.dev/accounts/lingvoyage-team/projects/lingvoyage)) |
| Project ID | `8df178cb-b14c-46da-8d18-090c3317ad28` (in `app.json` > `extra.eas.projectId`) |
| Channel / branch | `preview` (where every test version goes) |
| Runtime version | `exposdk:57.0.0` (from `"runtimeVersion": { "policy": "sdkVersion" }`) |
| Settings for published versions | EAS **preview** environment (3 `EXPO_PUBLIC_*` variables) |
| Backend | AWS Lambda (guide 07), same for you and teammates |

Words you'll see:

- **Update**: one published copy of the app's JavaScript and images. Each `eas update` makes a new one.
- **Branch**: the list of updates, newest last. Ours is `preview`.
- **Channel**: the address Expo Go asks for. Our `preview` channel points at the `preview` branch, so "latest on the channel" means "the last thing you published".
- **Runtime version**: a label that says which Expo Go can run an update. Ours is `exposdk:57.0.0`, so only Expo Go for SDK 57 opens it.

---

## Two ways to run the app

| | Local dev (`npx expo start`) | Published (`eas update`) |
|---|---|---|
| Who can open it | You, on a phone that can reach your PC | Members of `lingvoyage-team`, anywhere |
| Your PC must be on | Yes | No |
| Code changes show | Instantly (hot reload) | Only after you publish |
| Settings come from | `mobile/.env` | EAS **preview** environment on expo.dev |
| Use it for | Building and fixing | Teammates testing on their own time |

Rule of thumb: work with `npx expo start`, and publish when something is ready for teammates to try.

---

## Getting the QR code

### Option 1: the permanent link (best for teammates)

Open this in your PC's browser:

https://qr.expo.dev/eas-update?projectId=8df178cb-b14c-46da-8d18-090c3317ad28&runtimeVersion=exposdk%3A57.0.0&channel=preview

It's Expo's QR code service ([docs](https://docs.expo.dev/more/qr-codes/)). It draws a QR code from three values in the link:

| Part of the link | Meaning |
|---|---|
| `projectId=8df178cb-...` | Which project (`lingvoyage`) |
| `runtimeVersion=exposdk%3A57.0.0` | Which Expo Go can open it (`%3A` is just `:` written for a URL) |
| `channel=preview` | Which channel to load the latest update from |

Because it points at the channel, not one specific update, **it always opens the newest version**. Send it once; you never need a new one when you publish. (Exception: an SDK upgrade, see below.)

To share it: right-click the QR code > **Save image as**, then send the image. Teammates scan it from your message on another screen, or from a laptop.

Want the plain address inside the QR code? Add `&format=url` to the link. It returns:

```
exp://u.expo.dev/8df178cb-b14c-46da-8d18-090c3317ad28?runtime-version=exposdk%3A57.0.0&channel-name=preview
```

### Option 2: on the website

1. Go to [expo.dev](https://expo.dev) > **lingvoyage-team** > **lingvoyage** > **Updates**.
2. Click an update (for example "First test version").
3. Click **Preview** to show its QR code.

This QR code is for **that one update**. After your next publish, it still opens the older version, so use Option 1 for anything you send out. Teammates who are members can also find this page themselves when signed in to expo.dev.

### Option 3: from the terminal

Every `eas update` ends with an **EAS Dashboard** line. That's the Option 2 page for the update you just published. To see past updates:

```bash
eas update:list --branch preview
```

### After the first scan

Expo Go remembers the project. Next time, open Expo Go and tap **Lingvoyage** under **Recently opened**. Because the first scan used the channel link, it loads the newest version.

---

## Sending teammates a change, start to finish

1. **Build and try it locally** with `npx expo start -c` on your phone.
2. **Run the checks:**

    ```bash
    npm run typecheck
    npm run lint
    ```

3. **Publish:** commit and push to `main`. The GitHub Action does the rest (next section); watch it under the repo's **Actions** tab. Or publish by hand:

    ```bash
    eas update --channel preview --environment preview --message "Short note about what changed"
    ```

    By hand, it bundles the app on your PC (it creates a `dist/` folder, which is gitignored) and uploads it. Takes a minute or two. If "Computing the project fingerprints" is slow, you can skip that step by putting `EAS_SKIP_AUTO_FINGERPRINT=1 ` in front of the command.

4. **Check the published version yourself:** stop `npx expo start`, scan the Option 1 QR code (or open it from Recently opened), and make sure your change is there.
5. **Tell teammates** there's a new version. They swipe Expo Go closed and reopen Lingvoyage. If they still see the old one, reopen once more.

---

## Publishing automatically from GitHub

`.github/workflows/eas-update.yml` publishes to the `preview` channel on every push to `main` that touches `mobile/`. It runs `npm ci`, `npm run typecheck` and `npm run lint` first, and if any of them fail, nothing is published. The update's message is the commit's first line. Pushes that only change `backend/` or `docs/` don't publish anything.

### One-time setup

1. **Make an Expo token for GitHub.** On [expo.dev](https://expo.dev), switch to the **lingvoyage-team** account > **Settings** > **Access tokens**. Under **Robot users**, add a robot (name it `github-actions`, role **Developer**), then create a token for it and copy it. It's shown only once. (A personal access token from your own account also works, but it stops working if you leave the team.)
2. **Give it to GitHub.** On GitHub: the `lingvoyage` repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**. Name: `EXPO_TOKEN`, value: the token. Never paste it anywhere else.
3. **Push the workflow file to `main`.** That push runs it once. Check the **Actions** tab: the "Publish app update" run should end green, and a new update shows up under expo.dev > lingvoyage > **Updates**.

### Day to day

- Push to `main` → about 3 to 5 minutes later, teammates get the new version when they reopen Lingvoyage.
- **Republish without a code change** (for example after changing an `EXPO_PUBLIC_*` value on Expo): GitHub > **Actions** > **Publish app update** > **Run workflow**.
- **A run failed:** open it in the Actions tab. A red typecheck or lint step means the code has an error (run the same command locally to see it). A red publish step that mentions authentication means the `EXPO_TOKEN` secret is missing or expired.
- **Backend changes still go up by hand** (guide 07, section 12). If an app change needs new backend code, deploy the backend **before** pushing to `main`, or teammates may briefly get an app that calls a route Lambda doesn't have yet.

---

## Undoing a bad version

You can't "un-publish", but you can republish an older update on top, which makes it the newest again:

```bash
eas update:list --branch preview                 # find the Group ID of the last good version
eas update:republish --group <GROUP_ID> --message "Back to the version before the bug"
```

Then fix the bug and publish normally. (Commands mentioning "embedded" updates are for real installed builds. They don't apply to Expo Go.)

---

## What can go out as an update

| You changed | Can teammates get it with `eas update`? |
|---|---|
| Screens, styles, text, logic in `mobile/src` | Yes |
| Images and fonts the app loads | Yes |
| An `EXPO_PUBLIC_*` value | Yes, after changing it on Expo (see "Where settings live") |
| Backend code in `backend/` | Not needed: upload a new `lambda.zip` (guide 07). Everyone gets it instantly |
| A new library that **Expo Go includes** (most `expo-*` packages) | Yes, install it with `npx expo install` |
| A new library that needs its own native code (not in Expo Go) | **No.** It won't run in Expo Go at all. That means switching to real builds (end of guide 09) |
| App icon, bundle ID, permission wording | Doesn't apply in Expo Go: the phone sees Expo Go, not Lingvoyage |
| Expo SDK version | Only together with a new QR link (next section) |

Before adding a library, check its page on [docs.expo.dev](https://docs.expo.dev) or [reactnative.directory](https://reactnative.directory) for **Expo Go** support.

---

## Where settings live

| Where | What's there | Used by |
|---|---|---|
| `mobile/.env` (your PC only, gitignored) | 3 `EXPO_PUBLIC_*` values | `npx expo start` |
| expo.dev > lingvoyage > **Environment variables** > preview | The same 3 values | `eas update --environment preview` |
| AWS Lambda > Configuration > Environment variables | The real secrets (Claude, ElevenLabs, Supabase server keys) | The backend |

**The published version uses the values stored on Expo, not your `.env`.** If you change a value in `.env` (for example a new Lambda URL), change it on Expo too, then publish:

```bash
eas env:set --name EXPO_PUBLIC_API_URL --value "https://..." --environment preview --visibility plaintext --non-interactive
eas env:list --environment preview
```

Never put a real secret in an `EXPO_PUBLIC_*` variable. Everything in those ends up inside the app, where anyone can read it.

---

## Things to know about Expo Go in this project

- **Everyone must be signed in to Expo Go.** Since May 12, 2026, Expo Go only opens published updates for the project owner and members of its organization ([Expo changelog](https://expo.dev/changelog/expo-go-loading-changes-may-2026)). A teammate who isn't signed in, or used a different account, gets an error.
- **Expo Go runs one SDK version.** The App Store's Expo Go updates itself on phones, and when it moves past SDK 57, Lingvoyage stops opening until you upgrade (next section). Android users can get a specific SDK's Expo Go from [expo.dev/go](https://expo.dev/go).
- **The microphone prompt says "Expo Go".** In Expo Go, iOS asks on behalf of Expo Go, not Lingvoyage. That's normal.
- **`expo-updates` does nothing inside Expo Go.** It's installed so `eas update` works. Local dev with `npx expo start` is unchanged.
- **Don't change `slug` or `owner` in `app.json`.** They must match the project on expo.dev (`lingvoyage` in `lingvoyage-team`), or EAS commands refuse to run.
- **Don't change `runtimeVersion`.** With any policy other than `sdkVersion`, updates get labels like `1.0.0`, and Expo Go won't open them.

---

## When Expo Go moves to SDK 58

You'll know because Expo Go (or a teammate) says the project needs a different SDK.

1. Upgrade the project (follow Expo's upgrade notes for that SDK):

    ```bash
    npx expo install expo@^58.0.0 --fix
    ```

2. Test locally with `npx expo start -c`.
3. Publish as usual. The runtime version becomes `exposdk:58.0.0` automatically.
4. **Make a new permanent link.** The old one asks for SDK 57. Change `57` to `58` in the link and send the new QR code to everyone:

    ```
    https://qr.expo.dev/eas-update?projectId=8df178cb-b14c-46da-8d18-090c3317ad28&runtimeVersion=exposdk%3A58.0.0&channel=preview
    ```

5. Teammates update Expo Go from the App Store or Play Store and scan the new code.

---

## Managing teammates

- **Add someone:** expo.dev > **lingvoyage-team** > **Settings** > **Members** > **Invite**. Viewer is enough; use Developer if Viewer can't load it.
- **Remove someone:** same page. Once they're no longer a member, Expo Go stops loading the app for them.
- **Instructions to send them:** section 7 of guide 09.
- Expo's free plan covers updates for 1,000 users a month ([pricing](https://expo.dev/pricing)). Every voice turn a teammate takes uses your Claude and ElevenLabs credits through Lambda, so check those usage pages while people are testing.

---

## Command cheat sheet

| Task | Command |
|---|---|
| Run locally | `npx expo start -c` |
| Check code before publishing | `npm run typecheck` then `npm run lint` |
| Publish a new version | `eas update --channel preview --environment preview --message "..."` |
| See published versions | `eas update:list --branch preview` |
| Undo (republish an older one) | `eas update:republish --group <GROUP_ID> --message "..."` |
| See settings on Expo | `eas env:list --environment preview` |
| Change a setting on Expo | `eas env:set --name <NAME> --value "<VALUE>" --environment preview --visibility plaintext --non-interactive` |
| Who am I signed in as | `eas whoami` |
| Upgrade the Expo SDK | `npx expo install expo@^<VERSION>.0.0 --fix` |

Something not loading? The "When something goes wrong" table in guide 09 covers the common errors.
