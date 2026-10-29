# 01. Lead developer guide: team access

This is for you, the lead (Ralph). It sets up access so that:

- **Developers** work on the app in `mobile/` through pull requests, run it on their own phones, and never get AWS, Supabase, the API keys or the power to deploy unreviewed code.
- **Non-devs** (testers) open the latest version in Expo Go with nothing but an Expo account.
- **Only you** can change the backend, the database, the deploy workflows, or what testers receive without a review.

Time: about 45 minutes once, then 2 minutes per new person.

> Written October 21, 2026, against the repo as it is today (`ralphramosgit/lingvoyage`, public) and Expo's and GitHub's docs. Commands are for Git Bash. Guides in `docs/setup/` are referred to by number ("guide 10").

---

## The access model

| | You | Developers | Non-devs | GitHub Actions |
|---|---|---|---|---|
| GitHub repo | Owner | Collaborator. Changes reach `main` only through an approved PR | Not needed (can still open issues) | — |
| Changes to `backend/`, `.github/`, `docs/`, key app config | Yes | Only with **your** approval | No | Deploys what's on `main` |
| Expo org `lingvoyage-team` | Owner | **Viewer** | **Viewer** | Robot `github-actions`: **Release Manager** |
| Publish to testers' Expo Go | Yes | Only by getting a PR merged | No | Yes, on every merge to `main` |
| Supabase dashboard | Owner | None | None | None |
| AWS console | Admin | None | None | Can only upload code to `lingvoyage-api`, only from `main` (guide 12) |
| Claude / ElevenLabs consoles | Yes | None | None | None |
| `mobile/.env` (3 public values) | Yes | Yes, you send it | No | Comes from EAS, not GitHub |
| Secret keys (Claude, ElevenLabs) | Lambda + your `backend/.env` | **Never** | **Never** | **Never** |

### Why this is enough

The app needs only three values: the Supabase URL, the Supabase **publishable** key and the Lambda URL. All three are already inside every copy of the app, so giving them to developers exposes nothing new. The real secrets live in Lambda's environment variables and your own `backend/.env`.

A developer could reach those secrets in only two ways:

1. **Through the AWS console.** They never get an AWS login.
2. **By getting code deployed.** Backend code that runs on Lambda can read Lambda's environment variables. Code only deploys from `main`, so the job is to make sure nothing lands on `main` without review, and nothing in `backend/` or `.github/` lands without **your** review. That's Part 1.

One small gap is left open on purpose. A collaborator could write a workflow on their own branch that reads the `EXPO_TOKEN` repository secret. The worst they could do with it is publish to testers' Expo Go or change the three public settings on Expo, and both are easy to undo. For a team you know, that isn't worth extra setup. If it ever is, see [Optional: lock `EXPO_TOKEN` to `main`](#optional-lock-expo_token-to-main) at the end.

### Your repo is public, and what that means

`ralphramosgit/lingvoyage` is public (checked October 21, 2026).

- **Anyone can read the backend code**, developers included. That's fine: no key has ever been committed (only the two `.env.example` files, checked in the git history). GitHub can't hide one folder from collaborators anyway. If you ever need the backend code hidden, it has to move to a separate private repo.
- **The protection features you need are free on public repos**: rulesets, required code-owner review and environments. If you make the repo private, all three need a paid GitHub plan (Pro). Without them, any collaborator could push straight to `main`.
- **On a personal-account repo, every collaborator has the same write access.** There's no read-only role. The ruleset in Part 1.3 is what stops write access from meaning "can change `main`".

---

## Part 1: GitHub

### 1.1 Decide who stays a collaborator

Settings > **Collaborators**.

- **Developers**: keep them.
- **Non-devs**: remove them. They don't need write access to test the app, and on a public repo they can still open issues to report bugs with any GitHub account. Fewer people with write access means less to go wrong.

### 1.2 Add code owners and a PR check

Two new files, pushed to `main` in one commit.

**a) `.github/CODEOWNERS`** (new file). PRs that touch these paths can't merge until you approve. Everything else in `mobile/` can be approved by any developer.

```
# Changes to these paths need Ralph's approval before they merge to main.
# Everything else can be approved by any developer.

# Backend, deploys and infrastructure docs
/backend/                       @ralphramosgit
/.github/                       @ralphramosgit
/docs/                          @ralphramosgit
/README.md                      @ralphramosgit

# App config that can break Expo Go for every tester
/mobile/app.json                @ralphramosgit
/mobile/package.json            @ralphramosgit

# The app's contract with the backend and the database
/mobile/src/types/api.ts        @ralphramosgit
/mobile/src/types/database.ts   @ralphramosgit
/mobile/src/lib/env.ts          @ralphramosgit
```

| Path | Why it's yours |
|---|---|
| `backend/`, `.github/` | Deploys to Lambda, and the workflows that hold the deploy permissions |
| `docs/`, `README.md` | Your setup and access docs |
| `mobile/app.json` | `slug`, `owner`, `runtimeVersion` and `updates` must match Expo, or the app stops opening for everyone |
| `mobile/package.json` | A library with native code doesn't run in Expo Go |
| `mobile/src/types/*`, `mobile/src/lib/env.ts` | Must match what the backend and database actually do |

Want to approve every PR yourself? Put `*  @ralphramosgit` as the first rule.

**b) `.github/workflows/pr-checks.yml`** (new file). Runs the mobile typecheck and lint, and the backend tests, on every PR, so problems show up before merging, not after. It uses no secrets.

```yaml
# Runs the same checks as the publish and deploy workflows on every pull request into main, so errors
# show up before merging instead of after. Uses no secrets. Required to pass by the main ruleset (team guide 01).
name: PR checks

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  mobile:
    name: mobile typecheck and lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: mobile
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: mobile/package-lock.json

      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint

  backend:
    name: backend tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-python@v7
        with:
          python-version: '3.13'
          cache: pip
          cache-dependency-path: backend/requirements*.txt

      - run: pip install -r requirements-dev.txt
      - run: python -m pytest
```

There's no `paths:` filter on purpose. A required check that gets skipped stays "waiting" forever and blocks the merge.

Commit and push:

```bash
git add .github/CODEOWNERS .github/workflows/pr-checks.yml
git commit -m "add code owners and PR checks"
git push
```

This push doesn't publish or deploy anything. The new check first runs on the next PR.

### 1.3 Protect `main` with a ruleset

GitHub > **Settings** > **Rules** > **Rulesets** > **New ruleset** > **New branch ruleset**.

| Setting | Value |
|---|---|
| Ruleset name | `main` |
| Enforcement status | **Active** |
| Bypass list | **Add bypass** > **Repository admin** (that's you) > **Always allow** |
| Target branches | **Add target** > **Include default branch** |
| Restrict deletions | On |
| Block force pushes | On |
| Require a pull request before merging | On, with these options: |
| ↳ Required approvals | `1` |
| ↳ Dismiss stale pull request approvals when new commits are pushed | On |
| ↳ Require review from Code Owners | On |
| ↳ Require approval of the most recent reviewable push | On |
| ↳ Require conversation resolution before merging | On |
| ↳ Allowed merge methods | **Squash** only |
| Require status checks to pass | On. **Add checks** > `mobile typecheck and lint` and `backend tests` |
| ↳ Require branches to be up to date before merging | Off (otherwise every open PR needs updating after each merge) |

**Create**.

If `mobile typecheck and lint` or `backend tests` isn't offered in the search, the check hasn't run yet. Save the ruleset without it, have a developer open any PR, then come back and add it.

What this does:

- Nobody but you can push to `main` or delete it.
- Every change arrives as a PR with one approval and green checks.
- PRs that touch code-owned paths need **your** approval specifically.
- A new push after approval clears the approval, so nobody can sneak a change in after review.

**Your own PRs:** GitHub never lets you approve your own PR. Because you're on the bypass list, the merge box offers **Merge without waiting for requirements to be met (bypass rules)**. You can also keep pushing straight to `main` as you do now. Both deploy workflows run the same way either way.

**Test it:** ask a developer to try `git push origin main` with any small change. It should be refused with "push declined due to repository rule violations".

### 1.4 Check two Actions settings

Settings > **Actions** > **General**:

- **Fork pull request workflows**: choose the strictest approval option (approval required for all outside contributors). The repo is public, so strangers can open PRs.
- **Workflow permissions**: **Read repository contents and packages permissions**. Leave **Allow GitHub Actions to create and approve pull requests** unticked.

### 1.5 Use issues for all work

Developers name branches after issues (`issue-12`, see team guide 02), so every task needs a GitHub issue. Write the issue, assign it to someone, and they take it from there. A `backend` label helps separate the requests that come to you.

---

## Part 2: Expo

### 2.1 Roles

| Who | Role | Why |
|---|---|---|
| You | Owner | |
| Robot `github-actions` | **Release Manager** | Publishes on every merge to `main`. Needs Release Manager to publish to the protected `preview` channel (2.3) |
| Developers | **Viewer** | Can open the app in Expo Go. Can't publish, change environment variables or credentials |
| Non-devs | **Viewer** | Same |

**Don't give anyone Developer.** A Developer can run `eas update` from their laptop and send unreviewed code straight to every tester, skipping the PR and your review. Guides 09 and 10 suggest switching a Viewer who can't load the app to Developer. Don't. The cause is almost always that they aren't signed in to Expo Go, used a different account, or never accepted the invite.

Developers don't need any Expo role to run the app locally with `npx expo start`. Viewer is for opening the published version.

### 2.2 Invite people

expo.dev > **lingvoyage-team** > **Settings** > **Members** > **Invite**. Enter their email and pick **Viewer**. Use the email they'll sign in to Expo Go with.

**Remove someone:** same page. Expo Go stops loading the app for them right away.

### 2.3 Protect the `preview` channel

Belt and braces: even if someone ends up with Developer one day, they still can't publish to the channel testers use.

1. **First** give the robot the role it needs, or the next publish fails: expo.dev > **lingvoyage-team** > **Settings** > **Access tokens** > robot `github-actions` > change its role to **Release Manager**.
2. Then protect the channel (needs EAS CLI 24 or newer):

    ```bash
    cd mobile
    eas channel:protect preview
    ```

3. Check: GitHub > **Actions** > **Publish app update** > **Run workflow** (branch `main`). It should go green.

If `eas channel:protect` is refused on your plan, skip it. The Viewer role alone already stops developers and testers from publishing.

### 2.4 Leave the EAS environment variables as they are

The `preview` environment on expo.dev holds the three public `EXPO_PUBLIC_*` values the published app uses (guide 09, step 4). Viewers can't change them. Nothing to do here.

---

## Part 3: Supabase

1. **Don't invite anyone.** supabase.com/dashboard > your organization > **Team**. Only you should be listed. Guide 00 said "invite teammates", so remove anyone you added then.
2. **Developers only ever get the URL and the publishable key.** Those are in every copy of the app. What stops someone with them from reading other people's data is **row-level security**, which is on for `profiles` and `encounter_progress` (guide 02). Any table you add later needs RLS and policies **before** the app uses it.
3. **Never share:** the database password, any secret key (`sb_secret_...`) or `service_role` key, or a Supabase access token.
4. **Test accounts:** developers and testers create their own Lingvoyage accounts in the app (Confirm email is off). They live in the same project as everyone else's. To clean up later: **Authentication** > **Users**.
5. **Schema changes are yours.** A developer who needs a new table or column opens an issue. You change the database and update `mobile/src/types/database.ts`, which is code-owned.

---

## Part 4: AWS, Claude and ElevenLabs

- **No IAM users or console access for anyone else.** Nobody on the team needs AWS. Backend requests come to you as issues.
- **The Lambda URL isn't a secret.** It's inside every copy of the app. `/health` and `/scenarios` are open. Every route that costs money (`/tts`, `/speech/*`, `/conversation/*`) needs a valid Supabase login.
- **Everybody's testing spends your credits.** Anyone who signs up in the app can make voice turns. Put a ceiling on it:
  - **Anthropic Console**: set a monthly spend limit.
  - **ElevenLabs**: stay on a plan with a fixed credit quota, with usage-based billing (overage) off.
  - **AWS**: **Billing** > **Budgets** > create a monthly cost budget with an email alert (a few dollars is plenty for Lambda).

---

## Part 5: What to give each person

### Developers

1. **GitHub:** already a collaborator. ✔
2. **Expo:** invite as **Viewer** (2.2).
3. **Their `mobile/.env`.** Get the exact values the published app uses:

    ```bash
    cd mobile
    eas env:list --environment preview
    ```

    Send them these three lines **in a private message** (not in the repo, an issue or a group channel):

    ```ini
    EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
    EXPO_PUBLIC_API_URL=https://xxxxxxxxxx.lambda-url.us-west-2.on.aws
    ```

    `EXPO_PUBLIC_API_URL` must be the **Lambda** URL, never your `192.168.x.x` address. Developers don't run the backend.

    These aren't secrets, so why privately? They're in the app anyway, but keeping them out of a public repo keeps bots that crawl GitHub from finding your API and running up your bill.

4. **Their guide:** [team guide 02, Dev environment](02-dev-environment-guide.md).
5. **An issue to start on.**

### Non-devs

1. **Expo:** invite as **Viewer** (2.2).
2. **Their guide:** [team guide 03, Test the app on your phone](03-test-on-your-phone.md). It has the QR code and every step.

That's all. No `.env`, no GitHub, no installs beyond Expo Go.

### Never send anyone

`backend/.env`, any `sk_...` or `sk-ant-...` key, the Supabase database password or secret key, anything AWS, or an Expo access token.

### Messages you can paste

**To a developer:**

> You're set up for Lingvoyage:
> - GitHub: you're already a collaborator on ralphramosgit/lingvoyage.
> - Expo: accept the invite to **lingvoyage-team** in your email (create a free Expo account with that email if asked).
> - I'll DM you the three lines for `mobile/.env`. Never commit them.
>
> Then follow `docs/team/02-dev-environment-guide.md` in the repo. Your first issue is #__.

**To a non-dev:**

> You're invited to test Lingvoyage! Check your email for an Expo invite to **lingvoyage-team** and accept it. Then follow the steps here (about 10 minutes): https://github.com/ralphramosgit/lingvoyage/blob/main/docs/team/03-test-on-your-phone.md

---

## Part 6: Day to day

- **Reviewing a PR:** read the **Files changed** tab. To try it on your phone:

    ```bash
    git fetch origin
    git switch issue-12
    cd mobile && npm install && npx expo start -c
    ```

- **Merging is publishing.** Every merge to `main` that touches `mobile/` reaches testers' Expo Go about 3 to 5 minutes later (guide 10). Don't merge half-finished screens.
- **An app change that needs a new backend route:** ship the backend first (merge or push to `main`, wait for **Deploy backend** to go green), **then** merge the app PR. Otherwise testers get a screen that calls a route Lambda doesn't have yet.
- **Undo a bad publish:** `eas update:republish` (guide 10, "Undoing a bad version"), or revert the PR on GitHub (**Revert** button on the merged PR) and merge the revert.
- **Someone leaves:** remove them from GitHub **Collaborators** and Expo **Members**. Nothing to rotate: they never had a secret. (If you think someone copied `EXPO_TOKEN`, make a new token on expo.dev and replace the GitHub secret.)

---

## Checklist

- [ ] 1.1 Non-devs removed from GitHub collaborators
- [ ] 1.2 `CODEOWNERS` and `pr-checks.yml` are on `main`
- [ ] 1.3 Ruleset `main` is active, with `mobile typecheck and lint` and `backend tests` required, and a developer's direct push to `main` is refused
- [ ] 1.4 Fork PR approval and read-only workflow permissions set
- [ ] 2.1 to 2.2 Developers and non-devs are **Viewer** in Expo
- [ ] 2.3 Robot is **Release Manager** and `preview` is protected
- [ ] 3 Supabase **Team** lists only you
- [ ] 4 No other AWS users, a budget alert, and Claude and ElevenLabs spend limits
- [ ] 5 Developers got `.env` and guide 02; non-devs got guide 03

---

## Optional: lock `EXPO_TOKEN` to `main`

Skip this for a small team you know. It's worth doing if the team grows, includes people you don't know well, or someone leaves on bad terms.

**What it closes:** a collaborator can push a branch with their own workflow file, and that workflow receives every repository secret. With `EXPO_TOKEN` they could publish to testers' Expo Go or change the settings on Expo. They couldn't reach the Claude or ElevenLabs keys, AWS or Supabase. An **environment** secret is only handed to jobs that run from `main`.

1. expo.dev > **lingvoyage-team** > **Settings** > **Access tokens** > robot `github-actions` > **Create token**. Copy it.
2. GitHub > **Settings** > **Environments** > **New environment** > `expo-preview` > **Configure environment**.
3. **Deployment branches and tags** > **Selected branches and tags** > **Add deployment branch or tag rule** > `main`.
4. **Environment secrets** > **Add environment secret**: `EXPO_TOKEN` = the new token.
5. In `.github/workflows/eas-update.yml`, add `environment: expo-preview` to the job and push:

    ```yaml
    jobs:
      publish:
        runs-on: ubuntu-latest
        environment: expo-preview   # EXPO_TOKEN lives here, and only main can use it
        timeout-minutes: 20
    ```

6. Check that **Publish app update** goes green in the **Actions** tab. Then delete the repository-level `EXPO_TOKEN` (**Settings** > **Secrets and variables** > **Actions**) and the old token on expo.dev.

**Don't do the same for `AWS_DEPLOY_ROLE_ARN`.** It isn't a password, and the AWS role already accepts only runs from `main` (guide 12, step 4). Putting the backend deploy job in an environment changes what GitHub tells AWS (`...:environment:<name>` instead of `...:ref:refs/heads/main`), and the deploy fails with "Not authorized to perform sts:AssumeRoleWithWebIdentity".
