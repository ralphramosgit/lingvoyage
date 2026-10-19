# Lingvoyage API (backend)

FastAPI app (Python 3.13). Runs locally with uvicorn and on AWS Lambda (Function URL) via Mangum, handler `app.main.handler`. It holds every secret key; the mobile app never sees them.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/health` | no | `{ "status": "ok" }` |
| GET | `/scenarios` | no | Encounter list (public fields only) |
| POST | `/tts` | yes | Text to MP3 (ElevenLabs), base64 |
| POST | `/speech/live-token` | yes | Single-use token for live captions (ElevenLabs realtime STT) |
| POST | `/speech/transcribe` | yes | Recording in, transcript out, for the learner to check before sending. Heard as the scenario's language (Mandarin), biased toward its key phrases; 422 `no_speech` or `not_mandarin` |
| POST | `/conversation/start` | yes | The character's greeting (Claude + TTS) |
| POST | `/conversation/turn` | yes | Learner text in (the app sends checked voice transcripts as text), character reply out (Claude + TTS). Still accepts audio from older app versions |

"Auth" means `Authorization: Bearer <Supabase access token>`. Errors are always `{ "error": { "code": "...", "message": "..." } }`. Interactive docs at `/docs`.

## Files

- `app/config.py` settings (environment variables first, then `backend/.env`)
- `app/scenarios.py` Encounter content, the single source of truth
- `app/lessons.py` Practice lessons for each encounter (sentence patterns, words, quiz questions); checked when the module loads
- `app/auth.py` Supabase token check (cached 5 minutes)
- `app/speech.py` ElevenLabs Text to Speech and Speech to Text
- `app/tutor.py` Claude prompt, structured output and clean-up
- `app/main.py` routes and error handling
- `scripts/check_keys.py` checks every key against the real services
- `scripts/build_lambda.ps1` builds `lambda.zip` for AWS Lambda

## Run locally

First time (PowerShell):

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env    # then fill it in (docs/setup/05)
```

Git Bash equivalent:

```bash
cd backend
py -3.13 -m venv .venv
source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Every time (activate first):

```bash
python scripts/check_keys.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

`--host 0.0.0.0` is what lets your iPhone reach the server. Check it from the phone's Safari at `http://YOUR_PC_LAN_IP:8000/health`.

## Tests

```bash
pytest
```

All external services are mocked; no keys or network needed.

## Deploy to AWS Lambda

Full steps: [docs/setup/07-aws-deploy.md](../docs/setup/07-aws-deploy.md).

Pushes to `main` that change `backend/` deploy automatically: `.github/workflows/deploy-backend.yml` runs the tests, builds `lambda.zip` and uploads it ([docs/setup/12-auto-deploy-backend.md](../docs/setup/12-auto-deploy-backend.md)). To deploy by hand:

```powershell
.\scripts\build_lambda.ps1
```

From Git Bash: `powershell -ExecutionPolicy Bypass -File scripts/build_lambda.ps1`.

Upload `lambda.zip` (Python 3.13, x86_64, handler `app.main.handler`, 512 MB, 30 s timeout) and copy every `backend/.env` value into the function's environment variables with `APP_ENV=production`.
