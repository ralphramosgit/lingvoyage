import httpx
import pytest
from fastapi.testclient import TestClient

from app import auth

PRIVATE_ENDPOINTS = [
    ("/tts", {"text": "你好"}),
    ("/conversation/start", {"scenario_id": "restaurant"}),
    ("/conversation/turn", {"scenario_id": "restaurant", "user_text": "ni hao"}),
    ("/speech/live-token", {}),
    ("/speech/transcribe", {"scenario_id": "restaurant", "audio_base64": "AAAA"}),
]


@pytest.mark.parametrize(("path", "body"), PRIVATE_ENDPOINTS)
def test_private_endpoints_need_a_token(client: TestClient, path: str, body: dict[str, str]) -> None:
    response = client.post(path, json=body)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_rejects_non_bearer_header(client: TestClient) -> None:
    response = client.post("/tts", json={"text": "hi"}, headers={"Authorization": "Basic abc"})
    assert response.status_code == 401


def _mock_supabase(monkeypatch: pytest.MonkeyPatch, status: int, calls: list[httpx.Request]) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if status == 200:
            return httpx.Response(200, json={"id": "user-abc", "email": "a@b.co"})
        return httpx.Response(status, json={"msg": "invalid JWT"})

    monkeypatch.setattr(auth, "_http", httpx.Client(transport=httpx.MockTransport(handler)))


def test_invalid_token_is_401(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[httpx.Request] = []
    _mock_supabase(monkeypatch, 403, calls)
    response = client.post("/tts", json={"text": "hi"}, headers={"Authorization": "Bearer bad-token"})
    assert response.status_code == 401
    assert len(calls) == 1


def test_valid_token_is_verified_once_then_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    auth.clear_cache()
    calls: list[httpx.Request] = []
    _mock_supabase(monkeypatch, 200, calls)

    assert auth.verify_token("good-token").id == "user-abc"
    assert auth.verify_token("good-token").id == "user-abc"

    assert len(calls) == 1
    request = calls[0]
    assert str(request.url) == "https://test-project.supabase.co/auth/v1/user"
    assert request.headers["apikey"] == "sb_publishable_test"
    assert request.headers["authorization"] == "Bearer good-token"


def test_supabase_unreachable_is_503(monkeypatch: pytest.MonkeyPatch) -> None:
    auth.clear_cache()
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        raise httpx.ConnectError("down", request=request)

    monkeypatch.setattr(auth, "_http", httpx.Client(transport=httpx.MockTransport(handler)))
    with pytest.raises(auth.ApiError) as excinfo:
        auth.verify_token("any")
    assert excinfo.value.status_code == 503
    assert len(calls) == 2  # tried once more before giving up


def test_dropped_connection_is_retried_once(monkeypatch: pytest.MonkeyPatch) -> None:
    auth.clear_cache()
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            raise httpx.RemoteProtocolError("Server disconnected without sending a response.", request=request)
        return httpx.Response(200, json={"id": "user-abc"})

    monkeypatch.setattr(auth, "_http", httpx.Client(transport=httpx.MockTransport(handler)))
    assert auth.verify_token("good-token").id == "user-abc"
    assert len(calls) == 2


def test_supabase_timeout_is_retried_once(monkeypatch: pytest.MonkeyPatch) -> None:
    # Seen on Lambda: one instance's login checks hung until the timeout while a fresh one worked.
    auth.clear_cache()
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            raise httpx.ReadTimeout("The read operation timed out", request=request)
        return httpx.Response(200, json={"id": "user-abc"})

    monkeypatch.setattr(auth, "_http", httpx.Client(transport=httpx.MockTransport(handler)))
    assert auth.verify_token("good-token").id == "user-abc"
    assert len(calls) == 2


def test_supabase_timing_out_twice_is_503(monkeypatch: pytest.MonkeyPatch) -> None:
    auth.clear_cache()
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        raise httpx.ReadTimeout("The read operation timed out", request=request)

    monkeypatch.setattr(auth, "_http", httpx.Client(transport=httpx.MockTransport(handler)))
    with pytest.raises(auth.ApiError) as excinfo:
        auth.verify_token("any")
    assert excinfo.value.status_code == 503
    assert len(calls) == 2
