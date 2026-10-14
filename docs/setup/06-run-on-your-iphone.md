# 06. Run Naviglot on your iPhone (local backend + Expo Go)

Do this after Claude Code has built the project and you've filled in both `.env` files (guide 05).

You'll use **two PowerShell windows** (or two terminals in VS Code: Terminal > New Terminal, then the split button).

---

## Terminal 1: the backend

```powershell
cd $HOME\Documents\naviglot\backend

# First time only: create and fill the virtual environment
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

# Every time: activate, then run
.\.venv\Scripts\Activate.ps1
python scripts/check_keys.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Your prompt shows `(.venv)` when the environment is active.
- `check_keys.py` should print OK for Supabase, ElevenLabs TTS, ElevenLabs STT and Claude. Fix any FAIL before going on (guides 02 to 04 list the common errors).
- `--host 0.0.0.0` is required. Without it the server only listens to your PC and the phone can't reach it.
- `--reload` restarts the server when you edit Python files.

### Check the backend from your PC, then from your phone

1. On the PC, open **http://localhost:8000/health**. You should see `{"status":"ok"}`.
2. Also try **http://localhost:8000/docs**: FastAPI's interactive API page, handy for testing endpoints.
3. **On the iPhone**, open Safari and go to **http://YOUR_PC_LAN_IP:8000/health** (for example `http://192.168.1.23:8000/health`).

If step 3 works, the app will be able to reach the backend. If it times out:

- Make sure the phone and PC are on the same Wi-Fi.
- Allow the port through Windows Firewall. In PowerShell **run as administrator**:

```powershell
New-NetFirewallRule -DisplayName "Naviglot API (dev)" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```

- Still nothing? Your network probably blocks device-to-device traffic (common on school Wi-Fi). Jump to "Network blocks my phone" in guide 08.

## Terminal 2: the app

```powershell
cd $HOME\Documents\naviglot\mobile

# First time only
npm install
npx expo login          # opens your browser; use the SAME Expo account as in the Expo Go app

# Every time
npx expo start -c
```

A QR code appears.

1. Open the iPhone **Camera** app and point it at the QR code. Tap the banner that appears; it opens in **Expo Go**.
   (Or open Expo Go: when you're logged in on both sides, your running project shows up on its Home tab.)
2. The first load takes a little while as the bundle builds.
3. When asked, **allow microphone access**.

Useful keys in the Expo terminal: `r` reloads the app, `j` opens the debugger, `Ctrl+C` stops. On the phone, shake it to open the developer menu.

## Demo walkthrough (check everything works)

1. **Welcome** screen > **Get started**.
2. **Create account** with a name, email and password > you land on **Setup**.
3. Choose **Mandarin Chinese** > **Continue** > you land on the **Encounters** tab.
4. Open **Ordering at a noodle shop** > tap a few **key phrases** to hear them > **Start encounter**.
5. The character greets you out loud. Tap the **yellow mic**, say "你好" (or even "hello, table for two"), tap again to send.
6. You should see your words, a reply in Chinese with pinyin, a tap-to-reveal English translation, a feedback tip, and suggested replies. The goals counter goes up as you complete them.
7. Try the **keyboard** button and type a reply instead.
8. Kill and reopen Expo Go: you should still be logged in and go straight to Encounters.
9. **Profile** tab > **Log out** > you're back on Welcome.

Audio tips: Naviglot plays sound even when the iPhone's silent switch is on, but check the volume buttons. Speak clearly about 20 to 30 cm from the phone.

## Running on a teammate's machine

Each teammate repeats guide 01, gets the `.env` values from you privately, and runs the same two terminals. Each person's `EXPO_PUBLIC_API_URL` must point at **their own** PC's IP (or everyone points at the Lambda URL once guide 07 is done, which is simpler).

---

Next: guide 07 to put the backend on AWS so it works away from your desk.
