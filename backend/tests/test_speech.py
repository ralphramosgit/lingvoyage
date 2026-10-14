import httpx
import pytest

from app import speech


def _mock_elevenlabs(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    monkeypatch.setattr(speech, "_http", httpx.Client(transport=httpx.MockTransport(handler)))


def test_tts_retries_once_after_a_reset_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            raise httpx.ReadError("Connection reset by peer", request=request)
        return httpx.Response(200, content=b"mp3-bytes")

    _mock_elevenlabs(monkeypatch, handler)
    assert speech.synthesize("你好") == b"mp3-bytes"
    assert len(calls) == 2


def test_stt_retry_resends_the_audio(monkeypatch: pytest.MonkeyPatch) -> None:
    bodies: list[bytes] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(request.read())
        if len(bodies) == 1:
            raise httpx.RemoteProtocolError("Server disconnected without sending a response.", request=request)
        return httpx.Response(200, json={"text": " ni hao "})

    _mock_elevenlabs(monkeypatch, handler)
    assert speech.transcribe(b"fake-audio", "audio/mp4") == "ni hao"
    assert len(bodies) == 2
    assert b"fake-audio" in bodies[1]


def test_tts_gives_up_after_the_second_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        raise httpx.ConnectError("down", request=request)

    _mock_elevenlabs(monkeypatch, handler)
    with pytest.raises(speech.ApiError) as excinfo:
        speech.synthesize("你好")
    assert excinfo.value.code == "tts_failed"
    assert len(calls) == 2


def test_tts_timeout_is_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        raise httpx.ReadTimeout("slow", request=request)

    _mock_elevenlabs(monkeypatch, handler)
    with pytest.raises(speech.ApiError) as excinfo:
        speech.synthesize("你好")
    assert excinfo.value.code == "tts_timeout"
    assert len(calls) == 1


def test_wav_recordings_are_uploaded_as_wav(monkeypatch: pytest.MonkeyPatch) -> None:
    bodies: list[bytes] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(request.read())
        return httpx.Response(200, json={"text": "两位"})

    _mock_elevenlabs(monkeypatch, handler)
    assert speech.transcribe(b"RIFF-fake", "audio/wav") == "两位"
    assert b'filename="speech.wav"' in bodies[0]
    assert b"Content-Type: audio/wav" in bodies[0]


def test_live_token_comes_from_the_single_use_token_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"token": "sutkn_123"})

    _mock_elevenlabs(monkeypatch, handler)
    assert speech.create_live_token() == "sutkn_123"
    assert requests[0].method == "POST"
    assert requests[0].url.path == "/v1/single-use-token/realtime_scribe"
    assert requests[0].headers["xi-api-key"] == "sk_test"


def test_live_token_error_is_mapped(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_elevenlabs(monkeypatch, lambda request: httpx.Response(401, json={"detail": {"status": "invalid_api_key"}}))
    with pytest.raises(speech.ApiError) as excinfo:
        speech.create_live_token()
    assert excinfo.value.code == "live_token_failed"
