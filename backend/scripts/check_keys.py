"""Checks every external service the backend needs, using the real settings.

Run from backend/ with the virtual environment active:

    python scripts/check_keys.py

Prints OK or FAIL (with a hint) for Supabase, ElevenLabs TTS, ElevenLabs STT and Claude.
Never prints key values.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import anthropic  # noqa: E402
import httpx  # noqa: E402

from app import speech  # noqa: E402
from app.config import ENV_FILE, get_settings  # noqa: E402
from app.errors import ApiError  # noqa: E402

TEST_SENTENCE = "Ni hao, welcome to Lingvoyage."

results: list[bool] = []


def report(name: str, ok: bool, detail: str = "", hint: str = "") -> None:
    results.append(ok)
    status = "OK  " if ok else "FAIL"
    line = f"[{status}] {name}"
    if detail:
        line += f": {detail}"
    print(line)
    if not ok and hint:
        print(f"       hint: {hint}")


def check_supabase() -> None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_publishable_key:
        report("Supabase", False, "SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is empty", "Fill them in (guide 02 and 05).")
        return
    try:
        response = httpx.get(
            f"{settings.supabase_url}/auth/v1/settings",
            headers={"apikey": settings.supabase_publishable_key},
            timeout=10.0,
        )
    except httpx.HTTPError as error:
        report("Supabase", False, f"couldn't connect ({type(error).__name__})", "Check SUPABASE_URL. Is the project paused?")
        return
    if response.status_code == 200:
        report("Supabase", True, "auth settings reachable")
    else:
        report(
            "Supabase",
            False,
            f"HTTP {response.status_code}",
            "Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY come from the same project (guide 02, step 2).",
        )


def check_elevenlabs() -> None:
    settings = get_settings()
    if not settings.elevenlabs_api_key or not settings.elevenlabs_voice_id:
        report(
            "ElevenLabs TTS",
            False,
            "ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is empty",
            "Fill them in (guide 03 and 05).",
        )
        report("ElevenLabs STT", False, "skipped (needs TTS audio)")
        return

    try:
        audio = speech.synthesize(TEST_SENTENCE)
    except ApiError as error:
        report("ElevenLabs TTS", False, error.message, "See guide 03, step 5 for what each error means.")
        report("ElevenLabs STT", False, "skipped (needs TTS audio)")
        return
    report("ElevenLabs TTS", True, f"{len(audio) // 1024} KB of MP3 from the default voice")

    for env_name in ("ELEVENLABS_VOICE_ID_RESTAURANT", "ELEVENLABS_VOICE_ID_TRAIN", "ELEVENLABS_VOICE_ID_HOTEL"):
        voice_id = getattr(settings, env_name.lower())
        if not voice_id:
            continue
        try:
            speech.synthesize("Ni hao.", voice_id)
            report(f"ElevenLabs TTS ({env_name})", True)
        except ApiError as error:
            report(f"ElevenLabs TTS ({env_name})", False, error.message)

    try:
        transcript = speech.transcribe(audio, "audio/mpeg")
    except ApiError as error:
        report("ElevenLabs STT", False, error.message, "Give the key Speech to Text access (guide 03, step 2).")
        return
    if transcript:
        report("ElevenLabs STT", True, f'heard "{transcript}"')
    else:
        report("ElevenLabs STT", False, "returned empty text", "Check ELEVENLABS_STT_MODEL (default scribe_v2).")


def check_claude() -> None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        report("Claude", False, "ANTHROPIC_API_KEY is empty", "Fill it in (guide 04 and 05).")
        return
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=30.0, max_retries=1)
    try:
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=200,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
        )
    except anthropic.AuthenticationError:
        report("Claude", False, "401 invalid API key", "Re-copy ANTHROPIC_API_KEY (guide 04).")
        return
    except anthropic.NotFoundError:
        report("Claude", False, f"model '{settings.anthropic_model}' not found", "ANTHROPIC_MODEL should be claude-haiku-5-5.")
        return
    except anthropic.APIStatusError as error:
        report("Claude", False, f"HTTP {error.status_code}: {error.message}", "A low credit balance shows up here (guide 04).")
        return
    except anthropic.APIConnectionError:
        report("Claude", False, "couldn't connect", "Check this PC's internet connection.")
        return
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    report("Claude", True, f"{settings.anthropic_model} replied \"{text[:40]}\"")


def main() -> int:
    # The Windows console may not be UTF-8; never crash on a Chinese transcript.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    env_note = "found" if ENV_FILE.exists() else "not found, using environment variables only"
    print(f"Lingvoyage key check (backend/.env {env_note})\n")
    check_supabase()
    check_elevenlabs()
    check_claude()

    print()
    if all(results):
        print("All services OK.")
        return 0
    print(f"{results.count(False)} check(s) failed. Fix them before starting the app (guides 02 to 05).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
