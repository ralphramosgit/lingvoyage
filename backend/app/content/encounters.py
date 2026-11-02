"""The content agent for encounters (issue #35): scenes at real places, from a city's facts.

Code plans the scenes from the facts, then each one is written by the evaluator–optimizer loop in
drafts.py: Claude writes a draft, code checks it, and the problems go back to be fixed (up to 3
tries). A finished scene is a ScenarioDefinition, the same model as the hand-written scenes, so the
tutor, voices, captions and practice lessons play it unchanged.
"""

import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Literal

import anthropic
import pydantic
from pydantic import BaseModel, Field

from app.content import checks, prompts
from app.content.drafts import (
    DraftLesson,
    DraftPhrase,
    clean,
    lesson_body,
    validation_problems,
    write_checked,
)
from app.locations.cities import City
from app.locations.models import ContentItem, Fact
from app.locations.store import PackStore
from app.research.trace import Trace
from app.scenarios import LocalRef, ScenarioDefinition, Source
from app.tutor import asks_travelers_question

MAX_SCENES = 6
MAX_PARALLEL = 3
MAX_LINE = 30  # Chinese characters in one stretch of the character's speech ("at most about 25")
MAX_SOURCES = 8
_SNAKE_RE = re.compile(r"^[a-z][a-z0-9_]*$")

Icon = Literal["PlaneLanding", "BedDouble", "UtensilsCrossed", "TrainFront", "ShoppingBag", "CarTaxiFront", "Landmark"]
Voice = Literal["ELEVENLABS_VOICE_ID_RESTAURANT", "ELEVENLABS_VOICE_ID_TRAIN", "ELEVENLABS_VOICE_ID_HOTEL"]
Kind = Literal["airport", "getting_around", "restaurant", "hot_spot"]

# ---------------------------------------------------------------------------
# The draft: what Claude writes (plain types, checked afterwards)
# ---------------------------------------------------------------------------


class DraftCharacter(BaseModel):
    name_hanzi: str
    name_pinyin: str
    name_english: str
    role: str = Field(description='In English, e.g. "Waiter".')
    avatar_char: str = Field(description="One character from the name.")


class DraftGoal(BaseModel):
    id: str = Field(description="Unique snake_case.")
    label: str = Field(description="Something the traveler says or does.")


class EncounterDraft(BaseModel):
    title: str
    subtitle: str
    setting: str
    minutes: int
    icon: Icon
    character: DraftCharacter
    goals: list[DraftGoal]
    key_phrases: list[DraftPhrase]
    scene_details: str
    scene_outline: list[str]
    lessons: list[DraftLesson]
    voice_env: Voice | None


# ---------------------------------------------------------------------------
# Planning (code, no model): which scenes a city's facts can carry
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EncounterPlan:
    place_key: str  # part of the scene's id, stable across refreshes
    kind: Kind
    template: str  # the hand-written scene it follows
    place: str  # "Chen Mapo Tofu (陈麻婆豆腐)"
    facts: tuple[Fact, ...]


def _name(fact: Fact) -> str:
    name = fact.data.get("name") or fact.title
    hanzi = fact.data.get("name_hanzi") or fact.hanzi
    return f"{name} ({hanzi})" if hanzi else name


def _is_airport(fact: Fact) -> bool:
    text = f"{fact.title} {fact.data.get('origin') or ''} {fact.data.get('destination') or ''}".lower()
    return fact.data.get("mode") == "airport_link" or "airport" in text or "机场" in fact.hanzi


def plan_encounters(city: City, facts: list[Fact], limit: int = MAX_SCENES) -> list[EncounterPlan]:
    """The airport, getting around, the restaurants with the best menus, and one sight, as far as the facts go."""
    transport = [fact for fact in facts if fact.category == "transport"]
    airport = [fact for fact in transport if _is_airport(fact)]
    around = [
        fact for fact in transport if not _is_airport(fact) and fact.data.get("mode") in ("metro", "taxi", "didi", "bus")
    ]
    menus: dict[str, list[Fact]] = defaultdict(list)
    for fact in facts:
        if fact.category == "menu_item" and fact.place_key:
            menus[fact.place_key].append(fact)

    plans: list[EncounterPlan] = []
    if airport:
        named = next((fact.data.get("origin") for fact in airport if "airport" in str(fact.data.get("origin", "")).lower()), None)
        place = named or f"{city.name}'s airport"
        plans.append(EncounterPlan("airport", "airport", "airport", place, tuple(airport[:8])))
    if len(around) >= 2:
        plans.append(EncounterPlan("getting-around", "getting_around", "train", city.name, tuple(around[:8])))

    def menu_score(restaurant: Fact) -> tuple[int, int]:
        dishes = menus[restaurant.place_key or ""]
        return sum(dish.data.get("price_cny") is not None for dish in dishes), len(dishes)

    restaurants = [
        fact for fact in facts if fact.category == "restaurant" and fact.place_key and len(menus[fact.place_key]) >= 2
    ]
    for restaurant in sorted(restaurants, key=menu_score, reverse=True)[:3]:
        dishes = menus[restaurant.place_key or ""][:12]
        plans.append(EncounterPlan(restaurant.place_key or "", "restaurant", "restaurant", _name(restaurant), (restaurant, *dishes)))

    sights = [
        fact
        for fact in facts
        if fact.category == "hot_spot" and fact.place_key
        and (fact.data.get("ticket_cny") is not None or fact.data.get("opening_hours"))
    ]
    sights.sort(key=lambda fact: (bool(fact.data.get("name_hanzi")), fact.data.get("ticket_cny") is not None), reverse=True)
    if sights:
        plans.append(EncounterPlan(sights[0].place_key or "", "hot_spot", "train", _name(sights[0]), (sights[0],)))
    return plans[:limit]


# ---------------------------------------------------------------------------
# Draft to scenario, and the checks
# ---------------------------------------------------------------------------


def _scene_texts(scenario: ScenarioDefinition) -> list[str]:
    """Everything a number or a character could hide in."""
    texts = [scenario.title, scenario.subtitle, scenario.setting, scenario.scene_details, *scenario.scene_outline]
    texts += [goal.label for goal in scenario.goals]
    texts += [f"{phrase.hanzi} {phrase.english}" for phrase in scenario.key_phrases]
    for lesson in scenario.lessons:
        phrases = [*lesson.examples, *lesson.words, *([lesson.pattern] if lesson.pattern else [])]
        texts += [f"{phrase.hanzi} {phrase.english}" for phrase in phrases]
        texts += [exercise.model_dump_json() for exercise in lesson.exercises]
    return texts


def check_encounter(scenario: ScenarioDefinition, facts: list[Fact]) -> list[str]:
    """Everything wrong with a scene that the models' own validators don't catch."""
    problems: list[str] = []
    if len(scenario.title) > 60:
        problems.append(f"title is {len(scenario.title)} characters; keep it to 60")
    if len(scenario.subtitle) > 80:
        problems.append(f"subtitle is {len(scenario.subtitle)} characters; keep it to 80")
    if not 2 <= scenario.minutes <= 5:
        problems.append("minutes should be 3 or 4")

    if not 3 <= len(scenario.goals) <= 4:
        problems.append(f"there are {len(scenario.goals)} goals; write 3 or 4")
    goal_ids = [goal.id for goal in scenario.goals]
    if len(set(goal_ids)) != len(goal_ids) or not all(_SNAKE_RE.match(goal_id) for goal_id in goal_ids):
        problems.append("goal ids must be unique snake_case")
    for goal in scenario.goals:
        if "traveler" in goal.label.lower():
            problems.append(f'goal "{goal.label}" should be written to the learner, as something they do ("Order the mapo tofu")')

    if not 4 <= len(scenario.key_phrases) <= 6:
        problems.append(f"there are {len(scenario.key_phrases)} key phrases; write 4 to 6")
    phrases = [*scenario.key_phrases, *(phrase for lesson in scenario.lessons for phrase in [*lesson.examples, *lesson.words])]
    for phrase in phrases:
        if phrase.hanzi and not checks.has_tone_marks(phrase.pinyin):
            problems.append(f'"{phrase.hanzi}" needs pinyin with tone marks (it has "{phrase.pinyin}")')

    if not scenario.scene_outline or not scenario.scene_outline[0].startswith("You open:"):
        problems.append('the first outline step must start with "You open:"')
    if not 4 <= len(scenario.scene_outline) <= 8:
        problems.append(f"the outline has {len(scenario.scene_outline)} steps; write 4 to 8")
    for step in scenario.scene_outline:
        for line in checks.chinese_runs(step):
            if checks.han_count(line) > MAX_LINE:
                problems.append(f'"{line}" is too long for a beginner; split or shorten it (about 25 characters at most)')
            if question := asks_travelers_question(scenario, line):
                problems.append(f'the character says the traveler\'s line "{question}" in "{line}"; key phrases are the traveler\'s')

    if not 2 <= len(scenario.lessons) <= 3:
        problems.append(f"there are {len(scenario.lessons)} lessons; write 2")
    for lesson in scenario.lessons:
        if not 4 <= len(lesson.exercises) <= 6:
            problems.append(f'lesson "{lesson.title}" has {len(lesson.exercises)} questions; write 4 to 6')

    problems += checks.number_problems(_scene_texts(scenario), facts)

    taught = checks.han_chars(" ".join(word.hanzi for lesson in scenario.lessons for word in lesson.words))
    allowed = checks.beginner_chars() | checks.name_chars(facts) | taught
    spoken = [*scenario.scene_outline, *(phrase.hanzi for phrase in phrases)]
    spoken += [exercise.solution.hanzi for lesson in scenario.lessons for exercise in lesson.exercises]
    problems += checks.level_problems(
        spoken, allowed, "Not taught in the lessons' words: use simpler words, or teach them in a lesson's words."
    )
    return problems


def build_encounter(
    draft: EncounterDraft, plan: EncounterPlan, city: City, id_prefix: str, pack_id: str
) -> tuple[ScenarioDefinition | None, list[str]]:
    """The draft as a ScenarioDefinition, and its problems ([] when it's ready)."""
    body = clean(draft.model_dump())
    body["lessons"] = [lesson_body(lesson, lesson["id"]) for lesson in body["lessons"]]
    facts = list(plan.facts)
    sources: dict[str, str] = {}
    for fact in facts:
        sources.setdefault(fact.source_url, fact.source_title or fact.source_url)
    try:
        scenario = ScenarioDefinition.model_validate(
            {
                **body,
                "id": f"{id_prefix}-{plan.place_key}",
                "language": "zh-CN",
                "difficulty": "Beginner",
                "city": city.name,
                "sources": [Source(url=url, title=title) for url, title in list(sources.items())[:MAX_SOURCES]],
                "checked_at": max(fact.retrieved_at for fact in facts).date().isoformat() if facts else None,
                "local": LocalRef(pack_id=pack_id, place_key=plan.place_key, fact_ids=[fact.id for fact in facts]),
            }
        )
    except pydantic.ValidationError as error:
        return None, validation_problems(error, "scene")
    problems = check_encounter(scenario, facts)
    return (None, problems) if problems else (scenario, [])


# ---------------------------------------------------------------------------
# Writing: the loop
# ---------------------------------------------------------------------------


def write_encounter(
    client: anthropic.Anthropic,
    plan: EncounterPlan,
    city: City,
    trace: Trace,
    *,
    model: str,
    effort: str,
    id_prefix: str,
    pack_id: str,
    stage: str = "generate",
) -> ScenarioDefinition | None:
    """One scene, with up to 3 tries. None if it couldn't be written (the reason is in the trace)."""
    return write_checked(
        client,
        model=model,
        effort=effort,
        system=prompts.encounter_system(),
        task=prompts.encounter_message(plan.kind, plan.template, plan.place, city, list(plan.facts)),
        output_format=EncounterDraft,
        build=lambda draft: build_encounter(draft, plan, city, id_prefix, pack_id),
        trace=trace,
        stage=stage,
        worker=f"scene:{plan.place_key}",
        what=f"the scene at {plan.place}",
        ready=lambda scenario: f"Scene ready: {scenario.title}",
    )


def generate_encounters(
    client: anthropic.Anthropic,
    store: PackStore | None,
    pack_id: str,
    city: City,
    facts: list[Fact],
    trace: Trace,
    *,
    model: str,
    effort: str,
    plans: list[EncounterPlan] | None = None,
    id_prefix: str | None = None,
    stage: str = "generate",
) -> list[ScenarioDefinition]:
    """Writes the scenes in parallel and saves each one to the pack (unless store is None: a dry run)."""
    plans = plan_encounters(city, facts) if plans is None else plans
    prefix = id_prefix or f"local-{city.slug}"

    def write(plan: EncounterPlan) -> ScenarioDefinition | None:
        return write_encounter(
            client, plan, city, trace, model=model, effort=effort, id_prefix=prefix, pack_id=pack_id, stage=stage
        )

    if not plans:
        trace.step(stage, "check", "Not enough facts for any scenes")
        return []
    with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL, len(plans))) as pool:
        written = [scenario for scenario in pool.map(write, plans) if scenario is not None]
    if store is not None:
        for scenario in written:
            store.upsert_content(
                ContentItem(
                    pack_id=pack_id,
                    kind="encounter",
                    ref=scenario.id,
                    payload=scenario.model_dump(),
                    fact_ids=scenario.local.fact_ids if scenario.local else [],
                )
            )
    trace.step(stage, "done", f"Wrote {len(written)} of {len(plans)} scenes")
    return written


def draft_from(scenario: ScenarioDefinition) -> EncounterDraft:
    """A hand-written scene as a draft. Tests use it as a known-good draft."""
    body: dict[str, Any] = scenario.model_dump(exclude={"id", "language", "difficulty", "city", "sources", "checked_at", "local"})
    for lesson in body["lessons"]:
        for exercise in lesson["exercises"]:
            exercise.setdefault("hanzi", "")
            exercise.setdefault("pinyin", "")
            exercise.setdefault("options", [])
            exercise.setdefault("answer", 0)
            exercise.setdefault("tiles", [])
            exercise.setdefault("extra_tiles", [])
            exercise["options"] = [{"hanzi": "", "pinyin": "", "english": "", **option} for option in exercise["options"]]
    return EncounterDraft.model_validate(body)

