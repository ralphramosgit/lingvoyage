from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_route_uses_error_shape(client: TestClient) -> None:
    response = client.get("/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
