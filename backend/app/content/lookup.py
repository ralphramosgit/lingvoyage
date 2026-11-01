"""Local encounters by id, so the conversation routes play them like the built-in scenes.

A local encounter's id is local-<city>-<place_key> (an area's, #44: local-<city>-<area>-<place_key>).
It lives in the city's live pack, which any signed-in learner may play: packs are shared per city.
Each warm Lambda keeps a city's encounters for 10 minutes.
"""

import threading
import time

from pydantic import ValidationError

from app.locations.cities import find_city
from app.locations.store import get_store
from app.scenarios import ScenarioDefinition

CACHE_SECONDS = 600

_cache: dict[str, tuple[float, dict[str, ScenarioDefinition]]] = {}
_cache_lock = threading.Lock()


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


def _city_encounters(city: str) -> dict[str, ScenarioDefinition]:
    with _cache_lock:
        cached = _cache.get(city)
        if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
            return cached[1]
    store = get_store()
    pack = store.get_live_pack(city)
    encounters: dict[str, ScenarioDefinition] = {}
    if pack is not None:
        for item in store.get_content(pack.id, "encounter"):
            try:
                encounters[item.ref] = ScenarioDefinition.model_validate(item.payload)
            except ValidationError:
                continue
    with _cache_lock:
        _cache[city] = (time.monotonic(), encounters)
    return encounters


def find_local_scenario(scenario_id: str) -> ScenarioDefinition | None:
    parts = scenario_id.split("-")
    if len(parts) < 3 or parts[0] != "local" or find_city(parts[1]) is None:
        return None
    return _city_encounters(parts[1]).get(scenario_id)
