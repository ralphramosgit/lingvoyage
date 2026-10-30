import json
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from pydantic import ValidationError

from app.config import get_settings
from app.errors import ApiError
from app.locations.cities import CITIES, find_city
from app.locations.models import ContentItem, FactDraft
from app.locations.store import (
    InMemoryPackStore,
    RunAlreadyActive,
    StoreError,
    SupabasePackStore,
    get_store,
    supabase_headers,
)


def fact(**overrides: object) -> FactDraft:
    fields: dict[str, object] = {
        "category": "transport",
        "title": "Metro Line 18 to the airport",
        "body": "Line 18 runs from Tianfu Airport to the city in about 40 minutes.",
        "hanzi": "十八号线",
        "pinyin": "shí bā hào xiàn",
        "data": {"mode": "metro", "line": "18", "origin": "Tianfu Airport", "fare_cny_min": 2, "fare_cny_max": 10},
        "source_url": "https://example.com/chengdu-metro",
        "source_title": "Chengdu metro guide",
    }
    fields.update(overrides)
    return FactDraft.model_validate(fields)


# ---------------------------------------------------------------------------
# Cities
# ---------------------------------------------------------------------------


def test_cities_are_valid() -> None:
    assert len({city.slug for city in CITIES}) == len(CITIES)
    for city in CITIES:
        assert city.slug.isascii() and city.slug.islower() and city.slug.isalpha()
        assert city.hanzi and city.pinyin and city.name
        assert 18 < city.lat < 54 and 73 < city.lng < 135, f"{city.slug} isn't in mainland China"


def test_find_city() -> None:
    chengdu = find_city("chengdu")
    assert chengdu is not None and chengdu.hanzi == "成都"
    assert find_city("tokyo") is None


# ---------------------------------------------------------------------------
# Fact validation
# ---------------------------------------------------------------------------


def test_valid_fact_keeps_only_set_data_fields() -> None:
    saved = fact()
    assert saved.data == {
        "mode": "metro",
        "line": "18",
        "origin": "Tianfu Airport",
        "fare_cny_min": 2,
        "fare_cny_max": 10,
    }


@pytest.mark.parametrize(
    "overrides",
    [
        {"source_url": ""},
        {"source_url": "chengdu-metro.cn"},
        {"source_url": "ftp://example.com/file"},
        {"title": "x" * 81},
        {"body": ""},
        {"category": "weather"},
        {"data": {"mode": "rocket"}},
        {"data": {"mode": "metro", "colour": "red"}},
        {"data": {"mode": "metro", "fare_cny_min": 10, "fare_cny_max": 2}},
        {"category": "culture", "data": {"mode": "metro"}},
        {"place_key": "Chen Mapo Tofu"},
    ],
)
def test_bad_fact_is_rejected(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        fact(**overrides)


def test_menu_item_needs_its_restaurant() -> None:
    menu_item = {
        "category": "menu_item",
        "data": {"dish": "Mapo tofu", "dish_hanzi": "麻婆豆腐", "dish_pinyin": "má pó dòu fu", "price_cny": 38},
    }
    with pytest.raises(ValidationError, match="place_key"):
        fact(**menu_item)
    assert fact(**menu_item, place_key="chen-mapo-tofu").data["price_cny"] == 38


def test_restaurant_without_a_chinese_name_is_allowed() -> None:
    restaurant = fact(category="restaurant", data={"name": "Panda Burger", "cuisine": "Western"})
    assert restaurant.data["name_hanzi"] == ""


# ---------------------------------------------------------------------------
# In-memory store (the same rules as Supabase)
# ---------------------------------------------------------------------------


def test_one_run_per_city() -> None:
    store = InMemoryPackStore()
    run = store.create_pack("chengdu", requested_by="user-123")
    assert run.status == "queued"
    assert store.get_active_run("chengdu") == run
    with pytest.raises(RunAlreadyActive):
        store.create_pack("chengdu")
    store.create_pack("beijing")  # other cities are unaffected

    store.fail_pack(run.id, "research_failed")
    assert store.get_active_run("chengdu") is None
    store.create_pack("chengdu")  # a failed run frees the city


def test_pack_lifecycle() -> None:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    assert store.get_live_pack("chengdu") is None

    store.set_stage(pack.id, "research")
    running = store.get_pack(pack.id)
    assert running is not None and running.status == "running" and running.stage == "research"

    store.save_trace(pack.id, [{"kind": "search", "text": "Chengdu metro"}], {"web_search_requests": 1})
    store.finish_pack(pack.id)
    live = store.get_live_pack("chengdu")
    assert live is not None and live.id == pack.id and live.trace[0]["text"] == "Chengdu metro"
    assert live.expires_at is not None and live.finished_at is not None
    assert live.expires_at - live.finished_at == timedelta(days=30)
    assert not live.is_stale()
    assert live.is_stale(now=live.expires_at + timedelta(seconds=1))


def test_newest_ready_pack_is_live() -> None:
    store = InMemoryPackStore()
    old = store.create_pack("chengdu")
    store.finish_pack(old.id)
    new = store.create_pack("chengdu")
    store.finish_pack(new.id)
    live = store.get_live_pack("chengdu")
    assert live is not None and live.id == new.id


def test_returned_packs_are_copies() -> None:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    pack.trace.append({"text": "changed by the caller"})
    stored = store.get_pack(pack.id)
    assert stored is not None and stored.trace == []


def test_unknown_pack_is_an_error() -> None:
    store = InMemoryPackStore()
    with pytest.raises(StoreError):
        store.set_stage("missing", "plan")
    with pytest.raises(StoreError):
        store.insert_facts("missing", [fact()])


def test_facts_and_content() -> None:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    saved = store.insert_facts(pack.id, [fact(), fact(category="culture", title="Teahouses", data={})])
    assert all(item.pack_id == pack.id and item.id for item in saved)
    assert [item.title for item in store.get_facts(pack.id)] == ["Teahouses", "Metro Line 18 to the airport"]
    assert [item.category for item in store.get_facts(pack.id, ["transport"])] == ["transport"]

    item = ContentItem(pack_id=pack.id, kind="quiz", ref="local-chengdu-transport", payload={"title": "v1"})
    store.upsert_content(item)
    store.upsert_content(item.model_copy(update={"payload": {"title": "v2"}}))
    content = store.get_content(pack.id, "quiz")
    assert len(content) == 1 and content[0].payload == {"title": "v2"}
    assert store.get_content(pack.id, "encounter") == []


# ---------------------------------------------------------------------------
# Supabase store (requests checked against a fake PostgREST)
# ---------------------------------------------------------------------------

PACK_ROW = {
    "id": "8f0e7c5e-0000-0000-0000-000000000001",
    "city": "chengdu",
    "status": "queued",
    "stage": None,
    "trace": [],
    "usage": {},
    "error": None,
    "requested_by": None,
    "created_at": "2026-10-29T21:00:00+00:00",
    "finished_at": None,
    "expires_at": None,
}


def supabase(handler: Callable[[httpx.Request], httpx.Response]) -> tuple[SupabasePackStore, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    http = httpx.Client(transport=httpx.MockTransport(record))
    return SupabasePackStore("https://test-project.supabase.co", "sb_secret_test", http=http), seen


def test_secret_key_headers() -> None:
    assert supabase_headers("sb_secret_abc") == {"apikey": "sb_secret_abc"}
    assert supabase_headers("eyJhbGciOi.legacy")["Authorization"] == "Bearer eyJhbGciOi.legacy"


def test_supabase_create_pack() -> None:
    store, seen = supabase(lambda _: httpx.Response(201, json=[PACK_ROW]))
    pack = store.create_pack("chengdu", requested_by=None)
    assert pack.id == PACK_ROW["id"] and pack.created_at == datetime(2026, 10, 29, 21, tzinfo=UTC)

    request = seen[0]
    assert request.method == "POST"
    assert request.url.path == "/rest/v1/location_packs"
    assert request.headers["apikey"] == "sb_secret_test"
    assert "authorization" not in request.headers
    assert request.headers["prefer"] == "return=representation"
    assert json.loads(request.content) == {"city": "chengdu", "status": "queued", "requested_by": None}


def test_supabase_second_run_for_a_city() -> None:
    store, _ = supabase(lambda _: httpx.Response(409, json={"code": "23505", "message": "duplicate key value"}))
    with pytest.raises(RunAlreadyActive):
        store.create_pack("chengdu")


def test_supabase_live_pack_query() -> None:
    store, seen = supabase(lambda _: httpx.Response(200, json=[]))
    assert store.get_live_pack("chengdu") is None
    params = dict(seen[0].url.params)
    assert params == {
        "select": "*",
        "city": "eq.chengdu",
        "status": "eq.ready",
        "order": "finished_at.desc",
        "limit": "1",
    }


def test_supabase_insert_facts() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        rows = json.loads(request.content)
        return httpx.Response(
            201,
            json=[{**row, "id": f"fact-{i}", "retrieved_at": "2026-10-29T21:05:00+00:00"} for i, row in enumerate(rows)],
        )

    store, seen = supabase(handler)
    saved = store.insert_facts(PACK_ROW["id"], [fact(), fact(title="Taxi start fare")])
    assert [item.id for item in saved] == ["fact-0", "fact-1"]
    assert all(row["pack_id"] == PACK_ROW["id"] for row in json.loads(seen[0].content))


def test_supabase_update_of_unknown_pack() -> None:
    store, seen = supabase(lambda _: httpx.Response(200, json=[]))
    with pytest.raises(StoreError, match="No pack"):
        store.fail_pack("missing", "research_failed")
    assert seen[0].method == "PATCH" and dict(seen[0].url.params) == {"id": "eq.missing"}


def test_supabase_unreachable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    store, seen = supabase(handler)
    with pytest.raises(StoreError, match="Couldn't reach Supabase"):
        store.get_pack(PACK_ROW["id"])
    assert len(seen) == 2  # retried once on a fresh connection


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@pytest.fixture
def fresh_settings() -> Iterator[None]:
    get_settings.cache_clear()
    get_store.cache_clear()
    yield
    get_settings.cache_clear()
    get_store.cache_clear()


def test_store_needs_the_secret_key(monkeypatch: pytest.MonkeyPatch, fresh_settings: None) -> None:
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "")
    with pytest.raises(ApiError) as caught:
        get_store()
    assert caught.value.code == "server_not_configured"
    assert "SUPABASE_SECRET_KEY" in caught.value.message


def test_store_from_settings(fresh_settings: None) -> None:
    assert isinstance(get_store(), SupabasePackStore)
