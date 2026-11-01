"""Write local encounters for a city that's already researched, and show what they cost.

Run from backend/ with the virtual environment active:

    python -m app.content.cli chengdu --list                  # the scenes it would write: free, no Claude calls
    python -m app.content.cli chengdu --limit 1 --dry-run     # write one scene and print it, save nothing
    python -m app.content.cli chengdu --only chen-mapo-tofu   # write one scene into the city's live pack
    python -m app.content.cli chengdu                         # write them all (up to 6) into the live pack

It uses the facts already in Supabase, so there's no research run. Each scene is a real Claude call
(ANTHROPIC_GENERATOR_MODEL); the report at the end says what it cost.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

from app.config import get_settings
from app.content.encounters import generate_encounters, plan_encounters
from app.locations.cities import CITIES, find_city
from app.locations.store import InMemoryPackStore, get_store
from app.research.claude import get_client
from app.research.cli import print_step
from app.research.trace import Trace


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.content.cli", description="Write local encounters for a city.")
    parser.add_argument("city", help="a city slug: " + ", ".join(city.slug for city in CITIES))
    parser.add_argument("--list", action="store_true", help="only show the scenes it would write (free)")
    parser.add_argument("--only", metavar="PLACE_KEY", help="write just this scene (see --list)")
    parser.add_argument("--limit", type=int, help="write at most this many scenes")
    parser.add_argument("--dry-run", action="store_true", help="don't save anything; print the first scene")
    parser.add_argument("--json", metavar="FILE", help="also write the scenes to this file")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

    city = find_city(args.city)
    if city is None:
        print(f"Unknown city {args.city!r}. Use one of: {', '.join(city.slug for city in CITIES)}")
        return 2
    store = get_store()
    pack = store.get_live_pack(city.slug)
    if pack is None:
        print(f"{city.name} has no ready pack yet. Research it first: python -m app.research.cli {city.slug}")
        return 1
    facts = store.get_facts(pack.id)
    plans = plan_encounters(city, facts)
    if args.only:
        plans = [plan for plan in plans if plan.place_key == args.only]
        if not plans:
            print(f"No scene called {args.only!r}. Run with --list to see them.")
            return 2
    if args.limit:
        plans = plans[: args.limit]

    print(f"{city.name} pack {pack.id}: {len(facts)} facts. Scenes:")
    for plan in plans:
        print(f"  {plan.place_key:<32} {plan.kind:<15} {plan.place}  ({len(plan.facts)} facts)")
    if args.list or not plans:
        return 0

    # The steps go to the screen only: the pack's own trace (the research) stays as it is.
    scratch = InMemoryPackStore()
    trace = Trace(scratch, scratch.create_pack(city.slug).id, on_step=print_step)
    settings = get_settings()
    print(f"\nWriting with {settings.anthropic_generator_model}{' (dry run, nothing saved)' if args.dry_run else ''}.\n")
    written = generate_encounters(
        get_client(),
        None if args.dry_run else store,
        pack.id,
        city,
        facts,
        trace,
        model=settings.anthropic_generator_model,
        effort=settings.anthropic_generator_effort,
        plans=plans,
    )

    print(f"\nWrote {len(written)} of {len(plans)} scenes:")
    for scenario in written:
        print(
            f"  {scenario.id}: {scenario.title} · {len(scenario.goals)} goals · {len(scenario.key_phrases)} key phrases"
            f" · {len(scenario.lessons)} lessons · {len(scenario.sources)} sources"
        )
    usage = trace.usage()
    for model, totals in usage["models"].items():
        print(
            f"  {model}: {totals['requests']} requests, in {totals['input_tokens']:,}, out {totals['output_tokens']:,}, "
            f"cache read {totals['cache_read_input_tokens']:,}, cache write {totals['cache_creation_input_tokens']:,}"
        )
    print(f"Estimated cost: ${usage['cost_usd_estimate']:.2f}")

    if args.json:
        Path(args.json).write_text(
            json.dumps([scenario.model_dump() for scenario in written], ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Wrote {args.json}")
    elif args.dry_run and written:
        print("\n" + json.dumps(written[0].model_dump(exclude={"local"}), ensure_ascii=False, indent=2))
    if written and not args.dry_run:
        print(f"Saved into the {city.name} pack. The API picks them up within 10 minutes.")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
