"""Lingvoyage API: FastAPI app that runs locally under uvicorn and on AWS Lambda via Mangum.

Route handlers are sync (`def`) on purpose: FastAPI runs them in a threadpool, and the
sync httpx / anthropic clients avoid event-loop reuse problems under Mangum on Lambda.
"""

import base64
import binascii
import logging
from typing import Literal

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from pydantic import BaseModel, Field, model_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import speech, tutor
from app.auth import AuthUser, require_user
from app.config import get_settings
from app.errors import ApiError, error_body
from app.scenarios import SCENARIOS, Scenario, ScenarioDefinition, get_scenario
from app.tutor import ChatLine, TutorReply

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger().setLevel(logging.INFO)  # Lambda pre-installs a handler, so basicConfig may be a no-op there
logger = logging.getLogger("lingvoyage")

MAX_AUDIO_BYTES = 2 * 1024 * 1024
AudioMime = Literal["audio/mpeg"]

app = FastAPI(title="Lingvoyage API", version="1.0.0")

# Mobile app only, no cookies: any origin is fine.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Error handling: always { "error": { "code", "message" } }
# ---------------------------------------------------------------------------


@app.exception_handler(ApiError)
def handle_api_error(_: Request, error: ApiError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content=error_body(error.code, error.message))


@app.exception_handler(RequestValidationError)
def handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
    details = error.errors()
    first = details[0] if details else {}
    location = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    message = str(first.get("msg", "Invalid request.")).removeprefix("Value error, ")
    if location:
        message = f"{location}: {message}"
    return JSONResponse(status_code=422, content=error_body("invalid_request", message))


@app.exception_handler(StarletteHTTPException)
def handle_http_error(_: Request, error: StarletteHTTPException) -> JSONResponse:
    code = "not_found" if error.status_code == 404 else "http_error"
    return JSONResponse(status_code=error.status_code, content=error_body(code, str(error.detail)))


@app.exception_handler(Exception)
def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content=error_body("internal_error", "Something went wrong on the server."))


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200)


class TtsResponse(BaseModel):
    audio_base64: str
    audio_mime: AudioMime = "audio/mpeg"


class LiveTokenResponse(BaseModel):
    token: str
    model_id: str


class StartRequest(BaseModel):
    scenario_id: str


class TurnRequest(BaseModel):
    scenario_id: str
    history: list[ChatLine] = Field(default_factory=list)
    completed_goal_ids: list[str] = Field(default_factory=list)
    user_text: str | None = Field(default=None, max_length=500)
    audio_base64: str | None = None
    audio_mime: str | None = None

    @model_validator(mode="after")
    def _exactly_one_input(self) -> "TurnRequest":
        has_text = self.user_text is not None and self.user_text.strip() != ""
        has_audio = self.audio_base64 is not None and self.audio_base64 != ""
        if has_text == has_audio:
            raise ValueError("Send exactly one of user_text or audio_base64.")
        return self


class TurnResponse(BaseModel):
    transcript: str | None
    reply: TutorReply
    audio_base64: str | None
    audio_mime: AudioMime = "audio/mpeg"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _scenario_or_404(scenario_id: str) -> ScenarioDefinition:
    scenario = get_scenario(scenario_id)
    if scenario is None:
        raise ApiError(404, "scenario_not_found", f"Unknown scenario '{scenario_id}'.")
    return scenario


def _decode_audio(audio_base64: str) -> bytes:
    # Allow a data-URL prefix in case a client sends one.
    if audio_base64.startswith("data:"):
        audio_base64 = audio_base64.split(",", 1)[-1]
    if len(audio_base64) > (MAX_AUDIO_BYTES * 4) // 3 + 8:
        raise ApiError(413, "audio_too_large", "That recording is too long. Keep it under 30 seconds.")
    try:
        audio = base64.b64decode(audio_base64, validate=True)
    except (binascii.Error, ValueError):
        raise ApiError(422, "invalid_audio", "The recording couldn't be read. Try again.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise ApiError(413, "audio_too_large", "That recording is too long. Keep it under 30 seconds.")
    if not audio:
        raise ApiError(422, "invalid_audio", "The recording was empty. Try again.")
    return audio


def _speak(text: str, scenario: ScenarioDefinition) -> str | None:
    """Character's line as base64 MP3, or None if TTS fails (the turn still succeeds)."""
    if not text:
        return None
    try:
        voice_id = get_settings().voice_id_for(scenario.voice_env)
        return base64.b64encode(speech.synthesize(text, voice_id)).decode("ascii")
    except ApiError as error:
        logger.warning("TTS failed for scenario %s: %s (%s)", scenario.id, error.code, error.message)
        return None
    except Exception:
        logger.exception("TTS failed unexpectedly for scenario %s", scenario.id)
        return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/scenarios", response_model=list[Scenario])
def list_scenarios() -> list[Scenario]:
    return [scenario.public() for scenario in SCENARIOS]


@app.post("/tts", response_model=TtsResponse)
def text_to_speech(body: TtsRequest, _user: AuthUser = Depends(require_user)) -> TtsResponse:
    text = body.text.strip()
    if not text:
        raise ApiError(422, "invalid_request", "text: must not be blank.")
    audio = speech.synthesize(text)
    return TtsResponse(audio_base64=base64.b64encode(audio).decode("ascii"))


@app.post("/speech/live-token", response_model=LiveTokenResponse)
def live_token(_user: AuthUser = Depends(require_user)) -> LiveTokenResponse:
    """Token for live captions while the learner records. The recording itself still goes
    through /conversation/turn, whose transcript is the one the character answers."""
    return LiveTokenResponse(token=speech.create_live_token(), model_id=get_settings().elevenlabs_realtime_stt_model)


@app.post("/conversation/start", response_model=TurnResponse)
def conversation_start(body: StartRequest, _user: AuthUser = Depends(require_user)) -> TurnResponse:
    scenario = _scenario_or_404(body.scenario_id)
    reply = tutor.generate_reply(scenario, history=[], client_completed_ids=[], learner_text=None)
    return TurnResponse(transcript=None, reply=reply, audio_base64=_speak(reply.hanzi, scenario))


@app.post("/conversation/turn", response_model=TurnResponse)
def conversation_turn(body: TurnRequest, _user: AuthUser = Depends(require_user)) -> TurnResponse:
    scenario = _scenario_or_404(body.scenario_id)

    transcript: str | None = None
    if body.audio_base64:
        audio = _decode_audio(body.audio_base64)
        transcript = speech.transcribe(audio, body.audio_mime)
        if not transcript:
            raise ApiError(422, "no_speech", "We didn't catch that. Try again or type it.")
        learner_text = transcript
    else:
        learner_text = (body.user_text or "").strip()

    reply = tutor.generate_reply(
        scenario,
        history=body.history,
        client_completed_ids=body.completed_goal_ids,
        learner_text=learner_text,
    )
    return TurnResponse(transcript=transcript, reply=reply, audio_base64=_speak(reply.hanzi, scenario))


handler = Mangum(app, lifespan="off")
