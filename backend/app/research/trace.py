"""The pack's trace: what the agent is doing in short readable steps, plus tokens, searches, time and cost.

The app shows the steps live (issue #38), so they're written for a learner to read. Never put
prompts, page text or stack traces in them.
"""

import logging
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any

from app.locations.models import PackStage
from app.locations.store import PackStore, StoreError

logger = logging.getLogger("lingvoyage.research")

MAX_STEPS = 200
MAX_TEXT = 160
FLUSH_EVERY_SECONDS = 3.0
SEARCH_USD = 10 / 1000  # web search: $10 per 1,000

# List prices in USD per million tokens, for the cost estimate only (check the pricing page when they
# change). Cache writes are the 5-minute cache, 1.25x input. Unknown models are priced like Opus.
PRICES: dict[str, dict[str, float]] = {
    "claude-opus-5-5": {"input": 4.00, "output": 20.00, "cache_read": 0.20, "cache_write": 5.00},
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00, "cache_read": 0.20, "cache_write": 2.50},
    "claude-haiku-5-5": {"input": 0.10, "output": 0.50, "cache_read": 0.01, "cache_write": 0.125},
}
_TOKEN_FIELDS = ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")


class Trace:
    def __init__(
        self,
        store: PackStore,
        pack_id: str,
        on_step: Callable[[dict[str, Any]], None] | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._store = store
        self._pack_id = pack_id
        self._on_step = on_step
        self._clock = clock
        self._lock = threading.Lock()  # workers add steps from parallel threads
        self._flush_lock = threading.Lock()  # one save at a time, so an older snapshot never lands last
        self._steps: list[dict[str, Any]] = []
        self._models: dict[str, dict[str, int]] = {}
        self._searches = 0
        self._fetches = 0
        self._seconds: dict[str, float] = {}
        self._last_flush = clock()
        self._dirty = False

    @property
    def steps(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._steps)

    def step(self, stage: str, kind: str, text: str, worker: str | None = None, url: str | None = None) -> None:
        entry: dict[str, Any] = {
            "t": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "stage": stage,
            "kind": kind,
            "text": " ".join(text.split())[:MAX_TEXT],
        }
        if worker:
            entry["worker"] = worker
        if url:
            entry["url"] = url
        with self._lock:
            self._steps.append(entry)
            del self._steps[:-MAX_STEPS]
            self._dirty = True
        if self._on_step:
            self._on_step(entry)
        self.flush()

    @contextmanager
    def stage(self, stage: PackStage, text: str) -> Iterator[None]:
        started = self._clock()
        try:
            self._store.set_stage(self._pack_id, stage)
        except StoreError:
            logger.warning("Couldn't save stage %s for pack %s", stage, self._pack_id)
        self.step(stage, "stage", text)
        try:
            yield
        finally:
            with self._lock:
                self._seconds[stage] = round(self._clock() - started, 1)
                self._dirty = True

    def add_usage(self, model: str, usage: Any) -> int:
        """Adds one response's usage. Returns the web searches it ran."""
        server = getattr(usage, "server_tool_use", None)
        searches = (getattr(server, "web_search_requests", 0) or 0) if server else 0
        fetches = (getattr(server, "web_fetch_requests", 0) or 0) if server else 0
        with self._lock:
            totals = self._models.setdefault(model, {"requests": 0, **dict.fromkeys(_TOKEN_FIELDS, 0)})
            totals["requests"] += 1
            for field in _TOKEN_FIELDS:
                totals[field] += getattr(usage, field, 0) or 0
            self._searches += searches
            self._fetches += fetches
            self._dirty = True
        return searches

    def usage(self) -> dict[str, Any]:
        with self._lock:
            return self._usage_locked()

    def _usage_locked(self) -> dict[str, Any]:
        cost = self._searches * SEARCH_USD
        for model, totals in self._models.items():
            price = PRICES.get(model, PRICES["claude-opus-5-5"])
            cost += (
                totals["input_tokens"] * price["input"]
                + totals["output_tokens"] * price["output"]
                + totals["cache_read_input_tokens"] * price["cache_read"]
                + totals["cache_creation_input_tokens"] * price["cache_write"]
            ) / 1_000_000
        return {
            "models": {model: dict(totals) for model, totals in self._models.items()},
            "web_search_requests": self._searches,
            "web_fetch_requests": self._fetches,
            "seconds": dict(self._seconds),
            "cost_usd_estimate": round(cost, 2),
        }

    def flush(self, force: bool = False) -> None:
        """Saves the steps and usage to the pack, at most every few seconds unless forced."""
        if not self._flush_lock.acquire(blocking=force):
            return  # another thread is saving right now
        try:
            with self._lock:
                due = self._clock() - self._last_flush >= FLUSH_EVERY_SECONDS
                if not self._dirty or not (force or due):
                    return
                steps, usage = list(self._steps), self._usage_locked()
                self._last_flush, self._dirty = self._clock(), False
            try:
                self._store.save_trace(self._pack_id, steps, usage)
            except StoreError:
                logger.warning("Couldn't save the trace for pack %s", self._pack_id)
        finally:
            self._flush_lock.release()
