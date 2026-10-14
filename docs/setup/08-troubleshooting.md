# 08. Troubleshooting

Find the symptom, try the fixes in order.

---

## Expo Go and the app

**"Project is incompatible with this version of Expo Go"**
Expo Go and your project are on different SDK versions. Expo Go tells you which one it needs. Inside `mobile/`:

```powershell
npx expo install expo@latest --fix
npx expo-doctor
```

Then `npx expo start -c`.

**Expo Go says you need to log in / won't load the project**
You must be logged in with the **same Expo account** in the Expo Go app (avatar, top right) and in the terminal (`npx expo login`, check with `npx expo whoami`).

**QR code opens Expo Go but it spins forever, or "Could not connect to development server"**

1. Phone and PC on the same Wi-Fi? Wi-Fi set to **Private** on Windows (guide 01)?
2. Allow Node.js through the firewall: Windows Security > Firewall & network protection > Allow an app through firewall > tick **Node.js** for Private.
3. Use a tunnel, which works on almost any network: `npx expo start --tunnel`.

**Weird errors after changing `.env` or installing packages**
`npx expo start -c` (clears the bundler cache). Still odd? Delete `node_modules` and run `npm install` again.

**"running scripts is disabled on this system"** (PowerShell)
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## App can't reach the backend

**"Network request failed" / requests time out**

1. Is the backend running with `--host 0.0.0.0`?
2. Does `http://YOUR_PC_LAN_IP:8000/health` load **in Safari on the iPhone**? If not, it's a network problem, not an app problem.
3. Did your PC's IP change? Run `ipconfig`, update `EXPO_PUBLIC_API_URL`, then `npx expo start -c`.
4. Never use `localhost` or `127.0.0.1` in `EXPO_PUBLIC_API_URL`.
5. Firewall rule for port 8000 (guide 06).

**Network blocks my phone** (school, campus or hotel Wi-Fi often isolates devices)
Pick one:

- **Best:** deploy the backend to Lambda (guide 07) and use that URL. Then run Expo with `npx expo start --tunnel`.
- **Quick:** a Cloudflare quick tunnel for the backend (no account needed). In a new terminal:
  ```powershell
  cloudflared tunnel --url http://localhost:8000
  ```
  It prints an `https://something.trycloudflare.com` address. Put that in `EXPO_PUBLIC_API_URL` and restart Expo with `-c`. The address changes every time you restart the tunnel.
- **Last resort:** turn on your phone's Personal Hotspot and connect the PC to it.

**Backend returns 401 Unauthorized**

- You're not logged in, or the session expired: log out and back in.
- `SUPABASE_URL` in `backend/.env` must be the **same project** as `EXPO_PUBLIC_SUPABASE_URL` in `mobile/.env`.

## Supabase

**"Email not confirmed" when logging in**
Confirm email is still on, or the user signed up before you turned it off. Turn it off (guide 02, step 3), then either delete that user in Authentication > Users and sign up again, or open the user and confirm them.

**Sign-up works but the app is stuck, or the profile is empty**
The `on_auth_user_created` trigger didn't get created. Re-run the SQL in guide 02. (The app also creates a missing profile row itself as a fallback.)

**Error code 42501 / "permission denied for table profiles"**
The `grant` lines in the SQL didn't run. Re-run them.

**Everything suddenly fails after a few days off**
The free project paused. Open the Supabase dashboard and click **Restore project**.

## ElevenLabs

| Error                    | Meaning                                | Fix                                                    |
| ------------------------ | -------------------------------------- | ------------------------------------------------------ |
| 401                      | Bad key                                | Re-copy the key into `backend/.env` (and Lambda).      |
| 402 `paid_plan_required` | Voice Library voice on the free plan   | Use a default voice, or upgrade to Starter.            |
| 403 / permission         | Restricted key is missing a permission | Give the key Text to Speech and Speech to Text access. |
| `quota_exceeded`         | Out of credits this month              | Check Usage; upgrade or wait for the reset.            |
| 429                      | Too many requests at once              | Free plan allows only a few at a time; wait and retry. |

**The character says nothing**

- iPhone volume up (Naviglot plays even when the silent switch is on).
- Bluetooth headphones connected somewhere else?
- Check the backend terminal for an ElevenLabs error.

**My speech comes back empty or wrong**

- Allow the microphone: iPhone **Settings > Expo Go > Microphone** on (in Expo Go, the permission belongs to the Expo Go app).
- Hold the phone closer and speak for at least a second. Very short taps are ignored.
- Beginners' Mandarin won't always transcribe perfectly; the character is told to be forgiving. Typing is the backup.

**"Live captions aren't available" while recording**

The words you see while recording come from ElevenLabs realtime Speech to Text, through a token from the backend's `/speech/live-token`. They are only a preview: the recording is still sent and transcribed normally when you tap the square, so turns keep working without them.

- The Lambda backend is older than the app: redeploy it (guide 07, section 12). `/speech/live-token` returns 404 until you do.
- The ElevenLabs key needs Speech to Text access (realtime uses the same permission), and the account needs credits. Live captions use credits on top of the normal transcription.
- Check CloudWatch for `live_token_failed`.

## Claude API

| Error                                  | Fix                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| 401                                    | Wrong `ANTHROPIC_API_KEY`.                                                                   |
| 400 "credit balance is too low"        | Add credit at platform.claude.com > Settings > Billing.                                      |
| 400 mentioning `temperature` / `top_p` | Don't send sampling parameters to Claude Haiku 5.5; remove them from `backend/app/tutor.py`. |
| 404 model                              | Model name must be exactly `claude-haiku-5-5`.                                               |
| 529 overloaded                         | Temporary. The backend retries once; try again.                                              |

## AWS Lambda

| Symptom                                            | Fix                                                                                                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **403 Forbidden** on the Function URL              | Function URL resource policy needs both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`. Easiest fix: delete the Function URL and recreate it in the console with auth type NONE. |
| `Task timed out after 3.00 seconds`                | Configuration > General > Timeout = 30 sec.                                                                                                                                              |
| `No module named 'pydantic_core._pydantic_core'`   | The zip has Windows packages. Rebuild with `scripts\build_lambda.ps1` (it downloads Linux packages) and upload again. Architecture must be **x86_64**.                                   |
| `Runtime.ImportModuleError: No module named 'app'` | Handler must be `app.main.handler`, and `app/` must be at the **top level** of the zip (the script does this).                                                                           |
| `KeyError` / validation error about a setting      | An environment variable is missing in Configuration > Environment variables.                                                                                                             |
| 500 errors                                         | Monitor > View CloudWatch logs > newest stream shows the Python traceback.                                                                                                               |
| App says **"Couldn't verify your login right now"** | The backend couldn't get an answer from Supabase Auth (logs show `httpx.ReadTimeout` under "Could not reach Supabase Auth"). The backend retries once on a fresh connection; if it still happens, check Configuration > General > **Memory = 512 MB** (at 128 MB the backend is starved: it needs about 150 MB) and Supabase's status page. |
| Everything is slow, cold starts of 4+ seconds      | Memory is probably still the 128 MB default. Set it to 512 MB (guide 07, section 7). More memory also means more CPU.                                                                  |

## Still stuck?

Paste the exact error message (and which terminal or screen it came from) into Claude Code and ask it to fix it. Mention you're on Windows with PowerShell and testing on iOS in Expo Go.
