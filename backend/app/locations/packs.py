"""Local packs for the app: make sure a city's pack exists, say how it's going, and serve it.

The rules (issue #34):
- One run per city at a time. Everyone who picks the city meanwhile shares it.
- A run that's been going for 15 minutes is stuck (the worker times out at 10): it's marked failed.
- A ready pack is served even after it expires, while a refresh builds the next one in the background.
  A refresh that failed isn't retried for a day.
- Each run costs about $4 of Claude credits, so new runs are capped per day: for all accounts together
  (RESEARCH_RUNS_PER_DAY, default 2) and per account (RESEARCH_RUNS_PER_ACCOUNT_PER_DAY, default 1).
  0 pauses new runs. A city that's already built costs nothing, and refreshes don't count against the
  account (only against the daily total).
"""

import logging
import threading
from collections import OrderedDict
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings
from app.errors import ApiError
from app.locations.cities import City
from app.locations.models import Pack, PackStage
from app.locations.store import PackStore, RunAlreadyActive
from app.research import jobs
from app.scenarios import Scenario, ScenarioDefinition

logger = logging.getLogger("lingvoyage.locations")

STUCK_AFTER = timedelta(minutes=15)
RETRY_FAILED_REFRESH_AFTER = timedelta(days=1)
DAY = timedelta(days=1)
STATUS_STEPS = 50
CACHED_PACKS = 32


class PackStep(BaseModel):
    t: str
    stage: str
    kind: str
    text: str
    worker: str | None = None
    url: str | None = None


class PackCounts(BaseModel):
    facts: int = 0
    places: int = 0
    sources: int = 0


class PackError(BaseModel):
    code: str
    message: str


class PackStatus(BaseModel):
    city: str
    status: Literal["none", "queued", "running", "ready", "failed"]
    stage: PackStage | None = None
    steps: list[PackStep] = Field(default_factory=list)  # the last 50 trace steps, newest last
    counts: PackCounts = Field(default_factory=PackCounts)
    ready_pack_id: str | None = None  # set whenever a ready pack exists, even an expired one being refreshed
    refreshing: bool = False
    error: PackError | None = None


class Source(BaseModel):
    url: str
    title: str


class LocalPack(BaseModel):
    id: str
    city: str
    built_at: datetime
    encounters: list[Scenario] = Field(default_factory=list)  # issue #35
    unit_notes: list[dict[str, Any]] = Field(default_factory=list)  # LocalUnitNotes, issue #36
    quizzes: list[dict[str, Any]] = Field(default_factory=list)  # LocalQuiz, issue #36
    sources: list[Source] = Field(default_factory=list)


def _now() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


def _error(code: str, city: City) -> PackError:
    messages = {
        "research_failed": f"We couldn't find enough about {city.name} this time. Try again.",
        "timed_out": f"Building your {city.name} pack took too long. Try again.",
    }
    return PackError(code=code, message=messages.get(code, f"We couldn't build your {city.name} pack. Try again."))


def _steps(pack: Pack) -> list[PackStep]:
    steps = []
    for step in pack.trace[-STATUS_STEPS:]:
        try:
            steps.append(PackStep.model_validate(step))
        except ValidationError:
            continue
    return steps


def _counts(pack: Pack) -> PackCounts:
    try:
        return PackCounts.model_validate(pack.usage.get("counts") or {})
    except ValidationError:
        return PackCounts()


def _current_run(store: PackStore, city: City, now: datetime) -> Pack | None:
    """The city's queued or running pack, after marking one that's stuck as failed."""
    run = store.get_active_run(city.slug)
    if run is not None and now - run.created_at > STUCK_AFTER:
        logger.warning("Pack %s for %s has been %s since %s; marking it timed out", run.id, city.slug, run.status,
                       run.created_at)
        store.fail_pack(run.id, "timed_out")
        return None
    return run


def _status(store: PackStore, city: City, live: Pack | None, run: Pack | None) -> PackStatus:
    ready_pack_id = live.id if live else None
    if run is not None:
        return PackStatus(
            city=city.slug,
            status=run.status,  # type: ignore[arg-type]
            stage=run.stage,
            steps=_steps(run),
            counts=_counts(run),
            ready_pack_id=ready_pack_id,
            refreshing=live is not None,
        )
    if live is not None:
        return PackStatus(
            city=city.slug,
            status="ready",
            stage=live.stage,
            steps=_steps(live),
            counts=_counts(live),
            ready_pack_id=live.id,
        )
    latest = store.get_latest_pack(city.slug)
    if latest is not None and latest.status == "failed":
        return PackStatus(
            city=city.slug,
            status="failed",
            stage=latest.stage,
            steps=_steps(latest),
            counts=_counts(latest),
            error=_error(latest.error or "", city),
        )
    return PackStatus(city=city.slug, status="none")


def pack_status(store: PackStore, city: City) -> PackStatus:
    now = _now()
    live = store.get_live_pack(city.slug)
    return _status(store, city, live, _current_run(store, city, now))


# ---------------------------------------------------------------------------
# Starting runs
# ---------------------------------------------------------------------------


def _start(store: PackStore, city: City, requested_by: str | None, now: datetime) -> Pack | None:
    settings = get_settings()
    per_day, per_account = settings.research_runs_per_day, settings.research_runs_per_account_per_day
    if per_day <= 0 or per_account <= 0:
        raise ApiError(503, "packs_paused", "New city packs are paused right now. Pick a city that's already built.")
    if store.count_runs_since(now - DAY) >= per_day:
        raise ApiError(429, "packs_busy", "We've built as many city packs as we can today. Try again tomorrow.")
    if requested_by and store.count_runs_since(now - DAY, requested_by) >= per_account:
        cities = "city" if per_account == 1 else "cities"
        raise ApiError(429, "pack_limit", f"You've started {per_account} new {cities} today. Try again tomorrow.")
    try:
        pack = store.create_pack(city.slug, requested_by)
    except RunAlreadyActive:
        return store.get_active_run(city.slug)  # someone else started it a moment ago
    try:
        jobs.start_run(pack)
    except Exception:
        store.fail_pack(pack.id, "start_failed")
        raise
    logger.info("Started pack %s for %s (requested by %s)", pack.id, city.slug, requested_by or "a refresh")
    return pack


def _may_refresh(store: PackStore, city: City, now: datetime) -> bool:
    latest = store.get_latest_pack(city.slug)
    return not (latest and latest.status == "failed" and now - latest.created_at < RETRY_FAILED_REFRESH_AFTER)


def ensure_pack(store: PackStore, city: City, user_id: str) -> PackStatus:
    """The app calls this when the learner picks a city, and again whenever it opens: returns the pack if
    it's ready, otherwise starts building one (or joins the run that's already going)."""
    now = _now()
    live = store.get_live_pack(city.slug)
    run = _current_run(store, city, now)
    if run is None and live is None:
        run = _start(store, city, user_id, now)
    elif run is None and live is not None and live.is_stale(now) and _may_refresh(store, city, now):
        try:
            run = _start(store, city, None, now)
        except ApiError as error:  # the old pack is still served, so a refresh that can't start isn't an error
            logger.warning("Couldn't start a refresh of %s: %s", city.slug, error.code)
    return _status(store, city, live, run)


# ---------------------------------------------------------------------------
# The pack itself
# ---------------------------------------------------------------------------

# A ready pack never changes, so each warm Lambda keeps the last few it served.
_pack_cache: "OrderedDict[str, LocalPack]" = OrderedDict()
_cache_lock = threading.Lock()


def clear_cache() -> None:
    with _cache_lock:
        _pack_cache.clear()


def local_pack(store: PackStore, city: City) -> LocalPack:
    live = store.get_live_pack(city.slug)
    if live is None:
        raise ApiError(404, "pack_not_ready", f"Your {city.name} pack isn't ready yet.")
    with _cache_lock:
        cached = _pack_cache.get(live.id)
        if cached is not None:
            _pack_cache.move_to_end(live.id)
            return cached

    encounters, unit_notes, quizzes = [], [], []
    for item in store.get_content(live.id):
        if item.kind == "encounter":
            try:
                # Only the public fields: scene details, outline and voice stay on the server.
                encounters.append(ScenarioDefinition.model_validate(item.payload).public())
            except ValidationError:
                logger.warning("Skipping invalid encounter %s in pack %s", item.ref, live.id)
        elif item.kind == "unit_notes":
            unit_notes.append(item.payload)
        elif item.kind == "quiz":
            quizzes.append(item.payload)

    titles: dict[str, str] = {}
    for fact in store.get_facts(live.id):
        if not titles.get(fact.source_url):
            titles[fact.source_url] = fact.source_title
    sources = sorted(
        (Source(url=url, title=title or url) for url, title in titles.items()), key=lambda source: source.title.lower()
    )

    pack = LocalPack(
        id=live.id,
        city=city.slug,
        built_at=live.finished_at or live.created_at,
        encounters=encounters,
        unit_notes=unit_notes,
        quizzes=quizzes,
        sources=sources,
    )
    with _cache_lock:
        _pack_cache[live.id] = pack
        while len(_pack_cache) > CACHED_PACKS:
            _pack_cache.popitem(last=False)
    return pack
