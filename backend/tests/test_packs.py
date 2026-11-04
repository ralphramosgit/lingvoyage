import json
import threading
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.config import Settings, get_settings
from app.errors import ApiError
from app.locations import packs
from app.locations import store as store_module
from app.locations.cities import CITIES
from app.locations.models import ContentItem, FactDraft
from app.locations.routes import pack_store
from app.locations.store import InMemoryPackStore, StoreError
from app.main import app
from app.research import jobs, worker
from app.scenarios import SCENARIOS

START = datetime(2026, 10, 31, 12, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    clock = Clock()
    monkeypatch.setattr(packs, "_now", clock)
    return clock


@pytest.fixture
def store(clock: Clock) -> InMemoryPackStore:
    return InMemoryPackStore(clock=clock)


@pytest.fixture
def started(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Runs the routes started, by pack id. Nothing is built."""
    runs: list[str] = []
    monkeypatch.setattr(jobs, "start_run", lambda pack: runs.append(pack.id))
    return runs


@pytest.fixture
def api(client: TestClient, store: InMemoryPackStore) -> Iterator[Callable[[str], TestClient]]:
    """The test client, signed in as the given account."""
    packs.clear_cache()
    app.dependency_overrides[pack_store] = lambda: store

    def as_user(user_id: str = "user-1") -> TestClient:
        app.dependency_overrides[auth.require_user] = lambda: auth.AuthUser(id=user_id)
        return client

    yield as_user
    packs.clear_cache()


def fact(**overrides: Any) -> FactDraft:
    fields: dict[str, Any] = {
        "category": "culture",
        "title": "Teahouses",
        "body": "People spend whole afternoons in teahouses.",
        "source_url": "https://example.com/teahouses",
        "source_title": "Chengdu teahouses",
    }
    return FactDraft.model_validate({**fields, **overrides})


def ready_pack(store: InMemoryPackStore, city: str = "chengdu", facts: list[FactDraft] | None = None) -> str:
    pack = store.create_pack(city)
    store.insert_facts(pack.id, facts or [fact()])
    store.finish_pack(pack.id)
    return pack.id


def error_code(response: Any) -> str:
    return response.json()["error"]["code"]


@pytest.fixture
def every_city_open(monkeypatch: pytest.MonkeyPatch) -> None:
    """For the tests about limits, which need more cities than are open."""
    for city in CITIES:
        monkeypatch.setattr(city, "available", True)


# ---------------------------------------------------------------------------
# Cities and access
# ---------------------------------------------------------------------------


def test_cities_need_no_login(client: TestClient) -> None:
    response = client.get("/cities")
    assert response.status_code == 200
    cities = response.json()
    assert len(cities) == 12 and cities[0]["slug"] == "beijing" and cities[2]["hanzi"] == "成都"
    assert [city["slug"] for city in cities if city["available"]] == ["beijing", "shanghai", "chengdu", "chongqing"]
    assert all("must_see" not in city for city in cities)


def test_packs_need_login(client: TestClient) -> None:
    for method, path in (("POST", "/packs/chengdu"), ("GET", "/packs/chengdu/status"), ("GET", "/packs/chengdu")):
        assert client.request(method, path).status_code == 401


def test_unknown_city(api: Callable[[str], TestClient]) -> None:
    for method, path in (("POST", "/packs/tokyo"), ("GET", "/packs/tokyo/status"), ("GET", "/packs/tokyo")):
        response = api("user-1").request(method, path)
        assert response.status_code == 404 and error_code(response) == "city_not_found"


# ---------------------------------------------------------------------------
# POST /packs/{city}
# ---------------------------------------------------------------------------


def test_coming_soon_city_starts_nothing(api: Callable[[str], TestClient], started: list[str]) -> None:
    response = api("user-1").post("/packs/xian")
    assert response.status_code == 403 and error_code(response) == "city_coming_soon"
    assert response.json()["error"]["message"] == "Xi'an is coming soon. For now, pick Beijing, Shanghai, Chengdu or Chongqing."
    assert started == []
    assert api("user-1").get("/packs/xian/status").json()["status"] == "none"


def test_first_request_starts_one_shared_run(
    api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str]
) -> None:
    first = api("user-1").post("/packs/chengdu").json()
    assert (first["status"], first["ready_pack_id"], first["refreshing"]) == ("queued", None, False)
    second = api("user-2").post("/packs/chengdu").json()
    assert second["status"] == "queued"
    run = store.get_active_run("chengdu")
    assert run is not None and started == [run.id] and run.requested_by == "user-1"


def test_ready_pack_needs_no_run(api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str]) -> None:
    pack_id = ready_pack(store)
    status = api("user-1").post("/packs/chengdu").json()
    assert (status["status"], status["ready_pack_id"]) == ("ready", pack_id)
    assert started == []


def test_expired_pack_is_served_while_a_refresh_builds(
    api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str], clock: Clock
) -> None:
    old = ready_pack(store)
    clock.advance(days=31)
    status = api("user-1").post("/packs/chengdu").json()
    assert (status["status"], status["ready_pack_id"], status["refreshing"]) == ("queued", old, True)
    refresh = store.get_active_run("chengdu")
    assert refresh is not None and started == [refresh.id] and refresh.requested_by is None  # not the learner's run
    assert api("user-1").get("/packs/chengdu").json()["id"] == old


def test_failed_refresh_waits_a_day(
    api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str], clock: Clock
) -> None:
    ready_pack(store)
    clock.advance(days=31)
    api("user-1").post("/packs/chengdu")
    store.fail_pack(started[0], "research_failed")

    assert api("user-1").post("/packs/chengdu").json()["status"] == "ready"
    assert len(started) == 1
    clock.advance(hours=25)
    assert api("user-1").post("/packs/chengdu").json()["status"] == "queued"
    assert len(started) == 2


def test_stuck_run_times_out(
    api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str], clock: Clock
) -> None:
    api("user-1").post("/packs/chengdu")
    clock.advance(minutes=21)
    status = api("user-1").get("/packs/chengdu/status").json()
    assert status["status"] == "failed" and status["error"]["code"] == "timed_out"
    assert "took too long" in status["error"]["message"]
    assert api("user-1").post("/packs/chengdu").json()["status"] == "queued"
    assert len(started) == 2


@pytest.mark.usefixtures("every_city_open")
def test_account_limit(api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str]) -> None:
    ready_pack(store, "chengdu")
    for city in ("beijing", "shanghai", "xian"):
        assert api("user-1").post(f"/packs/{city}").json()["status"] == "queued"
    response = api("user-1").post("/packs/guilin")
    assert response.status_code == 429 and error_code(response) == "pack_limit"
    assert api("user-1").post("/packs/chengdu").json()["status"] == "ready"  # a built city is still free
    assert api("user-2").post("/packs/guilin").json()["status"] == "queued"  # other accounts aren't affected


@pytest.fixture
def limits(monkeypatch: pytest.MonkeyPatch) -> Iterator[Callable[[int, int], None]]:
    def set_limits(per_day: int, per_account: int) -> None:
        monkeypatch.setenv("RESEARCH_RUNS_PER_DAY", str(per_day))
        monkeypatch.setenv("RESEARCH_RUNS_PER_ACCOUNT_PER_DAY", str(per_account))
        get_settings.cache_clear()

    yield set_limits
    get_settings.cache_clear()


def test_default_limits_are_small() -> None:
    fields = Settings.model_fields
    assert (fields["research_runs_per_day"].default, fields["research_runs_per_account_per_day"].default) == (2, 1)


@pytest.mark.usefixtures("every_city_open")
def test_daily_limit_for_everyone(
    api: Callable[[str], TestClient], started: list[str], limits: Callable[[int, int], None]
) -> None:
    limits(2, 3)
    api("user-1").post("/packs/beijing")
    api("user-2").post("/packs/shanghai")
    response = api("user-3").post("/packs/xian")
    assert response.status_code == 429 and error_code(response) == "packs_busy"


def test_run_that_cant_start_is_marked_failed(
    api: Callable[[str], TestClient], store: InMemoryPackStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(_: Any) -> None:
        raise ApiError(503, "research_unavailable", "Couldn't start building the pack.")

    monkeypatch.setattr(jobs, "start_run", broken)
    response = api("user-1").post("/packs/chengdu")
    assert response.status_code == 503 and error_code(response) == "research_unavailable"
    latest = store.get_latest_pack("chengdu")
    assert latest is not None and (latest.status, latest.error) == ("failed", "start_failed")
    assert store.get_active_run("chengdu") is None


def test_database_errors_are_503(api: Callable[[str], TestClient], store: InMemoryPackStore, monkeypatch: pytest.MonkeyPatch) -> None:
    def down(_: str) -> None:
        raise StoreError("Couldn't reach Supabase.")

    monkeypatch.setattr(store, "get_live_pack", down)
    response = api("user-1").post("/packs/chengdu")
    assert response.status_code == 503 and error_code(response) == "packs_unavailable"


def test_new_runs_can_be_paused(
    api: Callable[[str], TestClient],
    store: InMemoryPackStore,
    started: list[str],
    clock: Clock,
    limits: Callable[[int, int], None],
) -> None:
    ready_pack(store, "chengdu")
    limits(0, 1)
    response = api("user-1").post("/packs/beijing")
    assert response.status_code == 503 and error_code(response) == "packs_paused"
    assert api("user-1").post("/packs/chengdu").json()["status"] == "ready"  # built cities still work
    clock.advance(days=31)
    assert api("user-1").post("/packs/chengdu").json()["status"] == "ready"  # and no refresh starts
    assert started == []


# ---------------------------------------------------------------------------
# GET /packs/{city}/status
# ---------------------------------------------------------------------------


def test_status_with_nothing_built(api: Callable[[str], TestClient], started: list[str]) -> None:
    assert api("user-1").get("/packs/chengdu/status").json()["status"] == "none"
    assert started == []  # polling never starts a run


def test_status_while_building(api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str]) -> None:
    api("user-1").post("/packs/chengdu")
    steps = [{"t": f"2026-10-31T12:00:{n:02d}Z", "stage": "research", "kind": "search", "text": f"step {n}"} for n in range(60)]
    store.set_stage(started[0], "research")
    store.save_trace(started[0], steps, {"counts": {"facts": 12, "places": 3, "sources": 7}})

    status = api("user-1").get("/packs/chengdu/status").json()
    assert (status["status"], status["stage"]) == ("running", "research")
    assert len(status["steps"]) == 50 and status["steps"][-1]["text"] == "step 59"
    assert status["counts"] == {"facts": 12, "places": 3, "sources": 7}


def test_status_after_a_failure(api: Callable[[str], TestClient], store: InMemoryPackStore, started: list[str]) -> None:
    api("user-1").post("/packs/chengdu")
    store.fail_pack(started[0], "research_failed")
    status = api("user-1").get("/packs/chengdu/status").json()
    assert status["status"] == "failed"
    assert status["error"] == {
        "code": "research_failed",
        "message": "We couldn't find enough about Chengdu this time. Try again.",
    }


# ---------------------------------------------------------------------------
# GET /packs/{city}
# ---------------------------------------------------------------------------


def test_pack_not_ready(api: Callable[[str], TestClient]) -> None:
    response = api("user-1").get("/packs/chengdu")
    assert response.status_code == 404 and error_code(response) == "pack_not_ready"


def test_pack_content(api: Callable[[str], TestClient], store: InMemoryPackStore) -> None:
    pack_id = ready_pack(
        store,
        facts=[
            fact(),
            fact(title="Ear cleaning", source_title=""),  # same page: listed once
            fact(title="No tipping", source_url="https://example.com/manners", source_title="Manners"),
        ],
    )
    encounter = SCENARIOS[0].model_copy(update={"id": "local-chengdu-airport"}).model_dump()
    note = {"title": "Teahouses", "body": "Locals spend afternoons there.", "terms": [], "fact_ids": ["f1"]}
    notes = {"unit_id": "table", "notes": [note, note], "lesson": None}
    question = SCENARIOS[0].lessons[0].exercises[0].model_dump()
    quiz = {"id": "local-chengdu-transport", "title": "Getting around Chengdu", "summary": "Lines and fares.",
            "icon": "TrainFront", "exercises": [question] * 6}
    for item in (
        ContentItem(pack_id=pack_id, kind="encounter", ref="local-chengdu-airport", payload=encounter),
        ContentItem(pack_id=pack_id, kind="encounter", ref="broken", payload={"id": "broken"}),
        ContentItem(pack_id=pack_id, kind="unit_notes", ref="table", payload=notes),
        ContentItem(pack_id=pack_id, kind="unit_notes", ref="broken", payload={"unit_id": "not-a-unit"}),
        ContentItem(pack_id=pack_id, kind="quiz", ref="local-chengdu-transport", payload=quiz),
    ):
        store.upsert_content(item)

    pack = api("user-1").get("/packs/chengdu").json()
    assert pack["id"] == pack_id and pack["city"] == "chengdu"
    assert [item["id"] for item in pack["encounters"]] == ["local-chengdu-airport"]  # the broken one is skipped
    assert "scene_details" not in pack["encounters"][0] and "voice_env" not in pack["encounters"][0]
    assert [item["unit_id"] for item in pack["unit_notes"]] == ["table"]  # the broken one is skipped
    assert [item["id"] for item in pack["quizzes"]] == ["local-chengdu-transport"]
    assert len(pack["quizzes"][0]["exercises"]) == 6
    assert pack["sources"] == [
        {"url": "https://example.com/teahouses", "title": "Chengdu teahouses"},
        {"url": "https://example.com/manners", "title": "Manners"},
    ]


# ---------------------------------------------------------------------------
# Starting runs (jobs.py) and the worker Lambda (worker.py)
# ---------------------------------------------------------------------------


@pytest.fixture
def fresh_settings() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_start_run_invokes_the_worker_lambda(monkeypatch: pytest.MonkeyPatch, fresh_settings: None) -> None:
    monkeypatch.setenv("RESEARCH_FUNCTION_NAME", "lingvoyage-research")
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(jobs, "_lambda_client", lambda: SimpleNamespace(invoke=lambda **kwargs: calls.append(kwargs)))
    pack = InMemoryPackStore().create_pack("chengdu")
    jobs.start_run(pack)
    assert calls[0]["FunctionName"] == "lingvoyage-research" and calls[0]["InvocationType"] == "Event"
    assert json.loads(calls[0]["Payload"]) == {"pack_id": pack.id, "city": "chengdu"}


def test_start_run_reports_a_failed_invoke(monkeypatch: pytest.MonkeyPatch, fresh_settings: None) -> None:
    monkeypatch.setenv("RESEARCH_FUNCTION_NAME", "lingvoyage-research")

    def refuse(**_: Any) -> None:
        raise RuntimeError("AccessDeniedException")

    monkeypatch.setattr(jobs, "_lambda_client", lambda: SimpleNamespace(invoke=refuse))
    with pytest.raises(ApiError) as caught:
        jobs.start_run(InMemoryPackStore().create_pack("chengdu"))
    assert caught.value.code == "research_unavailable"


def test_start_run_on_lambda_needs_the_worker(monkeypatch: pytest.MonkeyPatch, fresh_settings: None) -> None:
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "lingvoyage-api")
    with pytest.raises(ApiError) as caught:
        jobs.start_run(InMemoryPackStore().create_pack("chengdu"))
    assert caught.value.code == "server_not_configured" and "RESEARCH_FUNCTION_NAME" in caught.value.message


def test_start_run_locally_uses_a_thread(monkeypatch: pytest.MonkeyPatch) -> None:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    ran = threading.Event()

    def fake_run(run_store: Any, pack_id: str) -> dict[str, str]:
        assert run_store is store and pack_id == pack.id
        ran.set()
        return {"status": "ready"}

    monkeypatch.setattr(store_module, "get_store", lambda: store)
    monkeypatch.setattr(worker, "run_queued_pack", fake_run)
    jobs.start_run(pack)
    assert ran.wait(timeout=5)


def test_worker_builds_a_queued_pack_once(monkeypatch: pytest.MonkeyPatch) -> None:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    built: list[str] = []

    def fake_run_pack(city: str, run_store: Any, pack_id: str) -> SimpleNamespace:
        built.append(pack_id)
        return SimpleNamespace(status="ready", error=None, usage={"seconds": {"research": 180.0}, "cost_usd_estimate": 3.8})

    monkeypatch.setattr(worker, "run_pack", fake_run_pack)
    assert worker.run_queued_pack(store, pack.id) == {"pack_id": pack.id, "city": "chengdu", "status": "ready", "error": None}
    assert worker.run_queued_pack(store, pack.id)["status"] == "skipped"  # the same event delivered twice
    assert worker.run_queued_pack(store, "missing")["status"] == "skipped"
    assert built == [pack.id]


def test_worker_handler_needs_a_pack_id() -> None:
    assert worker.handler({}, None) == {"status": "ignored"}
    assert worker.handler({"pack_id": 42}, None) == {"status": "ignored"}
