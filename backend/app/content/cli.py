"""Write a researched city's content (scenes, local notes, quizzes), and show what it costs.

Run from backend/ with the virtual environment active:

    python -m app.content.cli chengdu --list                        # what it would write, and what's saved: free
    python -m app.content.cli chengdu --course                      # write the local notes and quizzes not saved yet
    python -m app.content.cli chengdu --only unit:getting-around --dry-run   # one piece, printed, nothing saved
    python -m app.content.cli chengdu --scenes --only scene:chen-mapo-tofu   # one scene, into the live pack
    python -m app.content.cli chengdu                               # everything that isn't saved yet

It uses the facts already in Supabase, so there's no research run. Pieces already in the pack are
skipped, so you don't pay twice; --rewrite writes them again. Each piece is a real Claude call
(ANTHROPIC_GENERATOR_MODEL); the report at the end says what it cost.
"""

import argparse
import json
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.content.course import CoursePlan, generate_course, plan_course
from app.content.encounters import EncounterPlan, generate_encounters, plan_encounters
from app.locations.cities import CITIES, find_city
from app.locations.store import InMemoryPackStore, get_store
from app.research.claude import get_client
from app.research.cli import print_step
from app.research.trace import Trace


@dataclass(frozen=True)
class Piece:
    key: str  # what --only takes: scene:<place>, unit:<unit id> or quiz:<topic>
    ref: str  # what it's saved under in the pack
    label: str
    facts: int
    plan: EncounterPlan | CoursePlan


def pieces(city_slug: str, plans: list[EncounterPlan], course: list[CoursePlan]) -> list[Piece]:
    found = [
        Piece(f"scene:{plan.place_key}", f"local-{city_slug}-{plan.place_key}", plan.place, len(plan.facts), plan)
        for plan in plans
    ]
    for plan in course:
        lesson = " + practice lesson" if plan.lesson else ""
        found.append(Piece(f"{plan.kind}:{plan.key}", plan.ref, f"{plan.title}{lesson}", len(plan.facts), plan))
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.content.cli", description="Write a city's local content.")
    parser.add_argument("city", help="a city slug: " + ", ".join(city.slug for city in CITIES))
    parser.add_argument("--list", action="store_true", help="only show what it would write, and what's saved (free)")
    parser.add_argument("--scenes", action="store_true", help="only the encounters")
    parser.add_argument("--course", action="store_true", help="only the local notes, practice lessons and quizzes")
    parser.add_argument("--only", metavar="KEY", help="just this piece, e.g. scene:chen-mapo-tofu, unit:food, quiz:transport")
    parser.add_argument("--limit", type=int, help="write at most this many pieces")
    parser.add_argument("--rewrite", action="store_true", help="write pieces again even if they're saved")
    parser.add_argument("--dry-run", action="store_true", help="don't save anything; print the first piece")
    parser.add_argument("--json", metavar="FILE", help="also write the pieces to this file")
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
    both = not args.scenes and not args.course
    todo = pieces(
        city.slug,
        plan_encounters(city, facts) if args.scenes or both else [],
        plan_course(city, facts) if args.course or both else [],
    )
    saved = {item.ref for item in store.get_content(pack.id)}

    print(f"{city.name} pack {pack.id}: {len(facts)} facts.")
    for piece in todo:
        status = "saved" if piece.ref in saved else "to write"
        print(f"  {piece.key:<38} {status:<9} {piece.label}  ({piece.facts} facts)")

    if args.only:
        todo = [piece for piece in todo if piece.key == args.only]
        if not todo:
            print(f"Nothing called {args.only!r}. Run with --list to see the keys.")
            return 2
    elif not args.rewrite:
        todo = [piece for piece in todo if piece.ref not in saved]
    if args.limit:
        todo = todo[: args.limit]
    if args.list:
        return 0
    if not todo:
        print("\nEverything is already saved. Use --rewrite to write it again.")
        return 0

    # The steps go to the screen only: the pack's own trace (the research) stays as it is.
    scratch = InMemoryPackStore()
    trace = Trace(scratch, scratch.create_pack(city.slug).id, on_step=print_step)
    settings = get_settings()
    target = None if args.dry_run else store
    options: dict[str, Any] = {"model": settings.anthropic_generator_model, "effort": settings.anthropic_generator_effort}
    print(f"\nWriting {len(todo)} pieces with {options['model']}{' (dry run, nothing saved)' if args.dry_run else ''}.\n")
    client = get_client()
    scene_plans = [piece.plan for piece in todo if isinstance(piece.plan, EncounterPlan)]
    course_plans = [piece.plan for piece in todo if isinstance(piece.plan, CoursePlan)]
    written: list[Any] = []
    if scene_plans:
        written += generate_encounters(client, target, pack.id, city, facts, trace, plans=scene_plans, **options)
    if course_plans:
        written += generate_course(client, target, pack.id, city, facts, trace, plans=course_plans, **options)

    print(f"\nWrote {len(written)} of {len(todo)} pieces.")
    usage = trace.usage()
    for model, totals in usage["models"].items():
        print(
            f"  {model}: {totals['requests']} requests, in {totals['input_tokens']:,}, out {totals['output_tokens']:,}, "
            f"cache read {totals['cache_read_input_tokens']:,}, cache write {totals['cache_creation_input_tokens']:,}"
        )
    print(f"Estimated cost: ${usage['cost_usd_estimate']:.2f}")

    if args.json:
        Path(args.json).write_text(
            json.dumps([item.model_dump(exclude={"local"}) for item in written], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"Wrote {args.json}")
    elif args.dry_run and written:
        print("\n" + json.dumps(written[0].model_dump(exclude={"local"}), ensure_ascii=False, indent=2))
    if written and not args.dry_run:
        print(f"Saved into the {city.name} pack. The API picks them up within 10 minutes.")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
