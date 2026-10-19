import base64

import pytest
from fastapi.testclient import TestClient

from app import main, speech, tutor
from app.errors import ApiError
from app.scenarios import ScenarioDefinition
from app.tutor import ChatLine, Phrase, TutorReply

FAKE_MP3 = b"ID3fake-mp3-bytes"
RESTAURANT_KEYTERMS = ["你好", "两位", "我要一碗牛肉面", "不要辣", "买单"]


def _reply(**overrides: object) -> TutorReply:
    values: dict[str, object] = {
        "learner_hanzi": "",
        "learner_pinyin": "",
        "learner_english": "",
        "hanzi": "你好！几位？",
        "pinyin": "Nǐ hǎo! Jǐ wèi?",
        "english": "Hello! How many people?",
        "feedback": "",
        "corrected_hanzi": "",
        "corrected_pinyin": "",
        "suggestions": [Phrase(hanzi="两位", pinyin="liǎng wèi", english="Two people")] * 3,
        "completed_goal_ids": [],
        "scenario_complete": False,
    }
    values.update(overrides)
    return TutorReply.model_validate(values)


@pytest.fixture
def fake_services(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[object]]:
    calls: dict[str, list[object]] = {"tts": [], "stt": [], "tutor": []}

    def fake_synthesize(text: str, voice_id: str | None = None) -> bytes:
        calls["tts"].append((text, voice_id))
        return FAKE_MP3

    def fake_transcribe(
        audio: bytes, audio_mime: str | None = None, language: str | None = None, terms: list[str] | None = None
    ) -> str:
        calls["stt"].append((audio, audio_mime, language, terms))
        return "你好，两位"

    def fake_generate_reply(
        scenario: ScenarioDefinition,
        history: list[ChatLine],
        client_completed_ids: list[str],
        learner_text: str | None,
    ) -> TutorReply:
        calls["tutor"].append((scenario.id, history, client_completed_ids, learner_text))
        return _reply()

    monkeypatch.setattr(speech, "synthesize", fake_synthesize)
    monkeypatch.setattr(speech, "transcribe", fake_transcribe)
    monkeypatch.setattr(tutor, "generate_reply", fake_generate_reply)
    return calls


def test_turn_rejects_both_text_and_audio(authed_client: TestClient) -> None:
    response = authed_client.post(
        "/conversation/turn",
        json={"scenario_id": "restaurant", "user_text": "ni hao", "audio_base64": "AAAA"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_turn_rejects_neither_text_nor_audio(authed_client: TestClient) -> None:
    response = authed_client.post("/conversation/turn", json={"scenario_id": "restaurant"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_turn_rejects_blank_text(authed_client: TestClient) -> None:
    response = authed_client.post("/conversation/turn", json={"scenario_id": "restaurant", "user_text": "   "})
    assert response.status_code == 422


def test_start_returns_greeting_with_scenario_voice(authed_client: TestClient, fake_services: dict) -> None:
    response = authed_client.post("/conversation/start", json={"scenario_id": "train"})
    assert response.status_code == 200
    body = response.json()
    assert body["transcript"] is None
    assert body["reply"]["hanzi"] == "你好！几位？"
    assert base64.b64decode(body["audio_base64"]) == FAKE_MP3
    assert body["audio_mime"] == "audio/mpeg"
    assert fake_services["tts"] == [("你好！几位？", "train-voice")]
    assert fake_services["tutor"][0][3] is None


def test_unknown_scenario_is_404(authed_client: TestClient, fake_services: dict) -> None:
    response = authed_client.post("/conversation/start", json={"scenario_id": "moon"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "scenario_not_found"


def test_text_turn(authed_client: TestClient, fake_services: dict) -> None:
    response = authed_client.post(
        "/conversation/turn",
        json={
            "scenario_id": "restaurant",
            "history": [{"role": "npc", "text": "你好！几位？"}],
            "completed_goal_ids": [],
            "user_text": "  liang wei  ",
        },
    )
    assert response.status_code == 200
    assert response.json()["transcript"] is None
    scenario_id, history, _, learner_text = fake_services["tutor"][0]
    assert scenario_id == "restaurant"
    assert history[0].role == "npc"
    assert learner_text == "liang wei"
    assert fake_services["stt"] == []


def test_voice_turn_transcribes_first(authed_client: TestClient, fake_services: dict) -> None:
    audio = base64.b64encode(b"fake-m4a").decode()
    response = authed_client.post(
        "/conversation/turn",
        json={"scenario_id": "restaurant", "audio_base64": audio, "audio_mime": "audio/mp4"},
    )
    assert response.status_code == 200
    assert response.json()["transcript"] == "你好，两位"
    assert fake_services["stt"] == [(b"fake-m4a", "audio/mp4", "zh", RESTAURANT_KEYTERMS)]
    assert fake_services["tutor"][0][3] == "你好，两位"


def test_empty_transcript_is_no_speech(
    authed_client: TestClient, fake_services: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(speech, "transcribe", lambda *args: "")
    audio = base64.b64encode(b"silence").decode()
    response = authed_client.post("/conversation/turn", json={"scenario_id": "restaurant", "audio_base64": audio})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "no_speech"
    assert fake_services["tutor"] == []


def test_transcribe_returns_the_transcript_without_answering(authed_client: TestClient, fake_services: dict) -> None:
    audio = base64.b64encode(b"fake-wav").decode()
    response = authed_client.post(
        "/speech/transcribe",
        json={"scenario_id": "restaurant", "audio_base64": audio, "audio_mime": "audio/wav"},
    )
    assert response.status_code == 200
    assert response.json() == {"transcript": "你好，两位"}
    assert fake_services["stt"] == [(b"fake-wav", "audio/wav", "zh", RESTAURANT_KEYTERMS)]
    assert fake_services["tutor"] == []
    assert fake_services["tts"] == []


@pytest.mark.parametrize("path", ["/speech/transcribe", "/conversation/turn"])
def test_speech_without_chinese_is_not_mandarin(
    authed_client: TestClient, fake_services: dict, monkeypatch: pytest.MonkeyPatch, path: str
) -> None:
    monkeypatch.setattr(speech, "transcribe", lambda *args: "My dawn. She has a gen.")
    audio = base64.b64encode(b"fake-wav").decode()
    response = authed_client.post(path, json={"scenario_id": "restaurant", "audio_base64": audio})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "not_mandarin"
    assert fake_services["tutor"] == []


def test_mixed_chinese_and_english_speech_is_kept(
    authed_client: TestClient, fake_services: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(speech, "transcribe", lambda *args: "WiFi 密码是多少？")
    audio = base64.b64encode(b"fake-wav").decode()
    response = authed_client.post("/speech/transcribe", json={"scenario_id": "hotel", "audio_base64": audio})
    assert response.status_code == 200
    assert response.json()["transcript"] == "WiFi 密码是多少？"


def test_transcribe_unknown_scenario_is_404(authed_client: TestClient, fake_services: dict) -> None:
    audio = base64.b64encode(b"fake-wav").decode()
    response = authed_client.post("/speech/transcribe", json={"scenario_id": "moon", "audio_base64": audio})
    assert response.status_code == 404
    assert fake_services["stt"] == []


def test_audio_over_2mb_is_rejected(authed_client: TestClient, fake_services: dict) -> None:
    audio = base64.b64encode(b"x" * (main.MAX_AUDIO_BYTES + 1)).decode()
    response = authed_client.post("/conversation/turn", json={"scenario_id": "restaurant", "audio_base64": audio})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "audio_too_large"
    assert fake_services["stt"] == []


def test_bad_base64_is_rejected(authed_client: TestClient, fake_services: dict) -> None:
    response = authed_client.post("/conversation/turn", json={"scenario_id": "restaurant", "audio_base64": "not base64!"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_audio"


def test_tts_failure_still_returns_reply(
    authed_client: TestClient, fake_services: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken_tts(text: str, voice_id: str | None = None) -> bytes:
        raise ApiError(502, "tts_failed", "ElevenLabs is down")

    monkeypatch.setattr(speech, "synthesize", broken_tts)
    response = authed_client.post("/conversation/turn", json={"scenario_id": "hotel", "user_text": "wo you yuding"})
    assert response.status_code == 200
    assert response.json()["audio_base64"] is None
    assert response.json()["reply"]["hanzi"]


def test_tts_endpoint(authed_client: TestClient, fake_services: dict) -> None:
    response = authed_client.post("/tts", json={"text": "你好"})
    assert response.status_code == 200
    assert base64.b64decode(response.json()["audio_base64"]) == FAKE_MP3
    assert fake_services["tts"] == [("你好", None)]


def test_tts_text_length_limits(authed_client: TestClient, fake_services: dict) -> None:
    assert authed_client.post("/tts", json={"text": ""}).status_code == 422
    assert authed_client.post("/tts", json={"text": "a" * 201}).status_code == 422


def test_live_token(authed_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(speech, "create_live_token", lambda: "sutkn_test")
    response = authed_client.post("/speech/live-token")
    assert response.status_code == 200
    assert response.json() == {"token": "sutkn_test", "model_id": "scribe_v2_realtime"}


def test_live_token_failure_is_an_api_error(authed_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def broken() -> str:
        raise ApiError(502, "live_token_failed", "Live captions are unavailable right now.")

    monkeypatch.setattr(speech, "create_live_token", broken)
    response = authed_client.post("/speech/live-token")
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "live_token_failed"
