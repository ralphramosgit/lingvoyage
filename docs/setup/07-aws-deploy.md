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
2. **Make a day-to-day admin user** so you don't use root: search **IAM** > **Users** > **Create user** > name `naviglot-admin` > tick **Provide user access to the AWS Management Console** > next > **Attach policies directly** > `AdministratorAccess` > create. Save the sign-in URL and password, and sign in as this user from now on.
3. **Zero-spend budget alert**: search **Budgets** > **Create budget** > **Use a template** > **Zero spend budget** > enter your email > create. You'll get an email the moment anything costs a cent.

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
cd $HOME\Documents\naviglot\backend
.\scripts\build_lambda.ps1
```

You get `backend\lambda.zip` (roughly 15 to 30 MB). It's git-ignored.

## 5. Create the Lambda function

1. Console search > **Lambda** > **Create function**.
2. **Author from scratch**:
   - Function name: `naviglot-api`
   - Runtime: **Python 3.13**
   - Architecture: **x86_64** (must match the `--platform` in the build script)
3. Expand **Additional configurations**:
   - Tick **Enable function URL**.
   - Auth type: **NONE**. (The backend itself checks the Supabase login token on every private endpoint.)
4. **Create function**.

When you create the URL with auth type NONE in the console, AWS automatically adds the permissions a public URL needs (`lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`). If you ever create it another way and get **403 Forbidden**, those permissions are what's missing.

## 6. Upload the code and set the handler

1. **Code** tab > **Upload from** > **.zip file** > choose `backend\lambda.zip` > **Save**.
2. Scroll to **Runtime settings** > **Edit** > Handler: `app.main.handler` > **Save**.

(`app/main.py` ends with `handler = Mangum(app, lifespan="off")`; that's what this points to.)

## 7. Memory and timeout

**Configuration** > **General configuration** > **Edit**:

- Memory: **512 MB** (more memory also means more CPU, so replies come back faster)
- Timeout: **30 sec** (a voice turn calls three services in a row; the default 3 seconds is far too short)

**Save**.

## 8. Environment variables

**Configuration** > **Environment variables** > **Edit** > add every line from your `backend/.env`, same names and values, except:

- `APP_ENV` = `production`

**Save**. (Guide 05 explains why secrets live here and not in the app.)

## 9. Test it

1. **Configuration** > **Function URL**: copy the URL (like `https://abc123xyz.lambda-url.us-west-2.on.aws/`).
2. In your browser, open that URL followed by `health`, e.g. `https://abc123xyz.lambda-url.us-west-2.on.aws/health`. You should see `{"status":"ok"}`.
3. Open `.../docs` to see the API page, now served from AWS.

Save the URL in your scratch note as `LAMBDA_FUNCTION_URL` (without the trailing slash).

## 10. Point the app at AWS

In `mobile/.env`:

```ini
EXPO_PUBLIC_API_URL=https://abc123xyz.lambda-url.us-west-2.on.aws
```

Then `npx expo start -c` and run through the demo again. Now the backend works on any network. (During development Expo Go still loads the app's JavaScript from your PC; if that's blocked too, use `npx expo start --tunnel`.)

## 11. Logs (when something fails)

Lambda > `naviglot-api` > **Monitor** > **View CloudWatch logs** > open the newest log stream. Python errors and tracebacks show up here.

## 12. Redeploying after code changes

```powershell
cd $HOME\Documents\naviglot\backend
.\scripts\build_lambda.ps1
```

Then Lambda > **Code** > **Upload from** > **.zip file** again.

Optional, faster: install the AWS CLI (`winget install --id Amazon.AWSCLI -e`), run `aws configure` with an access key for your admin user, then deploy with one command:

```powershell
aws lambda update-function-code --function-name naviglot-api --zip-file fileb://lambda.zip --region us-west-2
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
