# 07. Deploy the backend to AWS (Lambda + Function URL)

Running the backend on your PC works at home, but at school or on demo day your phone may not be able to reach your PC. Putting the backend on AWS Lambda gives it a permanent HTTPS address that works from anywhere.

**Why Lambda + Function URL** (the cheapest AWS setup for this):

- **1 million requests and 400,000 GB-seconds of compute per month are always free**, on every AWS account.
- A Function URL gives the function its own HTTPS address for free (no API Gateway needed).
- You pay nothing while nobody is using it. No server to keep running.
- The same FastAPI code runs locally and on Lambda; an adapter called **Mangum** translates between them.

Realistic hackathon cost: **$0**, apart from tiny CloudWatch log storage that the sign-up credits cover.

---

## 1. Create the AWS account (one person)

1. **aws.amazon.com** > **Create an AWS Account**. AWS asks for a card to verify identity.
2. When asked to choose a plan:
   - **Free plan**: starts with $100 in credits (up to $200 if you complete AWS's onboarding tasks). You can't be charged, but the account closes after 6 months or when credits run out unless you upgrade. Fine for a class project.
   - **Paid plan**: same credits, but keeps running afterwards and bills you past the credits.
3. Sign in to the **AWS Console**.

## 2. Secure it (5 minutes, do not skip)

1. **Turn on MFA for the root user**: top-right account menu > **Security credentials** > **Assign MFA device** > Authenticator app.
2. **Make a day-to-day admin user** so you don't use root: search **IAM** > **Users** > **Create user** > name `lingvoyage-admin` > tick **Provide user access to the AWS Management Console** > next > **Attach policies directly** > search and tick **`AdministratorAccess`** (that one policy only) > create. Save the sign-in URL and password, and sign in as this user from now on.
   - Why full admin: creating the function also creates its execution role and function URL, which needs IAM permissions. A "smaller" combination that works (`AWSLambda_FullAccess` + `IAMFullAccess`) isn't really safer, because `IAMFullAccess` can grant itself anything.
   - **Turn on MFA for this user too**: IAM > Users > `lingvoyage-admin` > **Security credentials** > **Assign MFA device**.
   - **Don't create access keys** for this user. If you later want the AWS CLI, make a separate deploy-only key (section 12).
3. **Zero-spend budget alert**: search **Budgets** > **Create budget** > **Use a template** > **Zero spend budget** > enter your email > create. You'll get an email the moment anything costs a cent. (Do this as root, or first let IAM users see billing: as root, account menu > **Account** > **IAM user and role access to Billing information** > **Activate**.)

## 3. Pick a region

Top-right region menu > **US West (Oregon) us-west-2**. Use the same region for everything. (Any US region works; just be consistent.)

## 4. Build the deployment zip on Windows

Lambda runs Linux, so Python packages with compiled parts (FastAPI's `pydantic-core`, for example) must be the **Linux** versions, not the Windows ones on your PC. The build script Claude Code creates handles this with pip's `--platform` option. It looks like this:

```powershell
# backend/scripts/build_lambda.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)          # run from backend/
Remove-Item -Recurse -Force build, lambda.zip -ErrorAction SilentlyContinue

py -3.13 -m pip install -r requirements.txt `
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.13 `
  --only-binary=:all: --target build --upgrade

Copy-Item -Recurse app build\app
Get-ChildItem build -Recurse -Directory -Filter __pycache__ | Remove-Item -Recurse -Force

# Python's zip tool writes Linux-friendly paths (Windows' Compress-Archive can break imports on Lambda)
py -3.13 -c "import shutil; shutil.make_archive('lambda', 'zip', 'build')"
Write-Host "Created backend\lambda.zip"
```

Run it:

```powershell
cd $HOME\Documents\lingvoyage\backend
.\scripts\build_lambda.ps1
```

From **Git Bash** instead (same script, run through PowerShell):

```bash
cd ~/Documents/lingvoyage/backend
powershell -ExecutionPolicy Bypass -File scripts/build_lambda.ps1
```

You get `backend\lambda.zip` (about 6 MB). It's git-ignored, and it contains only `app/` and the Linux packages: your `.env` is never in it.

## 5. Create the Lambda function

1. Console search > **Lambda** > **Create function**.
2. **Author from scratch**:
   - Function name: `lingvoyage-api`
   - Runtime: **Python 3.13**
   - Architecture: **x86_64** (must match the `--platform` in the build script)
3. Expand **Additional configurations**:
   - Tick **Enable function URL**.
   - Auth type: **NONE**. (The backend itself checks the Supabase login token on every private endpoint.)
4. **Create function**.

When you create the URL with auth type NONE in the console, AWS automatically adds the permissions a public URL needs (`lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`). If you ever create it another way and get **403 Forbidden**, those permissions are what's missing.

## 6. Upload the code and set the handler

1. **Code** tab > in the **Code source** panel, open the **Update** dropdown (top right, next to "Open in Visual Studio Code") > **.zip file** > choose `backend\lambda.zip` > **Save**. Older versions of the console call this button **Upload from**.
   - Don't drag the zip into the code editor's file explorer: that just adds `lambda.zip` as a file instead of unpacking it.
   - After the upload, the explorer shows an `app/` folder and many package folders, and the sample `lambda_function.py` is gone.
2. Scroll down the **Code** tab to **Runtime settings** > **Edit** > Handler: `app.main.handler` > **Save**.

(`app/main.py` ends with `handler = Mangum(app, lifespan="off")`; that's what this points to.)

## 7. Memory and timeout

**Configuration** > **General configuration** > **Edit**:

- Memory: **512 MB** (more memory also means more CPU, so replies come back faster)
- Timeout: **30 sec** (a voice turn calls three services in a row; the default 3 seconds is far too short)

**Save**.

## 8. Environment variables

**Configuration** > **Environment variables** > **Edit** > **Add environment variable** for every line of your `backend/.env`, same names and values, except:

- `APP_ENV` = `production`

That's 12 variables: `APP_ENV`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_ID_RESTAURANT`, `ELEVENLABS_VOICE_ID_TRAIN`, `ELEVENLABS_VOICE_ID_HOTEL`, `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. The three per-character voice IDs are optional; skip any that are empty in your `.env`. No quotes, no spaces around values.

**Save**. (Guide 05 explains why secrets live here and not in the app.)

## 9. Test it

1. **Configuration** > **Function URL**: copy the URL (like `https://abc123xyz.lambda-url.us-west-2.on.aws/`).
2. In your browser, open that URL followed by `health`, e.g. `https://abc123xyz.lambda-url.us-west-2.on.aws/health`. You should see `{"status":"ok"}`.
3. Open `.../scenarios`: you should see the four Encounters (airport, restaurant, train, hotel) as JSON.
4. Open `.../docs` to see the API page, now served from AWS. Trying `/tts` or `/conversation/...` from there returns **401**: that's correct, those need a logged-in user from the app.

The very first request after a deploy (or after a quiet spell) takes a second or two longer while Lambda starts up. That's normal.

Save the URL in your scratch note as `LAMBDA_FUNCTION_URL` (without the trailing slash).

## 10. Point the app at AWS

In `mobile/.env`:

```ini
EXPO_PUBLIC_API_URL=https://abc123xyz.lambda-url.us-west-2.on.aws
```

Then `npx expo start -c` and run through the demo again. Now the backend works on any network. (During development Expo Go still loads the app's JavaScript from your PC; if that's blocked too, use `npx expo start --tunnel`.)

## 11. Logs (when something fails)

Lambda > `lingvoyage-api` > **Monitor** > **View CloudWatch logs** > open the newest log stream. Python errors and tracebacks show up here.

## 12. Redeploying after code changes

Easiest: let GitHub do it on every push to `main` (guide 12). By hand:

```powershell
cd $HOME\Documents\lingvoyage\backend
.\scripts\build_lambda.ps1
```

(Git Bash: `powershell -ExecutionPolicy Bypass -File scripts/build_lambda.ps1` from `backend/`.)

Then Lambda > **Code** > **Update** dropdown > **.zip file** again. Environment variables, memory, timeout and handler stay as they are.

Optional, faster: deploy from the command line with the AWS CLI.

1. Install it: `winget install --id Amazon.AWSCLI -e`, then open a new terminal.
2. Make a **deploy-only** user so the key on your PC can't do anything else: IAM > **Users** > **Create user** > name `lingvoyage-deploy` (no console access) > **Attach policies directly** > **Create policy** > **JSON**, paste the policy below (put your 12-digit account ID in place of `ACCOUNT_ID`), name it `lingvoyage-deploy`, then attach it to the user.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["lambda:UpdateFunctionCode", "lambda:GetFunction", "lambda:GetFunctionConfiguration"],
         "Resource": "arn:aws:lambda:us-west-2:ACCOUNT_ID:function:lingvoyage-api"
       }
     ]
   }
   ```

3. `lingvoyage-deploy` > **Security credentials** > **Create access key** > **Command Line Interface (CLI)**. Run `aws configure` and paste the key ID and secret (region `us-west-2`, output `json`). Never commit or share these.
4. Deploy with one command from `backend/`:

```powershell
aws lambda update-function-code --function-name lingvoyage-api --zip-file fileb://lambda.zip --region us-west-2
```

## 13. Keeping costs at zero

- The zero-spend budget emails you if anything starts costing money.
- Lambda's free allowance (1M requests a month) is far beyond what a hackathon uses.
- The real costs in this project are ElevenLabs and Claude usage, not AWS. Their spend limits (guides 03 and 04) are your safety net.
- Optional: if your account's concurrency quota allows it, **Configuration > Concurrency > Reserved concurrency = 5** caps how many requests can run at once, which limits damage from someone spamming the API. New accounts sometimes can't set this; that's fine.

## Future AWS pieces (not needed now)

- **S3**: storage for camera-based micro-lessons (menu and sign photos) and cached audio.
- **Systems Manager Parameter Store**: store the secret keys encrypted instead of plain environment variables.
- **API Gateway or CloudFront**: custom domain, rate limiting and caching once you have real users.
