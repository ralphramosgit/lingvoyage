"""Where local packs are kept: Supabase (through its REST API, PostgREST) on the server, in memory in tests.

The three tables are backend-only (RLS on, no policies), so every request uses SUPABASE_SECRET_KEY.
That key must never reach the app.
"""

import logging
import threading
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any, Protocol

import httpx

from app.config import get_settings
from app.errors import missing_setting
from app.http_retry import RETRYABLE_ERRORS, RETRYABLE_ERRORS_AND_TIMEOUTS, send_with_retry
from app.locations.models import ContentItem, ContentKind, Fact, FactCategory, FactDraft, Pack, PackStage

logger = logging.getLogger("lingvoyage.locations")

PACK_TTL = timedelta(days=30)
ACTIVE_STATUSES = ("queued", "running")
_UNIQUE_VIOLATION = "23505"  # Postgres error code, here from the location_packs_one_active index


class StoreError(Exception):
    """The store couldn't do what was asked: Supabase unreachable, an unknown pack, a rejected row."""


class RunAlreadyActive(StoreError):
    """The city already has a queued or running pack."""


class PackStore(Protocol):
    def create_pack(self, city: str, requested_by: str | None = None) -> Pack: ...
    def get_pack(self, pack_id: str) -> Pack | None: ...
    def get_live_pack(self, city: str) -> Pack | None: ...
    def get_active_run(self, city: str) -> Pack | None: ...
    def set_stage(self, pack_id: str, stage: PackStage) -> None: ...
    def save_trace(self, pack_id: str, steps: list[dict[str, Any]], usage: dict[str, Any]) -> None: ...
    def finish_pack(self, pack_id: str, ttl: timedelta = PACK_TTL) -> None: ...
    def fail_pack(self, pack_id: str, error: str) -> None: ...
    def insert_facts(self, pack_id: str, facts: list[FactDraft]) -> list[Fact]: ...
    def get_facts(self, pack_id: str, categories: list[FactCategory] | None = None) -> list[Fact]: ...
    def upsert_content(self, item: ContentItem) -> None: ...
    def get_content(self, pack_id: str, kind: ContentKind | None = None) -> list[ContentItem]: ...


def _now() -> datetime:
    return datetime.now(UTC)


def supabase_headers(secret_key: str) -> dict[str, str]:
    """New secret keys (sb_secret_...) go in `apikey` only. Legacy service_role keys are JWTs and
    also go in Authorization."""
    headers = {"apikey": secret_key}
    if secret_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {secret_key}"
    return headers


# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------


class SupabasePackStore:
    def __init__(self, url: str, secret_key: str, http: httpx.Client | None = None) -> None:
        self._base = f"{url}/rest/v1"
        self._headers = supabase_headers(secret_key)
        self._http = http or httpx.Client(timeout=10.0)

    def _request(
        self,
        method: str,
        table: str,
        params: dict[str, str] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = {**self._headers, **({"Prefer": prefer} if prefer else {})}
        # Reads change nothing, so a stuck one is safe to send again. Writes only retry on a dropped connection.
        retry_on = RETRYABLE_ERRORS_AND_TIMEOUTS if method == "GET" else RETRYABLE_ERRORS
        try:
            response = send_with_retry(
                lambda: self._http.request(method, f"{self._base}/{table}", params=params, json=json, headers=headers),
                "Supabase",
                retry_on=retry_on,
            )
        except httpx.HTTPError as error:
            logger.warning("Supabase %s %s failed: %s", method, table, type(error).__name__)
            raise StoreError(f"Couldn't reach Supabase ({type(error).__name__}).") from error

        if response.status_code >= 400:
            code, message = _postgrest_error(response)
            logger.warning("Supabase %s %s: HTTP %s %s %s", method, table, response.status_code, code, message)
            if code == _UNIQUE_VIOLATION and table == "location_packs":
                raise RunAlreadyActive("This city already has a pack in progress.")
            raise StoreError(f"Supabase {method} {table}: HTTP {response.status_code} {code}".strip())
        return response.json() if response.content else None

    def _select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        return self._request("GET", table, params={"select": "*", **params}) or []

    def _update_pack(self, pack_id: str, fields: dict[str, Any]) -> None:
        rows = self._request(
            "PATCH", "location_packs", params={"id": f"eq.{pack_id}"}, json=fields, prefer="return=representation"
        )
        if not rows:
            raise StoreError(f"No pack {pack_id}.")

    def create_pack(self, city: str, requested_by: str | None = None) -> Pack:
        rows = self._request(
            "POST",
            "location_packs",
            json={"city": city, "status": "queued", "requested_by": requested_by},
            prefer="return=representation",
        )
        return Pack.model_validate(rows[0])

    def get_pack(self, pack_id: str) -> Pack | None:
        rows = self._select("location_packs", {"id": f"eq.{pack_id}", "limit": "1"})
        return Pack.model_validate(rows[0]) if rows else None

    def get_live_pack(self, city: str) -> Pack | None:
        rows = self._select(
            "location_packs",
            {"city": f"eq.{city}", "status": "eq.ready", "order": "finished_at.desc", "limit": "1"},
        )
        return Pack.model_validate(rows[0]) if rows else None

    def get_active_run(self, city: str) -> Pack | None:
        rows = self._select(
            "location_packs",
            {"city": f"eq.{city}", "status": f"in.({','.join(ACTIVE_STATUSES)})", "limit": "1"},
        )
        return Pack.model_validate(rows[0]) if rows else None

    def set_stage(self, pack_id: str, stage: PackStage) -> None:
        self._update_pack(pack_id, {"stage": stage, "status": "running"})

    def save_trace(self, pack_id: str, steps: list[dict[str, Any]], usage: dict[str, Any]) -> None:
        # Only the worker writes the trace, so it sends the whole (capped) list each time.
        self._update_pack(pack_id, {"trace": steps, "usage": usage})

    def finish_pack(self, pack_id: str, ttl: timedelta = PACK_TTL) -> None:
        now = _now()
        self._update_pack(
            pack_id, {"status": "ready", "finished_at": now.isoformat(), "expires_at": (now + ttl).isoformat()}
        )

    def fail_pack(self, pack_id: str, error: str) -> None:
        self._update_pack(pack_id, {"status": "failed", "error": error, "finished_at": _now().isoformat()})

    def insert_facts(self, pack_id: str, facts: list[FactDraft]) -> list[Fact]:
        if not facts:
            return []
        rows = self._request(
            "POST",
            "location_facts",
            json=[{"pack_id": pack_id, **fact.model_dump()} for fact in facts],
            prefer="return=representation",
        )
        return [Fact.model_validate(row) for row in rows]

    def get_facts(self, pack_id: str, categories: list[FactCategory] | None = None) -> list[Fact]:
        # A pack has a few hundred facts, well under Supabase's default page of 1,000 rows.
        params = {"pack_id": f"eq.{pack_id}", "order": "category,title"}
        if categories:
            params["category"] = f"in.({','.join(categories)})"
        return [Fact.model_validate(row) for row in self._select("location_facts", params)]

    def upsert_content(self, item: ContentItem) -> None:
        self._request(
            "POST",
            "location_content",
            params={"on_conflict": "pack_id,kind,ref"},
            json=item.model_dump(),
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def get_content(self, pack_id: str, kind: ContentKind | None = None) -> list[ContentItem]:
        params = {"pack_id": f"eq.{pack_id}", "order": "kind,ref"}
        if kind:
            params["kind"] = f"eq.{kind}"
        return [ContentItem.model_validate(row) for row in self._select("location_content", params)]


def _postgrest_error(response: httpx.Response) -> tuple[str, str]:
    """PostgREST errors are JSON with a Postgres `code` (like 23505) and a `message`."""
    try:
        body = response.json()
    except ValueError:
        return "", response.text[:200]
    if not isinstance(body, dict):
        return "", ""
    return str(body.get("code") or ""), str(body.get("message") or "")[:200]


# ---------------------------------------------------------------------------
# In memory (tests and dry runs)
# ---------------------------------------------------------------------------


class InMemoryPackStore:
    """Behaves like the Supabase store, including the one-run-per-city rule. Nothing is saved."""

    def __init__(self) -> None:
        self._lock = threading.Lock()  # research workers run in parallel threads
        self._packs: dict[str, Pack] = {}
        self._facts: dict[str, list[Fact]] = {}
        self._content: dict[tuple[str, str, str], ContentItem] = {}

    def _require_pack(self, pack_id: str) -> Pack:
        pack = self._packs.get(pack_id)
        if pack is None:
            raise StoreError(f"No pack {pack_id}.")
        return pack

    def _update_pack(self, pack_id: str, fields: dict[str, Any]) -> None:
        with self._lock:
            self._packs[pack_id] = self._require_pack(pack_id).model_copy(update=fields)

    def create_pack(self, city: str, requested_by: str | None = None) -> Pack:
        with self._lock:
            if any(pack.city == city and pack.status in ACTIVE_STATUSES for pack in self._packs.values()):
                raise RunAlreadyActive("This city already has a pack in progress.")
            pack = Pack(id=str(uuid.uuid4()), city=city, status="queued", requested_by=requested_by, created_at=_now())
            self._packs[pack.id] = pack
            return pack.model_copy(deep=True)

    def get_pack(self, pack_id: str) -> Pack | None:
        with self._lock:
            pack = self._packs.get(pack_id)
            return pack.model_copy(deep=True) if pack else None

    def get_live_pack(self, city: str) -> Pack | None:
        with self._lock:
            ready = [pack for pack in self._packs.values() if pack.city == city and pack.status == "ready"]
            if not ready:
                return None
            return max(ready, key=lambda pack: pack.finished_at or pack.created_at).model_copy(deep=True)

    def get_active_run(self, city: str) -> Pack | None:
        with self._lock:
            for pack in self._packs.values():
                if pack.city == city and pack.status in ACTIVE_STATUSES:
                    return pack.model_copy(deep=True)
            return None

    def set_stage(self, pack_id: str, stage: PackStage) -> None:
        self._update_pack(pack_id, {"stage": stage, "status": "running"})

    def save_trace(self, pack_id: str, steps: list[dict[str, Any]], usage: dict[str, Any]) -> None:
        self._update_pack(pack_id, {"trace": list(steps), "usage": dict(usage)})

    def finish_pack(self, pack_id: str, ttl: timedelta = PACK_TTL) -> None:
        now = _now()
        self._update_pack(pack_id, {"status": "ready", "finished_at": now, "expires_at": now + ttl})

    def fail_pack(self, pack_id: str, error: str) -> None:
        self._update_pack(pack_id, {"status": "failed", "error": error, "finished_at": _now()})

    def insert_facts(self, pack_id: str, facts: list[FactDraft]) -> list[Fact]:
        with self._lock:
            self._require_pack(pack_id)
            saved = [
                Fact(id=str(uuid.uuid4()), pack_id=pack_id, retrieved_at=_now(), **fact.model_dump()) for fact in facts
            ]
            self._facts.setdefault(pack_id, []).extend(saved)
            return [fact.model_copy(deep=True) for fact in saved]

    def get_facts(self, pack_id: str, categories: list[FactCategory] | None = None) -> list[Fact]:
        with self._lock:
            facts = [
                fact for fact in self._facts.get(pack_id, []) if categories is None or fact.category in categories
            ]
            return [fact.model_copy(deep=True) for fact in sorted(facts, key=lambda fact: (fact.category, fact.title))]

    def upsert_content(self, item: ContentItem) -> None:
        with self._lock:
            self._require_pack(item.pack_id)
            self._content[(item.pack_id, item.kind, item.ref)] = item.model_copy(deep=True)

    def get_content(self, pack_id: str, kind: ContentKind | None = None) -> list[ContentItem]:
        with self._lock:
            items = [
                item for (item_pack, item_kind, _), item in self._content.items()
                if item_pack == pack_id and (kind is None or item_kind == kind)
            ]
            return [item.model_copy(deep=True) for item in sorted(items, key=lambda item: (item.kind, item.ref))]


@lru_cache
def get_store() -> PackStore:
    """The Supabase store, from the settings. Tests use InMemoryPackStore directly."""
    settings = get_settings()
    if not settings.supabase_url:
        raise missing_setting("SUPABASE_URL")
    if not settings.supabase_secret_key:
        raise missing_setting("SUPABASE_SECRET_KEY")
    return SupabasePackStore(settings.supabase_url, settings.supabase_secret_key)
