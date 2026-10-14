"""ElevenLabs Text to Speech and Speech to Text (sync httpx, called only from the backend)."""

import logging

import httpx

from app.config import get_settings
from app.errors import ApiError, missing_setting
from app.http_retry import send_with_retry

logger = logging.getLogger("naviglot.speech")

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io"
TTS_OUTPUT_FORMAT = "mp3_44100_64"

_http = httpx.Client(timeout=20.0)


def _error_detail(response: httpx.Response) -> tuple[str, str]:
    """Pull (code, message) out of an ElevenLabs error body, whatever its shape."""
    try:
        body = response.json()
    except ValueError:
        return "", response.text[:200]
    detail = body.get("detail", body) if isinstance(body, dict) else body
    if isinstance(detail, dict):
        code = str(detail.get("status") or detail.get("code") or detail.get("type") or "")
        message = str(detail.get("message") or "")
        return code, message
    if isinstance(detail, list) and detail and isinstance(detail[0], dict):
        return "", str(detail[0].get("msg") or "")
    return "", str(detail)[:200]


def _friendly_message(service: str, status: int, code: str, message: str) -> str:
    if status == 401:
        return f"ElevenLabs rejected the API key ({service}). Check ELEVENLABS_API_KEY in backend/.env (guide 03)."
    if status == 402 or code == "paid_plan_required":
        return (
            "This ElevenLabs voice needs a paid plan (402 paid_plan_required). On the free plan, "
            "use one of the default voices for ELEVENLABS_VOICE_ID (guide 03, option A)."
        )
    if code == "quota_exceeded":
        return "ElevenLabs is out of credits for this month. Check Usage in the ElevenLabs dashboard."
    if status == 403:
        return f"The ElevenLabs API key is missing the {service} permission. Edit the key and give it access (guide 03)."
    if status == 404 and service == "Text to Speech":
        return "ElevenLabs voice not found. Check ELEVENLABS_VOICE_ID (guide 03)."
    if status == 429:
        return "ElevenLabs is handling too many requests right now. Wait a moment and try again."
    detail = f" ({code})" if code else ""
    return f"ElevenLabs {service} failed with HTTP {status}{detail}. {message}".strip()


def _raise_for_status(service: str, error_code: str, response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    code, message = _error_detail(response)
    logger.error("ElevenLabs %s error: HTTP %s %s %s", service, response.status_code, code, message)
    status = 503 if response.status_code == 429 else 502
    raise ApiError(status, error_code, _friendly_message(service, response.status_code, code, message))


def _api_key() -> str:
    key = get_settings().elevenlabs_api_key
    if not key:
        raise missing_setting("ELEVENLABS_API_KEY")
    return key


def synthesize(text: str, voice_id: str | None = None) -> bytes:
    """Returns MP3 bytes for `text` spoken by `voice_id` (default: ELEVENLABS_VOICE_ID)."""
    settings = get_settings()
    api_key = _api_key()
    voice = voice_id or settings.elevenlabs_voice_id
    if not voice:
        raise missing_setting("ELEVENLABS_VOICE_ID")

    try:
        response = send_with_retry(
            lambda: _http.post(
                f"{ELEVENLABS_BASE_URL}/v1/text-to-speech/{voice}",
                params={"output_format": TTS_OUTPUT_FORMAT},
                headers={"xi-api-key": api_key},
                json={"text": text, "model_id": settings.elevenlabs_tts_model},
            ),
            "ElevenLabs Text to Speech",
        )
    except httpx.TimeoutException:
        logger.exception("ElevenLabs Text to Speech timed out")
        raise ApiError(504, "tts_timeout", "The voice service took too long to answer. Try again.")
    except httpx.HTTPError:
        logger.exception("Could not reach ElevenLabs Text to Speech")
        raise ApiError(502, "tts_failed", "Couldn't reach the voice service. Try again.")

    _raise_for_status("Text to Speech", "tts_failed", response)
    if not response.content:
        raise ApiError(502, "tts_failed", "The voice service returned no audio.")
    return response.content


def _filename_for(mime: str) -> str:
    if mime in ("audio/mpeg", "audio/mp3"):
        return "speech.mp3"
    if mime in ("audio/wav", "audio/x-wav", "audio/wave"):
        return "speech.wav"
    return "speech.m4a"


def transcribe(audio: bytes, audio_mime: str | None = None) -> str:
    """Returns the transcript of `audio` (language auto-detected). May be an empty string."""
    settings = get_settings()
    api_key = _api_key()
    mime = audio_mime or "audio/mp4"

    try:
        response = send_with_retry(
            lambda: _http.post(
                f"{ELEVENLABS_BASE_URL}/v1/speech-to-text",
                headers={"xi-api-key": api_key},
                data={"model_id": settings.elevenlabs_stt_model, "tag_audio_events": "false"},
                files={"file": (_filename_for(mime), audio, mime)},
            ),
            "ElevenLabs Speech to Text",
        )
    except httpx.TimeoutException:
        logger.exception("ElevenLabs Speech to Text timed out")
        raise ApiError(504, "stt_timeout", "Speech recognition took too long. Try again or type your answer.")
    except httpx.HTTPError:
        logger.exception("Could not reach ElevenLabs Speech to Text")
        raise ApiError(502, "stt_failed", "Couldn't reach speech recognition. Try again or type your answer.")

    _raise_for_status("Speech to Text", "stt_failed", response)
    try:
        body = response.json()
    except ValueError:
        raise ApiError(502, "stt_failed", "Speech recognition returned an unreadable response.")
    text = body.get("text") if isinstance(body, dict) else None
    return text.strip() if isinstance(text, str) else ""


def create_live_token() -> str:
    """A single-use, 15-minute token the app uses to stream the mic to ElevenLabs realtime
    Speech to Text for live captions, without ever seeing the API key."""
    api_key = _api_key()
    try:
        response = send_with_retry(
            lambda: _http.post(
                f"{ELEVENLABS_BASE_URL}/v1/single-use-token/realtime_scribe",
                headers={"xi-api-key": api_key},
                timeout=5.0,
            ),
            "ElevenLabs realtime token",
        )
    except httpx.HTTPError:
        logger.exception("Could not get an ElevenLabs realtime token")
        raise ApiError(502, "live_token_failed", "Live captions are unavailable right now.")

    _raise_for_status("realtime Speech to Text", "live_token_failed", response)
    try:
        body = response.json()
    except ValueError:
        body = None
    token = body.get("token") if isinstance(body, dict) else None
    if not isinstance(token, str) or not token:
        raise ApiError(502, "live_token_failed", "Live captions are unavailable right now.")
    return token
