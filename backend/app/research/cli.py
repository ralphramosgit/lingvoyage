"""Build a city's local pack from the command line, and print what it found and what it cost.

Run from backend/ with the virtual environment active:

    python -m app.research.cli chengdu --quick --dry-run   # cheap first check (well under $1), nothing saved
    python -m app.research.cli chengdu                 # full run, saved to Supabase
    python -m app.research.cli chengdu --dry-run       # nothing saved: facts printed as JSON at the end
    python -m app.research.cli chengdu --topics food   # one worker, for tuning its prompt

Every run makes real Claude API calls with web search. A full run costs a few dollars; the report
at the end says how much.
"""

import argparse
import json
import logging
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from app.locations.cities import CITIES, find_city
from app.locations.store import InMemoryPackStore, PackStore, RunAlreadyActive, get_store
from app.research.briefs import TOPICS
from app.research.pipeline import PackReport, run_pack


def print_step(step: dict[str, Any]) -> None:
    clock = datetime.fromisoformat(step["t"].replace("Z", "+00:00")).astimezone().strftime("%H:%M:%S")
    worker = step.get("worker", "")
    print(f"{clock}  {step['stage']:<9} {worker:<24} {step['kind']:<6} {step['text']}", flush=True)


def print_report(report: PackReport) -> None:
    facts = report.facts
    usage = report.usage
    print(f"\n{report.city.name} pack: {report.status}" + (f" ({report.error})" if report.error else ""))
    print(f"Pack id: {report.pack_id}")

    by_category = Counter(fact.category for fact in facts)
    by_confidence = Counter(fact.confidence for fact in facts)
    print(f"Facts: {len(facts)} (high {by_confidence['high']}, medium {by_confidence['medium']}, low {by_confidence['low']})")
    if facts:
        print("  " + " · ".join(f"{category} {count}" for category, count in sorted(by_category.items())))
    priced = {fact.place_key for fact in facts if fact.category == "menu_item" and fact.data.get("price_cny") is not None}
    restaurants = [fact for fact in facts if fact.category == "restaurant"]
    with_prices = sum(1 for fact in restaurants if fact.place_key in priced)
    print(f"Restaurants: {len(restaurants)} ({with_prices} with menu prices)")
    print(f"Sources: {len({fact.source_url for fact in facts})}")

    print("Workers:")
    for result in report.workers:
        line = f"  {result.brief.worker:<24} {result.stopped:<14} {len(result.facts):>3} facts"
        if result.error:
            line += f"  error: {result.error}"
        print(line)
        if result.summary:
            print(f"      {result.summary}")
        if result.gaps:
            print(f"      couldn't find: {'; '.join(result.gaps)}")

    print(f"Web: {usage.get('web_search_requests', 0)} searches, {usage.get('web_fetch_requests', 0)} page reads")
    for model, totals in usage.get("models", {}).items():
        print(
            f"  {model:<20} {totals['requests']:>3} requests  in {totals['input_tokens']:,}  "
            f"out {totals['output_tokens']:,}  cache read {totals['cache_read_input_tokens']:,}  "
            f"cache write {totals['cache_creation_input_tokens']:,}"
        )
    seconds = usage.get("seconds", {})
    if seconds:
        print("Seconds: " + " · ".join(f"{stage} {value}" for stage, value in seconds.items()))
    print(f"Estimated cost: ${usage.get('cost_usd_estimate', 0):.2f}")


def facts_json(report: PackReport) -> str:
    body = {
        "city": report.city.slug,
        "status": report.status,
        "usage": report.usage,
        "facts": [fact.model_dump() for fact in report.facts],
    }
    return json.dumps(body, ensure_ascii=False, indent=2)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.research.cli", description="Build a city's local pack.")
    parser.add_argument("city", help="a city slug: " + ", ".join(city.slug for city in CITIES))
    parser.add_argument("--topics", help=f"comma-separated, from: {', '.join(TOPICS)} (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="don't save anything; print the facts as JSON")
    parser.add_argument("--no-deep-dive", action="store_true", help="skip reading restaurant menus")
    parser.add_argument(
        "--quick", action="store_true", help="one small worker (transport unless --topics), no menus: a cheap check"
    )
    parser.add_argument("--json", metavar="FILE", help="also write the facts and usage to this file")
    args = parser.parse_args(argv)

    # The Windows console may not be UTF-8; never crash on Chinese.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

    if find_city(args.city) is None:
        print(f"Unknown city {args.city!r}. Use one of: {', '.join(city.slug for city in CITIES)}")
        return 2
    topics = [topic.strip() for topic in args.topics.split(",")] if args.topics else None
    unknown = [topic for topic in topics or [] if topic not in TOPICS]
    if unknown:
        print(f"Unknown topic(s) {', '.join(unknown)}. Use: {', '.join(TOPICS)}")
        return 2

    store: PackStore = InMemoryPackStore() if args.dry_run else get_store()
    print(f"Building the {args.city} pack{' (dry run, nothing saved)' if args.dry_run else ''}. This takes a few minutes.\n")
    try:
        report = run_pack(
            args.city, store, topics=topics, deep_dive=not args.no_deep_dive, quick=args.quick, on_step=print_step
        )
    except RunAlreadyActive:
        print(
            f"A {args.city} pack is already being built. If an earlier run crashed, mark it failed in the Supabase "
            f"SQL Editor: update public.location_packs set status = 'failed', error = 'abandoned' "
            f"where city = '{args.city}' and status in ('queued', 'running');"
        )
        return 1

    print_report(report)
    if args.json:
        Path(args.json).write_text(facts_json(report), encoding="utf-8")
        print(f"Wrote {args.json}")
    elif args.dry_run:
        print("\n" + facts_json(report))
    return 0 if report.status == "ready" else 1


if __name__ == "__main__":
    sys.exit(main())
