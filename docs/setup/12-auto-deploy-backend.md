# 12. Deploy the backend automatically from GitHub

After this one-time setup, every push to `main` that changes something in `backend/` goes live on the `lingvoyage-api` Lambda function by itself, the same way guide 10's GitHub Action publishes the app. You stop building and uploading `lambda.zip` by hand.

`.github/workflows/deploy-backend.yml` does exactly what you'd do by hand (guide 07, section 12):

1. Installs the Python packages and runs the backend tests (`python -m pytest`). If a test fails, nothing is deployed.
2. Builds `lambda.zip` the same way `scripts/build_lambda.ps1` does (Linux packages for Python 3.13, x86_64, plus `app/`).
3. Uploads it to `lingvoyage-api` and waits for Lambda to finish updating.
4. Opens `/health` on the function URL and fails the run if it doesn't answer `{"status":"ok"}`.

It only replaces the code. Environment variables, memory, timeout and handler stay as you set them in the console.

---

## No access key needed

GitHub signs in to AWS with **OpenID Connect (OIDC)**. You make an IAM **role** that only this repo's `main` branch is allowed to use, and that can only update `lingvoyage-api`. On each run, GitHub proves to AWS which repo and branch it's running for, and AWS hands it a temporary key that expires within the hour.

So there's no permanent key to copy, paste into GitHub, rotate or leak. The only thing GitHub stores is the role's name (its ARN), which isn't a password.

(A deploy-only user with an access key, like the one in guide 07 section 12, would also work, but then a permanent AWS password sits in GitHub's secrets. Don't bother.)

---

## One-time setup (about 10 minutes)

Sign in to the AWS Console as your admin user. IAM isn't tied to a region, so the region menu doesn't matter for these steps.

### 1. Find your account ID

Top-right account menu > **Account ID** (12 digits). Copy it without the dashes. You need it in step 3.

### 2. Let AWS trust GitHub

1. Search **IAM** > **Identity providers** > **Add provider**.
2. Provider type: **OpenID Connect**.
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. **Add provider**.

You only do this once per AWS account. If the list already has other providers (Vercel's `oidc.vercel.com`, for example), leave them alone.

### 3. Make the permission policy

1. IAM > **Policies** > **Create policy** > **JSON**.
2. Replace everything with this, putting your account ID in place of `ACCOUNT_ID`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "lambda:UpdateFunctionCode",
           "lambda:GetFunction",
           "lambda:GetFunctionConfiguration",
           "lambda:GetFunctionUrlConfig"
         ],
         "Resource": "arn:aws:lambda:us-west-2:ACCOUNT_ID:function:lingvoyage-api"
       }
     ]
   }
   ```

3. **Next** > Policy name: `lingvoyage-deploy` > **Create policy**.

If you already made a `lingvoyage-deploy` policy in guide 07 section 12, open it and **Edit** it to this JSON instead. The workflow needs the extra `lambda:GetFunctionUrlConfig` to find the URL for the `/health` check.

This policy can upload new code to `lingvoyage-api` and read its settings. It can't change environment variables, read your keys, delete the function or touch anything else in the account.

### 4. Make the role GitHub uses

1. IAM > **Roles** > **Create role**.
2. Trusted entity type: **Web identity**.
3. Identity provider: `token.actions.githubusercontent.com`. Audience: `sts.amazonaws.com`.
4. Fill in the GitHub fields that appear:
   - GitHub organization: `ralphramosgit` (your GitHub username: the repo isn't in an organization)
   - GitHub repository: `lingvoyage`
   - GitHub branch: `main`
5. **Next** > search `lingvoyage-deploy` and tick it > **Next**.
6. Role name: `lingvoyage-github-deploy` > **Create role**.
7. Open the new role. Copy its **ARN** from the Summary box. It looks like `arn:aws:iam::123456789012:role/lingvoyage-github-deploy`.

Check: the role's **Trust relationships** tab should contain this line:

```
"token.actions.githubusercontent.com:sub": "repo:ralphramosgit/lingvoyage:ref:refs/heads/main"
```

That line is what stops other repos, forks and other branches from using the role.

### 5. Give GitHub the role ARN

On GitHub: the `lingvoyage` repo > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**.

- Name: `AWS_DEPLOY_ROLE_ARN`
- Secret: the ARN from step 4

It isn't a password, but it contains your account ID, so it lives in GitHub's settings rather than in the repo.

### 6. Push the workflow and check the first run

Commit and push `.github/workflows/deploy-backend.yml` to `main`. A change to the workflow file runs it once. On GitHub, open **Actions** > **Deploy backend**. The run should end green, and the **Check /health** step should print `{"status":"ok"}`.

If you pushed before finishing steps 2 to 5, that first run goes red at **Configure AWS credentials**. Finish the setup, then open the run and click **Re-run all jobs**.

---

## Day to day

- **Push to `main` with a `backend/` change**: a minute or two later the new code is live. Watch it in the **Actions** tab. Pushes to other branches deploy nothing.
- **Redeploy without a code change**: GitHub > **Actions** > **Deploy backend** > **Run workflow** (keep the branch on `main`).
- **App and backend changed in the same push**: both workflows start together. The backend usually finishes first (about 2 minutes, vs 3 to 5 for the app). If the app change depends on a new backend route, it's safest to push the backend change first, wait for green, then push the app change.
- **Changing an environment variable or the memory**: still done in the Lambda console (guide 07, sections 7 and 8). The workflow never touches them.
- **Deploying by hand** (guide 07, section 12) still works. But the next push to `main` replaces it with whatever's on `main`, so don't hand-deploy code you haven't pushed.

## Undoing a bad deploy

Revert the commit and push. The workflow deploys the code from before the bad commit:

```bash
git revert <commit-id>
git push
```

`git log --oneline` shows the commit IDs.

---

## When a run fails

Open the red run in the **Actions** tab and look at which step failed.

| Failed step and message | What it means | Fix |
|---|---|---|
| `python -m pytest` | A test failed. Nothing was deployed | Run `python -m pytest` in `backend/` on your PC to see it, fix, push |
| **Configure AWS credentials**: "Credentials could not be loaded" | The `AWS_DEPLOY_ROLE_ARN` secret is missing or misspelled | Redo step 5 |
| **Configure AWS credentials**: "No OpenIDConnect provider found" | Step 2 wasn't done | Do step 2, then re-run |
| **Configure AWS credentials**: "Not authorized to perform sts:AssumeRoleWithWebIdentity" | The role doesn't trust this repo or branch (a renamed repo, or a run started from another branch) | Check the trust relationship line in step 4. Run from `main` only |
| **Upload to Lambda**: "AccessDeniedException" | The policy isn't attached to the role, or has the wrong account ID | Role > **Permissions** tab should list `lingvoyage-deploy`. Check the account ID in its JSON |
| **Upload to Lambda**: "ResourceConflictException ... update is in progress" | Someone deployed by hand at the same moment | Wait a minute, then **Re-run all jobs** |
| **Check /health** fails | The new code is live but crashes on startup (an import error, or a new setting missing from the Lambda environment variables) | Lambda > `lingvoyage-api` > **Monitor** > **View CloudWatch logs**. Fix and push, or revert (above) |
