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
from app.scenarios import LocalRef, ScenarioDefinition, Source, get_scenario
from app.tutor import asks_travelers_question, question_count

MAX_SCENES = 6
MAX_PARALLEL = 3
MAX_LINE = 30  # Chinese characters in one stretch of the character's speech ("at most about 25")
MAX_SOURCES = 8
_SNAKE_RE = re.compile(r"^[a-z][a-z0-9_]*$")
# Steps every scene of a kind shares. A scene may have one; the others come from what's special about the place.
_GENERIC_GOAL_RE = re.compile(
    r"how many (people|of you)|\bparty\b|table for|\bthe bill\b|\bpay(ing)?\b|\bcheck,? please|"
    r"\bsay (hello|hi|thank|thanks|goodbye|bye)|\bgreet|\bthank|^order (a|some) (dish|food|meal)$",
    re.IGNORECASE,
)
_GOAL_STOP_WORDS = {"ask", "say", "the", "your", "you", "for", "and", "are", "how", "what", "where", "when"}
MAX_GENERIC_GOALS = 1
_GREETING_RE = re.compile(r"你好|您好|欢迎")
_PAYING_RE = re.compile(r"买单|结账|付钱|付款|扫码|扫这里|微信|支付宝|现金|pay|bill", re.IGNORECASE)
MIN_DISHES_OFFERED = 2  # a restaurant script names this many real dishes before the traveler orders
OFFER_WITHIN_STEPS = 3
# A step the traveler may or may not take ("If the traveler asks where the restroom is, you: ..."): no question needed.
_SIDE_STEP_RE = re.compile(r"^\s*if\b", re.IGNORECASE)
_GOODBYE_RE = re.compile(r"再见|一路平安")
_GOING_WORDS = r"(?:go|goes|going|get|gets|getting|head|heads|heading|travel|travels|ride)\s+(?:in)?to"

Icon = Literal["PlaneLanding", "BedDouble", "UtensilsCrossed", "TrainFront", "ShoppingBag", "CarTaxiFront", "Landmark"]
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
    gender: Literal["female", "male"] = Field(description="Picks the character's voice and how the app draws them.")
    age: Literal["young", "older"] = Field(description='"older" is about 45 and up: an auntie (阿姨), an uncle, a shop owner.')


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


def _goal_words(label: str) -> set[str]:
    return set(re.findall(r"[a-z]{3,}", label.lower())) - _GOAL_STOP_WORDS


def generic_goals(scenario: ScenarioDefinition, template: ScenarioDefinition | None = None) -> list[str]:
    """Goals any scene of its kind could have, or copied from the hand-written scene it follows."""
    template_words = [_goal_words(goal.label) for goal in template.goals] if template else []

    def copied(label: str) -> bool:
        words = _goal_words(label)
        return any(words and other and len(words & other) / len(words | other) >= 0.6 for other in template_words)

    return [goal.label for goal in scenario.goals if _GENERIC_GOAL_RE.search(goal.label) or copied(goal.label)]


def check_encounter(
    scenario: ScenarioDefinition, facts: list[Fact], template: ScenarioDefinition | None = None
) -> list[str]:
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
    generic = generic_goals(scenario, template)
    if len(generic) > MAX_GENERIC_GOALS:
        listed = "; ".join(f'"{label}"' for label in generic)
        problems.append(
            f"these goals are steps any scene has, or copy the example scene: {listed}. Keep at most one; build the "
            "others from what's special about this place in the facts (a dish and how it's eaten, a line, a ticket, "
            "a time)"
        )
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
    elif not _GREETING_RE.search(scenario.scene_outline[0]) or not re.search(r"[？?]", scenario.scene_outline[0]):
        problems.append(
            'the opening line must greet the traveler and ask the first question of the visit, like "You open: 你好！几位？"'
        )
    if not 4 <= len(scenario.scene_outline) <= 8:
        problems.append(f"the outline has {len(scenario.scene_outline)} steps; write 4 to 8")
    for step in scenario.scene_outline:
        for line in checks.chinese_runs(step):
            if checks.han_count(line) > MAX_LINE:
                problems.append(f'"{line}" is too long for a beginner; split or shorten it (about 25 characters at most)')
            if question := asks_travelers_question(scenario, line):
                problems.append(f'the character says the traveler\'s line "{question}" in "{line}"; key phrases are the traveler\'s')
    problems += outline_question_problems(scenario.scene_outline)

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


def outline_question_problems(outline: list[str]) -> list[str]:
    """The character asks one question at a time, and every reply between the opening and the goodbye asks one,
    so the scene leads the traveler on to the next goal (the hand-written scenes' "Then ask: ...")."""
    problems: list[str] = []
    for number, step in enumerate(outline, start=1):
        count = question_count(" ".join(checks.chinese_runs(step)))
        if count > 1:
            problems.append(f'step {number} asks {count} questions ("{step}"); ask one, so the learner answers one thing at a time')
        elif count == 0 and 1 < number < len(outline) and not _SIDE_STEP_RE.match(step) and not _GOODBYE_RE.search(step):
            problems.append(
                f'step {number} ("{step}") doesn\'t ask the traveler anything. Except for side steps ("If the traveler '
                'asks ...") and the goodbye, end every reply with one short question that leads to the next goal, like '
                '"Then ask: 你要买票吗？" before they ask the price, or "Then ask: 还需要什么吗？"'
            )
    return problems


def going_to_the_city(scenario: ScenarioDefinition, city: City) -> list[str]:
    """The traveler going to the city they're already in (我要去北京 at Beijing's airport), so the character asks
    if they want to go there. A place in the city is fine (去北京南站, go to Beijing South Station)."""
    chinese = re.compile(rf"去{re.escape(city.hanzi)}(?=[吗吧呢了]|[^㐀-鿿A-Za-z0-9]|$)")
    english = re.compile(rf"\b{_GOING_WORDS}\s+{re.escape(city.name)}\b(?![ \t]+[A-Za-z]|['’]s)", re.IGNORECASE)
    hits = [text for text in _scene_texts(scenario) if chinese.search(text) or english.search(text)]
    if not hits:
        return []
    listed = "; ".join(f'"{text[:80]}"' for text in dict.fromkeys(hits))
    return [
        f"the traveler is already in {city.name}, so they never go to {city.name} ({city.hanzi}) itself: {listed}. Where "
        "they're going is a place in the city, such as the city center (市中心), a station, their hotel or a sight"
    ]


def visit_flow_problems(scenario: ScenarioDefinition, facts: list[Fact], kind: str) -> list[str]:
    """A restaurant script has to offer real dishes before the order, and end with paying."""
    if kind != "restaurant":
        return []
    problems: list[str] = []
    dishes = {fact.data.get("dish_hanzi") for fact in facts if fact.category == "menu_item"} - {None, ""}
    opening = " ".join(scenario.scene_outline[:OFFER_WITHIN_STEPS])
    offered = {dish for dish in dishes if dish in opening}
    if len(dishes) >= MIN_DISHES_OFFERED and len(offered) < MIN_DISHES_OFFERED:
        problems.append(
            f"in the first {OFFER_WITHIN_STEPS} outline steps, the character must offer at least {MIN_DISHES_OFFERED} real "
            "dishes by name before the traveler orders (我们有麻婆豆腐和回锅肉), so the learner knows what's on the menu"
        )
    if not any(_PAYING_RE.search(step) for step in scenario.scene_outline[-3:]):
        problems.append("the script must end with paying (the traveler asks for the bill, 买单, and pays), then goodbye")
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
    problems = check_encounter(scenario, facts, get_scenario(plan.template))
    problems += visit_flow_problems(scenario, facts, plan.kind)
    problems += going_to_the_city(scenario, city)
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

