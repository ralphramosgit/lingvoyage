"""Stages 2 and 3: a research worker is one agent loop over one brief.

Claude searches and reads (server tools that Anthropic runs), saves facts with our record_* tools,
and calls finish. We run the record tools and send back their results. The loop stops at finish,
at a cap (requests, time, searches), or on an error, and whatever was saved by then is kept.

The history is only ever appended to (never edited), as the API requires for thinking blocks.
"""

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

import anthropic

from app.locations.cities import City
from app.locations.models import FactDraft
from app.research import prompts
from app.research.briefs import Brief
from app.research.claude import stream_message
from app.research.tools import ToolBox, domain_of
from app.research.trace import Trace

logger = logging.getLogger("lingvoyage.research")

MAX_PARALLEL_WORKERS = 4
MAX_PAGE_TOKENS = 20_000  # one fetched page; keeps a long page from filling the context


@dataclass
class WorkerResult:
    brief: Brief
    facts: list[FactDraft]
    summary: str = ""
    gaps: list[str] = field(default_factory=list)
    stopped: str = ""  # why the loop ended: finished, end_turn, max_iterations, time_limit, search_budget, error, ...
    error: str | None = None  # a short code when Claude couldn't be reached


def web_tools(brief: Brief, city: City) -> list[dict[str, Any]]:
    location = {"type": "approximate", "city": city.name, "country": "CN", "timezone": "Asia/Shanghai"}
    if city.province:
        location["region"] = city.province
    return [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": brief.max_searches, "user_location": location},
        {
            "type": "web_fetch_20260209",
            "name": "web_fetch",
            "max_uses": brief.max_fetches,
            "max_content_tokens": MAX_PAGE_TOKENS,
        },
    ]


def _error_code(error: anthropic.APIError) -> str:
    if isinstance(error, anthropic.AuthenticationError):
        return "claude_auth"
    if isinstance(error, anthropic.NotFoundError):
        return "claude_model_not_found"
    if isinstance(error, anthropic.RateLimitError):
        return "claude_rate_limited"
    if isinstance(error, anthropic.BadRequestError):
        return "claude_bad_request"
    return "claude_unavailable"


def run_worker(
    client: anthropic.Anthropic,
    brief: Brief,
    city: City,
    trace: Trace,
    stage: str,
    *,
    model: str,
    effort: str,
    clock: Callable[[], float] = time.monotonic,
) -> WorkerResult:
    toolbox = ToolBox(brief, trace, stage)
    # Our tools are small and checked by strict mode, so they're not streamed early (no eager_input_streaming).
    tools = [*web_tools(brief, city), *toolbox.definitions()]
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompts.brief_message(brief, city)}]
    traced: set[str] = set()

    def on_block(block: Any) -> None:
        if getattr(block, "type", "") != "server_tool_use" or block.id in traced:
            return
        traced.add(block.id)
        if block.name == "web_search":
            trace.step(stage, "search", str(block.input.get("query", "")), worker=brief.worker)
        elif block.name == "web_fetch":
            url = str(block.input.get("url", ""))
            trace.step(stage, "read", f"Reading {domain_of(url) or url}", worker=brief.worker, url=url)

    started = clock()
    searches = 0
    stopped = "max_iterations"
    error: str | None = None
    try:
        for _ in range(brief.max_iterations):
            if clock() - started > brief.time_limit_seconds:
                stopped = "time_limit"
                break
            response = stream_message(
                client,
                model=model,
                system=prompts.RESEARCH_SYSTEM,
                tools=tools,
                messages=messages,
                effort=effort,
                on_block=on_block,
            )
            searches += trace.add_usage(response.model, response.usage)
            for block in response.content:
                toolbox.see(block)
                on_block(block)  # anything the stream didn't report
            messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "pause_turn":
                continue  # the server paused its search loop; sending the turn back resumes it
            results = [toolbox.run(block) for block in response.content if block.type == "tool_use"]
            if response.stop_reason != "tool_use" or not results:
                stopped = response.stop_reason or "end_turn"
                break
            if toolbox.finished is not None:
                stopped = "finished"
                break
            if searches >= brief.max_searches * 2:
                stopped = "search_budget"
                break
            content: list[dict[str, Any]] = list(results)
            if searches >= brief.max_searches:
                content.append({"type": "text", "text": prompts.BUDGET_NOTE})
            messages.append({"role": "user", "content": content})
    except anthropic.APIError as caught:
        error = _error_code(caught)
        stopped = "error"
        logger.warning("Research worker %s stopped: %s %s", brief.worker, type(caught).__name__, caught.message)

    summary = toolbox.finished.summary if toolbox.finished else ""
    gaps = list(toolbox.finished.gaps) if toolbox.finished else []
    count = len(toolbox.facts)
    if error:
        trace.step(stage, "error", f"Stopped early after {count} facts: couldn't reach Claude", worker=brief.worker)
    else:
        trace.step(stage, "done", f"{summary or 'Done'} ({count} facts)", worker=brief.worker)
    return WorkerResult(brief, toolbox.facts, summary, gaps, stopped, error)


def run_workers(
    client: anthropic.Anthropic,
    briefs: list[Brief],
    city: City,
    trace: Trace,
    stage: str,
    *,
    model: str,
    effort: str,
) -> list[WorkerResult]:
    """Runs the briefs in parallel. A worker that crashes doesn't stop the others."""
    if not briefs:
        return []
    with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL_WORKERS, len(briefs))) as pool:
        futures = [
            pool.submit(run_worker, client, brief, city, trace, stage, model=model, effort=effort) for brief in briefs
        ]
        results = []
        for brief, future in zip(briefs, futures, strict=True):
            try:
                results.append(future.result())
            except Exception:
                logger.exception("Research worker %s crashed", brief.worker)
                trace.step(stage, "error", "Stopped early: something went wrong", worker=brief.worker)
                results.append(WorkerResult(brief, [], stopped="error", error="worker_crashed"))
    return results
