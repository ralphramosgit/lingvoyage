# 11. Rebrand Naviglot to Lingvoyage (platforms)

This renames the app on every platform it runs on: GitHub, Supabase, AWS Lambda and Expo. The app's screens, logo and text (the UI pass) come after, in part 9.

> Written October 17, 2026. Commands are for Git Bash. Each block starts with the `cd` it needs. Keep one terminal window open for the whole of part 3, because later commands reuse a value saved there.

---

## 0. Before you start

### The new names

| Thing | Old | New |
|---|---|---|
| App name (what people see) | `Naviglot` | `Lingvoyage` |
| GitHub repo | `ralphramosgit/naviglot` | `ralphramosgit/lingvoyage` |
| Supabase project | `naviglot` | `lingvoyage` |
| Lambda function | `naviglot-api` | `lingvoyage-api` |
| Expo organization | `naviglot-team` | `lingvoyage-team` |
| Expo project (slug) | `naviglot-test` | `lingvoyage` |
| App link scheme | `naviglot` | `lingvoyage` |

If you pick different names, use yours everywhere below. **Expo only lets you rename an organization a few times**, so settle on the name before part 4.

### What happens on each platform

| Platform | Rename or recreate? | Delete anything? | Changes app settings? |
|---|---|---|---|
| GitHub repo | Rename in place | No | No. You update your local git remote |
| Supabase | Rename in place | **No. Never recreate it**: it holds every user account and all progress | No. URL and keys stay the same |
| AWS Lambda | **Recreate** (AWS can't rename a function) | Yes: the old function, at the end | Yes: new function URL |
| Expo organization | Rename in place | No | `owner` in `app.json` |
| Expo project | **Recreate** (Expo can't change a project's slug) | Yes: the old project, at the end | `slug`, project ID, new QR code |

### Why this order

1. GitHub and Supabase first: quick, and they can't break anything.
2. AWS before Expo, because the new Expo project needs the new Lambda URL.
3. Expo, then push to GitHub.
4. Move teammates to the new QR code.
5. Delete the old Lambda function and Expo project **last**. Until then, teammates' current app keeps working on the old setup, so nobody is stuck mid-change.

### Checklist

- [ ] All your work is committed and pushed: `git status` says "nothing to commit".
- [ ] **Don't push changes in `mobile/` to `main` until part 5.** Every push like that publishes the app to Expo (guide 10), and halfway through the switch that publish would fail or go to the wrong project.
- [ ] About 1 to 1.5 hours free. Parts 3 to 5 are best done in one sitting.
- [ ] A scratch note open (not in the repo) for the new Lambda URL and new Expo project ID.

---

## 1. GitHub repo (rename, 5 minutes)

1. Open **github.com/ralphramosgit/naviglot** > **Settings** (repo tab) > **General**.
2. **Repository name**: type `lingvoyage` > **Rename**.
3. Only after GitHub shows the new name at the top of the repo page, point your local copy at the new address:

    ```bash
    cd ~/projects/naviglot
    git remote set-url origin https://github.com/ralphramosgit/lingvoyage.git
    git remote -v
    git fetch
    ```

    `git remote -v` should show `lingvoyage.git` twice, and `git fetch` should finish with no error.

4. Optional: on the repo's main page, click the gear next to **About** and update the description.

What carries over automatically: all commits, issues, collaborators, the Actions workflow and the `EXPO_TOKEN` secret. GitHub also redirects the old URL to the new one. **Never create a new repo called `naviglot` on your account**, because that breaks the redirect.

The local folder can stay `naviglot` for now. Renaming it is optional (part 8.1), and best done at the very end.

---

## 2. Supabase (rename, 2 minutes)

1. **supabase.com/dashboard** > open the `naviglot` project.
2. **Project Settings** (gear icon, bottom of the left sidebar) > **General**.
3. **Project name**: `lingvoyage` > **Save**.
4. Optional: if your **organization** name also says naviglot, top-left organization menu > **Organization settings** > **General** > change the name > **Save**.

That's all. The Project URL (`https://<random-id>.supabase.co`) is based on a random project ID, not the name, so the URL and publishable key don't change. Nothing in `.env`, Lambda or Expo changes, and every user account and Encounter result stays.

The database has no "naviglot" names in it (the tables are `profiles` and `encounter_progress`), and the app doesn't use email links, so there's nothing to change under **Authentication**.

If the name field can't be edited, leave it. It's only a label on your dashboard. Don't make a new project.

---

## 3. AWS Lambda (new function, about 25 minutes)

AWS has no rename button for Lambda functions. You make a new `lingvoyage-api` function with the same code and settings, switch the app to it, and delete `naviglot-api` in part 7.

Every command passes `--region us-west-2`, because your AWS CLI's default region setting is not a real region.

### 3.1 Sign in to the AWS CLI

```bash
aws login
aws sts get-caller-identity --region us-west-2 --query Arn --output text
```

The second line should print your IAM user (`...:user/naviglot-user`, or `...:user/lingvoyage-user` if you already did part 8.2). If it says "Your session has expired", run `aws login` again.

### 3.2 Build a fresh zip

```bash
cd ~/projects/naviglot/backend
powershell -ExecutionPolicy Bypass -File scripts/build_lambda.ps1
```

It ends with `Created backend\lambda.zip`.

### 3.3 Create the function (AWS Console)

1. Sign in to the AWS Console. Top right, check the region is **US West (Oregon) us-west-2**.
2. **Lambda** > **Create function** > **Author from scratch**:
   - Function name: `lingvoyage-api`
   - Runtime: **Python 3.13**
   - Architecture: **x86_64**
3. Expand **Additional configurations** > tick **Enable function URL** > Auth type **NONE**.
4. **Create function**.

AWS also makes a new permission role for it (named like `lingvoyage-api-role-ab12cd34`) and a new log group. You don't touch either.

### 3.4 Upload the code and copy the settings (AWS CLI)

Upload the zip:

```bash
cd ~/projects/naviglot/backend
aws lambda update-function-code --function-name lingvoyage-api --zip-file fileb://lambda.zip --region us-west-2 --query LastUpdateStatus --output text
aws lambda wait function-updated --function-name lingvoyage-api --region us-west-2
```

The first command prints `InProgress`, and the `wait` returns when the upload is done.

Copy all the environment variables from the old function, and set the handler, memory and timeout. These commands run from your home folder, **outside the repo**, because `lambda-env.json` briefly holds your secret keys:

```bash
cd ~
aws lambda get-function-configuration --function-name naviglot-api --region us-west-2 --query Environment --output json > lambda-env.json

aws lambda update-function-configuration --function-name lingvoyage-api --region us-west-2 \
  --handler app.main.handler --memory-size 512 --timeout 30 \
  --environment file://lambda-env.json --query LastUpdateStatus --output text

aws lambda wait function-updated --function-name lingvoyage-api --region us-west-2
rm lambda-env.json
```

(`--query LastUpdateStatus` stops AWS from printing your keys on the screen.)

Check it matches the old function:

```bash
aws lambda get-function-configuration --function-name lingvoyage-api --region us-west-2 \
  --query '{handler:Handler,memory:MemorySize,timeout:Timeout,runtime:Runtime,vars:keys(Environment.Variables)}'
```

You should see `app.main.handler`, `512`, `30`, `python3.13` and the same variable names as the old function (`APP_ENV`, `SUPABASE_URL`, ... `ANTHROPIC_MODEL`).

**If a command says AccessDenied**, do this step in the Console instead: guide 07 sections 6 to 8 on `lingvoyage-api`. Open `naviglot-api` > **Configuration** > **Environment variables** in a second tab and copy each value across.

### 3.5 Test the new function

Stay in this terminal: the next steps reuse `NEW_URL`.

```bash
NEW_URL=$(aws lambda get-function-url-config --function-name lingvoyage-api --region us-west-2 --query FunctionUrl --output text)
echo "$NEW_URL"
curl -s "${NEW_URL}health"; echo
curl -s -o /dev/null -w "%{http_code}\n" -X POST "${NEW_URL}speech/live-token"
```

Expected:

- the URL, like `https://abc123.lambda-url.us-west-2.on.aws/` (save it in your scratch note)
- `{"status":"ok"}` (the first call can take a couple of seconds while Lambda starts up)
- `401`: correct, that endpoint needs a logged-in user

Anything else: see "When something goes wrong" at the end.

### 3.6 Point your local app at it

This looks the URL up again, so it works in any terminal, and only changes `.env` if it found one:

```bash
cd ~/projects/naviglot/mobile
NEW_URL=$(aws lambda get-function-url-config --function-name lingvoyage-api --region us-west-2 --query FunctionUrl --output text)
[ -n "$NEW_URL" ] && sed -i "s#^EXPO_PUBLIC_API_URL=.*#EXPO_PUBLIC_API_URL=${NEW_URL%/}#" .env
grep API_URL .env
```

`grep` should show the new URL **without** a slash at the end. If it shows `EXPO_PUBLIC_API_URL=` with nothing after it, run `aws login` and run the block again.

Then test it on your phone:

```bash
npx expo start -c
```

Open the app in Expo Go, sign in with your usual account (Supabase didn't change, so it still works), and do one **voice** turn in an Encounter. That proves the new function's keys all work. Stop Expo with **Ctrl+C** when done.

Leave `naviglot-api` running. Teammates' current version still uses it.

---

## 4. Expo (rename the organization, new project, about 25 minutes)

### 4.1 Rename the organization

1. **expo.dev** > account menu (top left) > switch to **naviglot-team**.
2. **Settings** > **Advanced** > **Rename account**.
   - Not the **Display name** box on the **General** page: that's only a label. Expo and `app.json` use the **Name (unique identifier)**, which only **Rename account** changes.
3. New name: `lingvoyage-team`. Follow the steps and confirm. Only an Owner can do this (that's you). The browser address changes to `expo.dev/accounts/lingvoyage-team`.

Members, their roles and the `github-actions` robot user all stay. The old project is now `lingvoyage-team/naviglot-test`. Teammates' old QR code still works, because it uses the project ID, not the name.

### 4.2 Edit `mobile/app.json`

Open `mobile/app.json` in VS Code and make these changes.

At the top:

```json
    "name": "Lingvoyage",
    "slug": "lingvoyage",
    "owner": "lingvoyage-team",
```

A few lines down:

```json
    "scheme": "lingvoyage",
```

In the `expo-audio` plugin:

```json
          "microphonePermission": "Lingvoyage uses the microphone so you can speak with characters in Encounters."
```

At the bottom, **remove the old project ID and update URL**. Change this:

```json
    "extra": {
      "router": {},
      "eas": {
        "projectId": "1660c178-9893-4137-847a-6051488a096f"
      }
    },
    "runtimeVersion": {
      "policy": "sdkVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/1660c178-9893-4137-847a-6051488a096f"
    }
  }
}
```

to this:

```json
    "extra": {
      "router": {}
    },
    "runtimeVersion": {
      "policy": "sdkVersion"
    }
  }
}
```

Keep `runtimeVersion` exactly as it is (guide 10 explains why). Save, then check the file is still valid:

```bash
cd ~/projects/naviglot/mobile
node -e "require('./app.json')" && echo "app.json OK"
```

### 4.3 Create the new Expo project

```bash
cd ~/projects/naviglot/mobile
eas whoami
eas init
```

- `eas whoami` should show `ralphramosxpo`, with `lingvoyage-team` in its account list.
- `eas init` asks something like **"Would you like to create a project for @lingvoyage-team/lingvoyage?"**: answer **Yes**. It writes the new project ID into `app.json`.

If the prompt doesn't react to your keys in Git Bash, press Ctrl+C and run `eas init --non-interactive --force` instead.

Get the new project ID and save it in your scratch note:

```bash
node -p "require('./app.json').expo.extra.eas.projectId"
```

It must be a **new** ID, not `1660c178-...`.

### 4.4 Put the update URL back

In `app.json`, add the `updates` block back after `runtimeVersion`, with your **new** project ID (mind the comma after the `runtimeVersion` block):

```json
    "runtimeVersion": {
      "policy": "sdkVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/NEW_PROJECT_ID"
    }
```

Check both lines show the same new ID:

```bash
grep -n -E "projectId|u.expo.dev" app.json
node -e "require('./app.json')" && echo "app.json OK"
```

Don't run `eas update:configure` for this; it can change `runtimeVersion`.

### 4.5 Copy the app's settings to the new project

The new project starts with no environment variables. These commands read the three values from `mobile/.env` into the terminal and send them to Expo:

```bash
cd ~/projects/naviglot/mobile
source .env
echo "$EXPO_PUBLIC_API_URL"
```

That URL must be the `lingvoyage-api` URL from part 3. If it prints an empty line, redo 3.6 first. If it is right:

```bash
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value "$EXPO_PUBLIC_SUPABASE_URL" --environment preview --visibility plaintext --non-interactive
eas env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "$EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" --environment preview --visibility plaintext --non-interactive
eas env:set --name EXPO_PUBLIC_API_URL --value "$EXPO_PUBLIC_API_URL" --environment preview --visibility plaintext --non-interactive
eas env:list --environment preview
```

`env:list` should show all three.

### 4.6 Publish the first Lingvoyage version

```bash
eas update --channel preview --environment preview --message "First Lingvoyage version"
```

If it asks to create the `preview` channel or branch, say yes. It ends with **Published!**.

### 4.7 Make the new permanent QR code and test it

```bash
cd ~/projects/naviglot/mobile
PROJECT_ID=$(node -p "require('./app.json').expo.extra.eas.projectId")
QR_LINK="https://qr.expo.dev/eas-update?projectId=$PROJECT_ID&runtimeVersion=exposdk%3A57.0.0&channel=preview"
echo "$QR_LINK"
curl -s -o ../docs/setup/lingvoyage-qr.svg "$QR_LINK"
```

This saves the QR code as `docs/setup/lingvoyage-qr.svg`. Then:

1. Make sure `npx expo start` isn't running.
2. Open the printed link in your PC's browser and scan the QR code with your iPhone Camera.
3. Expo Go should open **Lingvoyage**. Sign in and do one voice turn.

Don't send it to teammates yet. Part 5 comes first.

---

## 5. Update the repo and push (10 minutes)

Guides 05, 07, 09 and 10 contain the old project ID, QR file, organization, project and function names. This replaces exactly those:

```bash
cd ~/projects/naviglot
OLD_ID=1660c178-9893-4137-847a-6051488a096f
NEW_ID=$(node -p "require('./mobile/app.json').expo.extra.eas.projectId")
echo "$NEW_ID"

sed -i \
  -e "s/$OLD_ID/$NEW_ID/g" \
  -e "s/1660c178-\.\.\./${NEW_ID:0:8}-.../g" \
  -e "s/naviglot-qr\.svg/lingvoyage-qr.svg/g" \
  -e "s/naviglot-team/lingvoyage-team/g" \
  -e "s/naviglot-test/lingvoyage/g" \
  -e "s/naviglot-api/lingvoyage-api/g" \
  docs/setup/05-environment-variables.md docs/setup/07-aws-deploy.md \
  docs/setup/09-share-with-teammates.md docs/setup/10-expo-testing-guide.md

git rm -q docs/setup/naviglot-qr.svg
git status
```

`git status` should list `mobile/app.json`, the four guides, `lingvoyage-qr.svg`, this guide and the deleted `naviglot-qr.svg`. **No `.env` file must appear.** Then:

```bash
git add mobile/app.json docs/setup
git commit -m "Rebrand platforms to Lingvoyage: new Expo project and Lambda function"
git push
```

Because `mobile/app.json` changed, the push runs the **Publish app update** GitHub Action, now publishing to the new project. Check:

1. GitHub > `lingvoyage` repo > **Actions**: the run ends green (3 to 5 minutes).
2. expo.dev > **lingvoyage-team** > **lingvoyage** > **Updates**: a new update with your commit message.

If the publish step fails with a login or permission error, see "When something goes wrong".

The rest of the "Naviglot" text in the code and docs is part 9. It doesn't affect any platform.

---

## 6. Move teammates over (5 minutes)

Teammates don't need a new invite: they're still members of the same organization, now called `lingvoyage-team`. Send this, with `docs/setup/lingvoyage-qr.svg` attached (or a screenshot of the QR link page):

> **Naviglot is now Lingvoyage**
>
> 1. Open Expo Go and check you're signed in with the same Expo account as before.
> 2. Scan the attached QR code:
>    - **iPhone:** normal Camera app, then tap the banner.
>    - **Android:** in Expo Go, tap **Scan QR code**.
> 3. **Lingvoyage** opens. Sign in with your usual email and password. Your account and progress are still there.
> 4. From now on, open **Lingvoyage** under **Recently opened**. The old **Naviglot** entry will stop working soon, so ignore it.
>
> If you have the code on your PC, run this in the repo folder:
> `git remote set-url origin https://github.com/ralphramosgit/lingvoyage.git`

Wait until everyone has confirmed it works before part 7.

---

## 7. Delete the old things (15 minutes, after everyone has switched)

Do these only once every teammate is on the new QR code. A couple of days later is fine; the old pieces cost nothing while they wait.

### 7.1 Check nothing still uses the old Lambda function

1. Lambda > **naviglot-api** > **Monitor**: the **Invocations** graph should be flat for the last day.
2. Confirm the app points at the new function. The URL these print:

    ```bash
    cd ~/projects/naviglot/mobile
    aws lambda get-function-url-config --function-name lingvoyage-api --region us-west-2 --query FunctionUrl --output text
    grep API_URL .env
    eas env:list --environment preview
    ```

    must match `EXPO_PUBLIC_API_URL` in both other places (the first one just has an extra `/` at the end).

### 7.2 Delete the old Expo project

1. expo.dev > **lingvoyage-team** > **naviglot-test**.
2. **Project settings** > **General** > **Delete project**, and type the name to confirm.

The old QR code stops working from this moment, which is why everyone has to have moved first. `docs/setup/10` already links to the new one.

### 7.3 Delete the old Lambda function

```bash
aws lambda delete-function --function-name naviglot-api --region us-west-2
```

No output means it worked. (Console: Lambda > Functions > tick `naviglot-api` > **Actions** > **Delete**.) Its function URL goes with it.

### 7.4 Delete its logs

```bash
MSYS_NO_PATHCONV=1 aws logs delete-log-group --log-group-name /aws/lambda/naviglot-api --region us-west-2
```

(`MSYS_NO_PATHCONV=1` stops Git Bash from turning `/aws/...` into a Windows path.) If it says the log group doesn't exist, there's nothing to delete.

### 7.5 Delete its permission role and policy (AWS Console)

1. **IAM** > **Roles** > search `naviglot-api` > select `naviglot-api-role-...` > **Delete**, and type the name to confirm.
2. **IAM** > **Policies** > search `AWSLambdaBasicExecutionRole`. AWS made one for each function, so you may see two. Open each: the old one's JSON mentions `/aws/lambda/naviglot-api` and its **Entities attached** tab is empty. Delete only that one. **Keep the one that mentions `lingvoyage-api`.**

### 7.6 Only if you made the deploy-only user from guide 07 section 12

The `naviglot-deploy` policy only allows `function:naviglot-api`. Either edit its JSON to `function:lingvoyage-api`, or delete the user and policy if you don't use them (your `aws login` session as `naviglot-user` already deploys).

### Nothing to delete on

- **GitHub**: the repo was renamed, not copied.
- **Supabase**: same project, renamed.

---

## 8. Optional renames (other places that still say naviglot)

None of these are visible to users, and leaving them breaks nothing.

### 8.1 The folder on your PC

Do this last. Close VS Code, stop Expo and uvicorn, and open a **new** Git Bash window (Windows won't move a folder that's open somewhere).

```bash
cd ~/projects
mv naviglot lingvoyage

# Claude Code keeps its notes about this project per folder path; copy them across
cp -r ~/.claude/projects/c--Users-ralph-projects-naviglot ~/.claude/projects/c--Users-ralph-projects-lingvoyage

# The Python virtual environment remembers its old folder, so rebuild it
cd ~/projects/lingvoyage/backend
rm -rf .venv
py -3.13 -m venv .venv
source .venv/Scripts/activate
pip install -r requirements-dev.txt

code ~/projects/lingvoyage
```

`mobile/node_modules` survives the move. Run `npx expo start -c` the first time afterwards.

### 8.2 AWS IAM user and account alias

- **IAM user `naviglot-user`**: safe to rename (checked October 18, 2026). It has `AdministratorAccess` and no access keys, and no policy refers to it by name. Its password, MFA and permissions all stay. There's no rename button in the Console, so use the CLI:

    ```bash
    aws iam update-user --user-name naviglot-user --new-user-name lingvoyage-user --region us-west-2
    aws login
    aws sts get-caller-identity --region us-west-2 --query Arn --output text
    ```

    The last line should end in `user/lingvoyage-user`. From now on, sign in to the Console as `lingvoyage-user`, and update the username in your browser or password manager if it saved the login.

- **MFA device `naviglot-aws`**: MFA devices can't be renamed, and only you see this name. To change it anyway, add the new device first, then remove the old one, so you're never left without MFA: IAM > Users > `lingvoyage-user` > **Security credentials** > **Assign MFA device** (name it `lingvoyage-aws`, scan it into your authenticator app) > then **Remove** `naviglot-aws`.

- **Other users in this account** (`kaichecks-admin`, `rjrcloud-user` and others) belong to other projects. Leave them alone.

- **Sign-in URL**: this account has no alias, so the sign-in link uses the account number and has no app name in it. Nothing to change.

### 8.3 API key labels

The ElevenLabs and Anthropic keys are labeled `naviglot-backend`. Rename them if the dashboard lets you. Don't make new keys just for the name: a new key means updating `backend/.env` and the Lambda environment variables, then deleting the old key.

### 8.4 Later, when you make real installable builds

Pick the store name and bundle ID (for example `com.yourname.lingvoyage`) then. Expo Go doesn't use either.

---

## 9. "Naviglot" still in the code and docs (for your UI pass)

These don't affect any platform. Change them whenever you do the UI. You can also ask Claude Code to "do part 9 of guide 11", leaving out whatever you want to design yourself.

### Shown in the app

| File | What |
|---|---|
| `mobile/src/app/(auth)/welcome.tsx` | Big app name on the welcome screen |
| `mobile/src/app/(auth)/sign-in.tsx` | "New to Naviglot?" (text and accessibility label) |
| `mobile/src/app/(tabs)/profile.tsx` | "Naviglot v1.0.0" at the bottom |
| `mobile/src/components/LogoMark.tsx` | Logo and its accessibility label |
| `mobile/src/components/talk/MicPermissionCard.tsx` | Microphone help text |
| `mobile/src/lib/api.ts` | "Can't reach the Naviglot server" error |
| `mobile/assets/images/` | Icon and splash images, if they show the old logo |

These go out through a normal push to `main` (GitHub Action).

### Internal only

| File | What | Note |
|---|---|---|
| `mobile/package.json` and `package-lock.json` | `naviglot-mobile` | Change both: `sed -i 's/"naviglot-mobile"/"lingvoyage-mobile"/' mobile/package.json mobile/package-lock.json` |
| `mobile/src/lib/settings.tsx` | `naviglot.settings.v1` storage key | Renaming it resets everyone's in-app settings to defaults once. Fine to leave |
| `mobile/src/lib/audio.ts` | `naviglot-audio` cache folder | Safe to rename |
| `backend/app/*.py` | Logger names (`naviglot.auth`, ...) and the API title | Needs a backend deploy (below) |
| `backend/scripts/check_keys.py` | Test sentence and heading | Local only |

After changing anything in `backend/`, deploy it to the new function:

```bash
cd ~/projects/naviglot/backend
powershell -ExecutionPolicy Bypass -File scripts/build_lambda.ps1
aws lambda update-function-code --function-name lingvoyage-api --zip-file fileb://lambda.zip --region us-west-2 --query LastUpdateStatus --output text
```

### Docs

`README.md`, `mobile/README.md`, `backend/README.md`, `docs/setup/00` to `10` (including the "Navigate + glot" explanation, which needs rewriting, not a find-and-replace), `docs/CLAUDE_CODE_PROMPT.md`, and `docs/architecture.png` (an image, so it needs redrawing).

---

## Done when

- [ ] GitHub repo is `ralphramosgit/lingvoyage`, and `git remote -v` shows it
- [ ] Supabase project is called `lingvoyage` (same URL and keys)
- [ ] `lingvoyage-api` answers `/health`, and the app's voice turns work through it
- [ ] Expo organization is `lingvoyage-team`, project is `lingvoyage`, with 3 preview variables
- [ ] The push to `main` published to the new project (green Action run)
- [ ] Every teammate has opened Lingvoyage from the new QR code
- [ ] Old `naviglot-test` project, `naviglot-api` function, its log group, role and policy are deleted

---

## When something goes wrong

| What you see | Why | Fix |
|---|---|---|
| `git fetch` or `git push`: "Repository not found" right after `set-url` | The repo hasn't been renamed on GitHub yet | Do part 1 step 2, then `git fetch` again. No need to redo `set-url` |
| `git push`: "Repository not found" later on | The local remote still points at `naviglot.git` | Part 1 step 3 |
| AWS: "Your session has expired" | `aws login` sessions time out | Run `aws login` again |
| AWS: "ResourceConflictException ... update is in progress" | The previous change hadn't finished | Run the `aws lambda wait function-updated ...` line, then repeat the command |
| `/health` gives "Internal Server Error" or `{"message":null}` | Handler not set, or the zip didn't upload | Redo 3.4. Check logs: Lambda > `lingvoyage-api` > **Monitor** > **View CloudWatch logs** |
| `/health` works but the app says "Couldn't verify your login" | Environment variables weren't copied | Run the check command in 3.4; compare with the old function |
| Voice turns fail with "Task timed out after 3.00 seconds" | Timeout still at the default | Set 30 s and 512 MB (3.4) |
| `eas init`: "You don't have permission to create a new project on the lingvoyage-team account" | The organization hasn't been renamed on expo.dev yet. `eas whoami` still lists `naviglot-team` | Do 4.1, check `eas whoami` shows `lingvoyage-team`, then run `eas init` again |
| `eas init`: slug doesn't match the project ID | The old `extra.eas.projectId` is still in `app.json` | Remove it (4.2) and run `eas init` again |
| EAS: "Experience with name @naviglot-team/... does not exist", or an owner mismatch | `owner` in `app.json` still says `naviglot-team` | Set it to `lingvoyage-team` |
| Rename on expo.dev says the name is taken | Expo account names are shared by everyone | Pick another, then use it everywhere in this guide |
| App opens from the new QR code, then closes or says "Missing EXPO_PUBLIC_..." | The new project has no environment variables | 4.5, then publish again (4.6) |
| "Network error" in the published app but not with `npx expo start` | `EXPO_PUBLIC_API_URL` on Expo is wrong | `eas env:list --environment preview`; fix with `eas env:set ...` and publish again |
| GitHub Action publish step fails with a login or permission error | The robot's token no longer has access | expo.dev > **lingvoyage-team** > **Settings** > **Access tokens** > new token for `github-actions` > replace the `EXPO_TOKEN` repo secret on GitHub > re-run the workflow |
| Teammate: "no access to this project" | Not signed in to Expo Go, or with a different account | Check they're listed under **lingvoyage-team** > **Settings** > **Members** |
| Teammate still sees "Naviglot" | They opened the old entry in Recently opened | Scan the new QR code (part 6) |
| `mv naviglot lingvoyage`: "Device or resource busy" | VS Code, a terminal or Expo still has the folder open | Close them all and use a new Git Bash window (8.1) |
