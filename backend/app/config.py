"""Settings: real environment variables first, then backend/.env as a fallback."""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved from this file, not the working directory, so uvicorn, pytest and
# scripts/check_keys.py all find the same backend/.env.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "local"

    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""  # backend only: the local packs tables (app/locations/store.py)

    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    elevenlabs_voice_id_restaurant: str = ""
    elevenlabs_voice_id_train: str = ""
    elevenlabs_voice_id_hotel: str = ""
    elevenlabs_tts_model: str = "eleven_flash_v2_5"
    elevenlabs_stt_model: str = "scribe_v2"
    elevenlabs_realtime_stt_model: str = "scribe_v2_realtime"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-5-5"
    # Local packs (app/research): the research workers, and the cheap model that checks their facts.
    anthropic_research_model: str = "claude-opus-5-5"
    anthropic_research_effort: str = "medium"
    anthropic_verifier_model: str = "claude-haiku-5-5"

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("supabase_url")
    @classmethod
    def _no_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    def voice_id_for(self, voice_env: str | None) -> str:
        """Per-scenario voice (e.g. ELEVENLABS_VOICE_ID_TRAIN), falling back to ELEVENLABS_VOICE_ID."""
        if voice_env:
            override = getattr(self, voice_env.lower(), "")
            if isinstance(override, str) and override:
                return override
        return self.elevenlabs_voice_id


@lru_cache
def get_settings() -> Settings:
    return Settings()
