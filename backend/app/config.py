"""Settings: real environment variables first, then backend/.env as a fallback."""

import zlib
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
    # Voices by who's speaking: comma-separated voice IDs, e.g. ELEVENLABS_VOICES_FEMALE_YOUNG=id1,id2.
    elevenlabs_voices_female_young: str = ""
    elevenlabs_voices_female_older: str = ""
    elevenlabs_voices_male_young: str = ""
    elevenlabs_voices_male_older: str = ""
    elevenlabs_tts_model: str = "eleven_flash_v2_5"
    elevenlabs_stt_model: str = "scribe_v2"
    elevenlabs_realtime_stt_model: str = "scribe_v2_realtime"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"  # the characters (app/tutor.py)
    # Spells out what the learner said into the mic (pinyin and English) before they send it (app/tutor.py).
    anthropic_gloss_model: str = "claude-haiku-5-5"
    # Local packs (app/research): the research workers, and the cheap model that checks their facts.
    anthropic_research_model: str = "claude-opus-5-5"
    anthropic_research_effort: str = "medium"
    anthropic_verifier_model: str = "claude-haiku-5-5"
    # The content agent that writes local encounters from the facts (app/content).
    anthropic_generator_model: str = "claude-sonnet-5-5"
    anthropic_generator_effort: str = "medium"
    # The worker Lambda that builds packs (lingvoyage-research). Empty: build in a thread, for local runs.
    research_function_name: str = ""
    # New pack runs a day (about $4 of Claude credits each): for all accounts together, and per account.
    # 0 pauses new runs; cities that are already built keep working. See app/locations/packs.py.
    research_runs_per_day: int = 2
    research_runs_per_account_per_day: int = 1

    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("supabase_url")
    @classmethod
    def _no_trailing_slash(cls, value: str) -> str:
        return value.rstrip("/")

    def voice_pool(self, gender: str, age: str) -> list[str]:
        """The voice IDs for, e.g., an older woman (ELEVENLABS_VOICES_FEMALE_OLDER)."""
        value = getattr(self, f"elevenlabs_voices_{gender}_{age}", "")
        return [voice_id.strip() for voice_id in value.split(",") if voice_id.strip()]

    def voice_id_for(self, gender: str, age: str, name: str) -> str:
        """A voice that matches the character: one from their gender and age's pool, picked by their name so a
        character always sounds the same. Then the same gender at the other age, then ELEVENLABS_VOICE_ID."""
        for pool_age in (age, "older" if age == "young" else "young"):
            pool = self.voice_pool(gender, pool_age)
            if pool:
                return pool[zlib.crc32(name.encode("utf-8")) % len(pool)]
        return self.elevenlabs_voice_id


@lru_cache
def get_settings() -> Settings:
    return Settings()
