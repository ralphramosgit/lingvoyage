# 09. Share the app with teammates (no coding setup for them)

This lets teammates try Naviglot on their own phones, whenever they want, without VS Code, Node or `npx expo start`. They use the **Expo Go** app and a free Expo account. Your PC doesn't need to be on.

**Cost: $0.** Time: about 20 minutes for you once, then 5 minutes per teammate.

> Checked against Expo's docs on October 13, 2026. Commands are for Git Bash, run from the `mobile` folder.

---

## How it works

```
You:        eas update  ──>  Expo's servers (your organization's "naviglot" project)
Teammates:  Expo Go (signed in, member of your organization)  ──>  loads the latest version
The app:    talks to Supabase and your Lambda backend, same as on your phone
```

- `eas update` uploads the app's JavaScript to Expo. Nothing runs on your PC afterwards.
- Since May 12, 2026, Expo Go only opens these uploads for the project's owner or **members of the organization that owns it** ([Expo changelog](https://expo.dev/changelog/expo-go-loading-changes-may-2026)). That's why the project goes under an organization and teammates join it.

Before you start: the backend must be on Lambda (guide 07), and `mobile/.env` must point at the Lambda URL.

---

## 1. Create the organization and invite teammates

1. Go to **expo.dev** and sign in.
2. Account menu (top left) > **Create organization**. Name it, for example `naviglot-team`. Organizations are free.
3. In the organization: **Settings > Members > Invite**. Enter each teammate's email.
   - Role: **Viewer** is enough to open the app. If a teammate can't load it later, change them to **Developer**.
4. Each teammate accepts the email invite and creates a free Expo account if they don't have one.

## 2. Put the project under the organization

In `mobile/app.json`, add an `owner` line inside `"expo"`:

```json
{
  "expo": {
    "name": "Naviglot",
    "slug": "naviglot",
    "owner": "naviglot-team",
    ...
```

Then update the EAS CLI (yours may be old) and link the project:

```bash
npm install -g eas-cli
eas login            # same Expo account you use in Expo Go
eas init --account naviglot-team --non-interactive   # links @naviglot-team/<slug>, or creates it if missing
```

If you already created the project on expo.dev, set `slug` in `app.json` to that project's name first. Otherwise `eas init` makes a second project. (This repo uses `naviglot-test`.) `eas init` also rewrites `app.json` and adds `extra.eas.projectId` and a few defaults; that's expected.

## 3. Make uploads loadable in Expo Go

```bash
npx expo install expo-updates
eas update:configure
```

`eas update:configure` adds `runtimeVersion` and `updates.url` to `app.json`. **Change the `runtimeVersion` it writes** to this:

```json
"runtimeVersion": { "policy": "sdkVersion" },
```

Why: Expo Go only loads uploads made for its own SDK, which here is `exposdk:57.0.0`. The default policy labels uploads `1.0.0` instead, and Expo Go won't open those ([Expo docs](https://docs.expo.dev/build/updates/)). `expo-updates` does nothing inside Expo Go, so `npx expo start` keeps working as before.

## 4. Copy the app's settings to Expo

`mobile/.env` never leaves your PC (it's gitignored), but `eas update` reads its settings from Expo. Add the same three values there:

1. expo.dev > `naviglot-team` > **naviglot** > **Environment variables** > **Add variable**.
2. Add each of these, with the value from `mobile/.env`. Tick the **preview** environment and choose **Plain text** visibility:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `EXPO_PUBLIC_API_URL` (the Lambda URL, never a `192.168.x.x` address)

These values end up inside the app anyway, so they aren't secrets. The real keys (Claude, ElevenLabs) stay on Lambda.

Check they're all there:

```bash
eas env:list --environment preview
```

## 5. Publish

```bash
eas update --channel preview --environment preview --message "First test version"
```

If it asks to install or configure anything, say yes. When it finishes it prints **Published!** and a link to the update on expo.dev.

## 6. Test on your own phone, then make the teammate QR code

1. Find your project ID (it's also on the project's page on expo.dev):

    ```bash
    grep projectId app.json
    ```

2. Open this link in your PC's browser, with your project ID filled in. It shows a QR code that always opens the **latest** version on the `preview` channel, so you only make it once:

    ```
    https://qr.expo.dev/eas-update?projectId=YOUR_PROJECT_ID&runtimeVersion=exposdk%3A57.0.0&channel=preview
    ```

    For this repo's project (`naviglot-team/naviglot-test`) that's:
    https://qr.expo.dev/eas-update?projectId=1660c178-9893-4137-847a-6051488a096f&runtimeVersion=exposdk%3A57.0.0&channel=preview

3. Scan it with your iPhone Camera and tap the banner. It should open in Expo Go and start Naviglot. **Fix any problem before you invite people** (see "When something goes wrong" below).
4. Save the QR code image (right-click > Save image) to send to teammates. Ask one teammate to try it before you send it to everyone. Their test is the one that proves the organization access works.

This link and the QR code image are also saved at the top of guide 10 ("The permanent QR code").

Don't use the **Preview** QR code on an update's page on expo.dev for this. It opens only that one update, so whoever scans it never gets newer versions ([Expo docs](https://docs.expo.dev/review/share-previews-with-your-team/)). It's fine for a one-off look at a specific update.

---

## 7. What to send teammates

Copy, paste and attach the QR code image.

> **Try Naviglot on your phone**
>
> 1. Accept the Expo invite I sent to your email, and create a free Expo account if it asks.
> 2. Install **Expo Go** from the App Store (iPhone) or Play Store (Android).
> 3. Open Expo Go and sign in with that Expo account.
> 4. Scan the attached QR code:
>    - **iPhone:** use the normal Camera app, then tap the banner that appears.
>    - **Android:** open Expo Go and tap **Scan QR code**.
> 5. Naviglot opens inside Expo Go. Create an account and allow the microphone when asked.
>
> Next time, open Expo Go and tap Naviglot under **Recently opened**. You'll always get the newest version.
>
> If something breaks, send me a screenshot, what you tapped just before, and what you expected to happen.

---

## 8. Sending a new version

Whenever you've changed the app:

```bash
eas update --channel preview --environment preview --message "What changed, in a few words"
```

Teammates close Naviglot (swipe Expo Go away), reopen it from **Recently opened**, and get the new version. If they still see the old one, reopen once more.

Changes to `backend/` don't need this. Upload a new `lambda.zip` (guide 07) and teammates get the change on their next request.

---

## When something goes wrong

| What they see | Why | Fix |
|---|---|---|
| Expo Go says it can't load or has no access to the project | Not signed in to Expo Go, signed in with another account, or invite not accepted | Check they're signed in with the account you invited, and that it's listed under Members |
| Expo Go says the project needs a different SDK | Their Expo Go is a different SDK version than the project (57) | iPhone: update Expo Go in the App Store. Android: install the SDK 57 version from [expo.dev/go](https://expo.dev/go). If the App Store's Expo Go has moved past SDK 57, see "The one big catch" below |
| An error about the runtime version, or nothing loads (even for you) | `runtimeVersion` isn't `{ "policy": "sdkVersion" }` | Fix step 3, then publish again |
| App closes right after the splash screen, or a "Missing EXPO_PUBLIC_..." error | A setting is missing on Expo | Step 4, then publish again |
| "Network error" for teammates but not you | `EXPO_PUBLIC_API_URL` on Expo is a `192.168.x.x` address | Set it to the Lambda URL, then publish again |
| Old version keeps showing | Expo Go hasn't fetched the new upload yet, or you published to a different channel | Reopen twice; check you used `--channel preview` |

**Costs to watch:** every voice turn a teammate takes calls your Claude and ElevenLabs accounts through Lambda. Keep an eye on both usage pages while people are testing. Expo's free plan covers updates for 1,000 users a month ([pricing](https://expo.dev/pricing)).

## The one big catch

Expo Go runs one SDK version at a time, and phones update apps automatically. When the App Store's Expo Go moves to SDK 58, Naviglot stops opening for teammates until you upgrade the project to SDK 58 and publish again. Expo also describes Expo Go as a learning tool rather than a way to share apps for review.

If that becomes a problem, the next step is a real installable app built with EAS Build. That's free for Android (an install link) and needs the $99/year Apple Developer Program for iPhones (TestFlight). Testers then get a normal app icon and never deal with SDK versions.

---

Next: guide 10 for day-to-day testing (QR codes, publishing new versions, undoing one, SDK upgrades).
