from fastapi.testclient import TestClient

from app.config import get_settings
from app.scenarios import SCENARIOS, get_scenario


def test_scenarios_lists_public_fields_only(client: TestClient) -> None:
    response = client.get("/scenarios")
    assert response.status_code == 200
    data = response.json()

    assert [s["id"] for s in data] == ["restaurant", "train", "hotel"]
    for scenario in data:
        assert "scene_details" not in scenario
        assert "voice_env" not in scenario
        assert scenario["language"] == "zh-CN"
        assert len(scenario["goals"]) == 4
        assert len(scenario["key_phrases"]) == 5
        assert set(scenario["character"]) == {"name_hanzi", "name_pinyin", "name_english", "role", "avatar_char"}


def test_scene_details_stay_on_the_server() -> None:
    restaurant = get_scenario("restaurant")
    assert restaurant is not None
    assert "25 yuan" in restaurant.scene_details
    assert all(s.scene_details for s in SCENARIOS)


def test_voice_falls_back_to_default() -> None:
    settings = get_settings()
    assert settings.voice_id_for("ELEVENLABS_VOICE_ID_TRAIN") == "train-voice"
    assert settings.voice_id_for("ELEVENLABS_VOICE_ID_RESTAURANT") == "default-voice"
    assert settings.voice_id_for(None) == "default-voice"
