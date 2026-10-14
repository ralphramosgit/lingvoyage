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
