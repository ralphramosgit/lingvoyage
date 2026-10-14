import os

# Real environment variables beat backend/.env, so tests never see real keys and never
# depend on what's in the developer's .env file.
TEST_ENV = {
    "APP_ENV": "test",
    "SUPABASE_URL": "https://test-project.supabase.co",
    "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test",
    "ELEVENLABS_API_KEY": "sk_test",
    "ELEVENLABS_VOICE_ID": "default-voice",
    "ELEVENLABS_VOICE_ID_RESTAURANT": "",
    "ELEVENLABS_VOICE_ID_TRAIN": "train-voice",
    "ELEVENLABS_VOICE_ID_HOTEL": "",
    "ELEVENLABS_TTS_MODEL": "eleven_flash_v2_5",
    "ELEVENLABS_STT_MODEL": "scribe_v2",
    "ANTHROPIC_API_KEY": "sk-ant-test",
    "ANTHROPIC_MODEL": "claude-haiku-5-5",
}
os.environ.update(TEST_ENV)

from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import auth  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402

get_settings.cache_clear()


@pytest.fixture
def client() -> Iterator[TestClient]:
    auth.clear_cache()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def authed_client(client: TestClient) -> TestClient:
    """A client whose requests are treated as coming from a logged-in user."""
    app.dependency_overrides[auth.require_user] = lambda: auth.AuthUser(id="user-123")
    return client
