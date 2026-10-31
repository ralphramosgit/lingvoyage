"""A city's local pack, stage by stage: plan, research, menu deep dive, verify, publish.

The content stage (issues #35 and #36) goes between verify and publish. Until then a ready pack
holds the checked facts only.
"""

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field, replace
from typing import Any

import anthropic

from app.config import get_settings
from app.errors import ApiError
from app.locations.cities import City, find_city
from app.locations.models import FactDraft
from app.locations.store import PackStore, StoreError
from app.research import workers
from app.research.briefs import menu_brief, plan_briefs
from app.research.claude import get_client
from app.research.trace import Trace
from app.research.verify import verify
from app.research.workers import WorkerResult

logger = logging.getLogger("lingvoyage.research")

DEEP_DIVE_RESTAURANTS = 4
# --quick on the command line: one small worker, to check the setup or try a prompt change cheaply.
QUICK_LIMITS = {"max_iterations": 3, "max_searches": 2, "max_fetches": 1, "time_limit_seconds": 90.0}
_CONFIDENCE_RANK = {"high": 2, "medium": 1, "low": 0}


@dataclass
class PackReport:
    city: City
    pack_id: str
    status: str  # "ready" or "failed"
    error: str | None = None
    facts: list[FactDraft] = field(default_factory=list)
    workers: list[WorkerResult] = field(default_factory=list)
    usage: dict[str, Any] = field(default_factory=dict)


def pick_restaurants(facts: list[FactDraft], limit: int) -> list[FactDraft]:
    """The best-documented restaurants, for the menu deep dive."""
    restaurants = {fact.place_key: fact for fact in facts if fact.category == "restaurant"}

    def score(fact: FactDraft) -> tuple[bool, bool, int, int]:
        data = fact.data
        return (
            bool(data.get("name_hanzi")),
            data.get("price_per_person_cny") is not None,
            len(data.get("known_for", [])),
            _CONFIDENCE_RANK[fact.confidence],
        )

    return sorted(restaurants.values(), key=score, reverse=True)[:limit]


def run_pack(
    city_slug: str,
    store: PackStore,
    *,
    client: anthropic.Anthropic | None = None,
    pack_id: str | None = None,
    requested_by: str | None = None,
    topics: Iterable[str] | None = None,
    deep_dive: bool = True,
    quick: bool = False,
    on_step: Callable[[dict[str, Any]], None] | None = None,
) -> PackReport:
    """Builds the pack. Pass `pack_id` to fill a pack that's already queued (the worker Lambda, #34);
    otherwise a new one is created. Never raises once the pack exists: failures mark it failed."""
    city = find_city(city_slug)
    if city is None:
        raise ValueError(f"Unknown city {city_slug!r}.")
    pack = store.get_pack(pack_id) if pack_id else store.create_pack(city.slug, requested_by)
    if pack is None:
        raise ValueError(f"No pack {pack_id}.")

    settings = get_settings()
    trace = Trace(store, pack.id, on_step=on_step)
    report = PackReport(city=city, pack_id=pack.id, status="failed")
    try:
        client = client or get_client()
        model, effort = settings.anthropic_research_model, settings.anthropic_research_effort

        with trace.stage("plan", f"Planning the research for {city.name}"):
            briefs = plan_briefs(city, topics or (["transport"] if quick else None))
            if quick:
                briefs, deep_dive = [replace(brief, **QUICK_LIMITS) for brief in briefs], False

        with trace.stage("research", f"Researching {city.name} with {len(briefs)} agents at once"):
            report.workers = workers.run_workers(client, briefs, city, trace, "research", model=model, effort=effort)
        found = [fact for result in report.workers for fact in result.facts]
        if not found:
            return _fail(store, trace, report, "research_failed", "The research didn't find anything")

        restaurants = pick_restaurants(found, DEEP_DIVE_RESTAURANTS) if deep_dive else []
        if restaurants:
            with trace.stage("deep_dive", f"Reading the menus at {len(restaurants)} restaurants"):
                menu_briefs = [menu_brief(city, fact) for fact in restaurants]
                menus = workers.run_workers(client, menu_briefs, city, trace, "deep_dive", model=model, effort=effort)
            report.workers += menus
            found += [fact for result in menus for fact in result.facts]

        with trace.stage("verify", f"Checking {len(found)} facts"):
            report.facts = verify(client, settings.anthropic_verifier_model, city, found, trace)

        with trace.stage("publish", f"Saving {len(report.facts)} facts"):
            store.insert_facts(pack.id, report.facts)
            store.finish_pack(pack.id)
        sources = len({fact.source_url for fact in report.facts})
        trace.step("publish", "done", f"Your {city.name} pack is ready: {len(report.facts)} facts from {sources} sources")
        report.status = "ready"
    except ApiError as error:
        logger.error("Pack for %s failed: %s", city.slug, error.message)
        return _fail(store, trace, report, error.code, error.message)
    except Exception:
        logger.exception("Pack for %s failed", city.slug)
        return _fail(store, trace, report, "internal_error", "Something went wrong")
    finally:
        report.usage = trace.usage()
        trace.flush(force=True)
    return report


def _fail(store: PackStore, trace: Trace, report: PackReport, code: str, text: str) -> PackReport:
    trace.step("publish", "error", f"{text}. Nothing was published.")
    try:
        store.fail_pack(report.pack_id, code)
    except StoreError:
        logger.warning("Couldn't mark pack %s failed", report.pack_id)
    report.status, report.error = "failed", code
    return report
