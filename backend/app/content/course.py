"""The content agent for the Lessons and Quiz tabs (issue #36): local notes, practice lessons, quizzes.

Code plans what a city's facts can carry: which units get an "In Chengdu" section (and which of those
a local practice lesson), and which of the three local quizzes. Each piece is then written by the
loop in drafts.py, from its own numbered facts. The agent cites fact numbers, so every note and quiz
keeps the ids, and the sources, of the facts it came from.
"""

import re
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Literal

import anthropic
import pydantic
from pydantic import BaseModel, Field

from app.content import checks, prompts
from app.content.drafts import (
    DraftExercise,
    DraftLesson,
    DraftPhrase,
    clean,
    exercise_body,
    lesson_body,
    validation_problems,
    write_checked,
)
from app.content.models import COURSE_UNITS, LocalQuiz, LocalUnitNotes, QuizIcon
from app.lessons import Exercise, Lesson
from app.locations.cities import City
from app.locations.models import ContentItem, Fact
from app.locations.store import PackStore
from app.research.trace import Trace
from app.scenarios import Source

MAX_PARALLEL = 3
MAX_UNIT_FACTS = 14
MAX_QUIZ_FACTS = 16
MIN_NOTE_FACTS = 2
MIN_LESSON_FACTS = 3
MIN_QUIZ_FACTS = 4
MAX_SOURCES = 8
_CONFIDENCE = {"high": 0, "medium": 1, "low": 2}

# ---------------------------------------------------------------------------
# Drafts: what Claude writes (plain types, checked afterwards)
# ---------------------------------------------------------------------------


class NoteDraft(BaseModel):
    title: str
    body: str = Field(description="1 to 3 plain English sentences, at most 300 characters.")
    terms: list[DraftPhrase] = Field(description="0 to 4 Chinese words or names from the note.")
    facts: list[int] = Field(description="The numbers of the facts this note comes from.")


class UnitNotesDraft(BaseModel):
    notes: list[NoteDraft] = Field(description="2 to 4 notes, or [] if fewer than 2 facts fit the unit.")
    lesson: DraftLesson | None = Field(description="The local practice lesson when asked for one, otherwise null.")


class QuizDraft(BaseModel):
    title: str
    summary: str = Field(description="One line on what the quiz covers.")
    exercises: list[DraftExercise] = Field(description="6 to 10 questions, each with Chinese in it.")
    facts: list[int] = Field(description="The numbers of the facts the questions use.")


# ---------------------------------------------------------------------------
# Planning (code, no model): which units and quizzes a city's facts can carry
# ---------------------------------------------------------------------------

_HOTEL_RE = re.compile(r"\bhotels?\b|check-in|deposit|酒店|宾馆|押金", re.IGNORECASE)
_HELP_RE = re.compile(r"emergenc|police|hospital|pharmac|doctor|报警|医院|药店", re.IGNORECASE)
_TABLE_RE = re.compile(r"\btea|chopstick|meal|\beat|dish|hot ?pot|toast|drink|spic|吃|茶|筷|喝", re.IGNORECASE)


def _text(fact: Fact) -> str:
    return f"{fact.title} {fact.body} {fact.hanzi}"


def _is_airport(fact: Fact) -> bool:
    text = f"{fact.title} {fact.data.get('origin') or ''} {fact.data.get('destination') or ''}".lower()
    return fact.data.get("mode") == "airport_link" or "airport" in text or "机场" in fact.hanzi


def _is_note(fact: Fact) -> bool:
    return fact.category in ("culture", "etiquette", "fun_fact")


@dataclass(frozen=True)
class UnitSpec:
    topic: str  # what the notes are about, for the prompt ("{city}" is filled in)
    pick: Callable[[Fact], bool]
    lesson: str | None = None  # what the local practice lesson practises; None: notes only


# The units a pack can add to (issue #36's table). The basics units (sounds, hello, numbers...) are the
# same everywhere, so they get nothing local.
UNIT_SPECS: dict[str, UnitSpec] = {
    "money": UnitSpec(
        "what everyday things cost in {city}, and how people pay",
        lambda fact: fact.category == "price",
        "asking and understanding real prices: 多少钱？ and prices with 块",
    ),
    "time": UnitSpec(
        "opening hours of the places visitors go, and how long trips take",
        lambda fact: (fact.category == "hot_spot" and bool(fact.data.get("opening_hours")))
        or (fact.category == "transport" and fact.data.get("minutes") is not None),
    ),
    "airport": UnitSpec(
        "getting from the airport into {city}: the lines, fares and times",
        lambda fact: fact.category == "transport" and _is_airport(fact),
        "asking how to get into the city and what it costs, with the real line and fare",
    ),
    "hotel": UnitSpec(
        "what's useful to know about hotels in {city}",
        lambda fact: fact.category in ("culture", "etiquette", "price") and bool(_HOTEL_RE.search(_text(fact))),
    ),
    "food": UnitSpec(
        "the local dishes and the restaurants visitors can try",
        lambda fact: fact.category in ("restaurant", "menu_item"),
        "ordering the real local dishes and asking their prices: 我要… and 多少钱？",
    ),
    "directions": UnitSpec(
        "the places visitors go and where they are",
        lambda fact: fact.category == "hot_spot",
        "asking where a real place is: …在哪里？",
    ),
    "getting-around": UnitSpec(
        "the metro, taxis, DiDi and transport cards in {city}",
        lambda fact: fact.category == "transport" and not _is_airport(fact),
        "taking the right metro line and asking the fare: 坐…号线",
    ),
    "shopping": UnitSpec(
        "what things cost when shopping in {city}",
        lambda fact: fact.category == "price",
    ),
    "help": UnitSpec(
        "local help: emergencies, pharmacies, hospitals",
        # Not transport: metro stations are often named after hospitals.
        lambda fact: _is_note(fact) and bool(_HELP_RE.search(_text(fact))),
    ),
    "manners": UnitSpec("local etiquette and norms", lambda fact: fact.category == "etiquette"),
    "table": UnitSpec(
        "eating and drinking customs in {city}",
        lambda fact: _is_note(fact) and bool(_TABLE_RE.search(_text(fact))),
    ),
    "luck": UnitSpec(
        "local customs, festivals and fun facts",
        lambda fact: fact.category in ("culture", "fun_fact"),
    ),
}

QuizTopic = Literal["transport", "food", "culture"]


@dataclass(frozen=True)
class QuizSpec:
    title: str  # "{city}" is filled in
    topic: str
    icon: QuizIcon
    pick: Callable[[Fact], bool]


QUIZ_SPECS: dict[QuizTopic, QuizSpec] = {
    "transport": QuizSpec(
        "Getting around {city}",
        "the real metro lines, airport links and fares, and how to ask for them",
        "TrainFront",
        lambda fact: fact.category == "transport",
    ),
    "food": QuizSpec(
        "Eating in {city}",
        "the real local dishes, restaurants and prices, and how to order them",
        "UtensilsCrossed",
        lambda fact: fact.category in ("restaurant", "menu_item"),
    ),
    "culture": QuizSpec(
        "{city} culture",
        "the city's places, customs, etiquette and fun facts, with their Chinese names",
        "Landmark",
        lambda fact: _is_note(fact) or fact.category == "hot_spot",
    ),
}


@dataclass(frozen=True)
class CoursePlan:
    kind: Literal["unit", "quiz"]
    key: str  # the unit id, or the quiz topic
    ref: str  # what it's saved under: the unit id, or the quiz id
    title: str  # the unit's title, or the quiz's
    topic: str
    lesson: str | None  # units only
    icon: QuizIcon | None  # quizzes only
    facts: tuple[Fact, ...]


def _best(facts: list[Fact], limit: int) -> tuple[Fact, ...]:
    """The surest facts first, then those with Chinese, then the ones with numbers (prices, lines)."""
    ranked = sorted(facts, key=lambda fact: (_CONFIDENCE[fact.confidence], not fact.hanzi, not fact.data))
    return tuple(ranked[:limit])


def _food_facts(facts: list[Fact], limit: int) -> tuple[Fact, ...]:
    """Restaurants and their dishes, with priced dishes first, so a few restaurants don't crowd out the rest."""
    restaurants = [fact for fact in facts if fact.category == "restaurant"]
    dishes = [fact for fact in facts if fact.category == "menu_item"]
    dishes.sort(key=lambda fact: fact.data.get("price_cny") is None)
    keep = list(_best(restaurants, max(2, limit // 3)))
    return tuple(keep + dishes[: limit - len(keep)])


def plan_course(city: City, facts: list[Fact]) -> list[CoursePlan]:
    plans: list[CoursePlan] = []
    for unit_id, spec in UNIT_SPECS.items():
        found = [fact for fact in facts if spec.pick(fact)]
        if len(found) < MIN_NOTE_FACTS:
            continue  # better no notes than vague ones
        chosen = _food_facts(found, MAX_UNIT_FACTS) if unit_id == "food" else _best(found, MAX_UNIT_FACTS)
        lesson = spec.lesson if spec.lesson and len(found) >= MIN_LESSON_FACTS else None
        topic = spec.topic.format(city=city.name)
        plans.append(CoursePlan("unit", unit_id, unit_id, COURSE_UNITS[unit_id], topic, lesson, None, chosen))
    for topic_key, quiz in QUIZ_SPECS.items():
        found = [fact for fact in facts if quiz.pick(fact)]
        if len(found) < MIN_QUIZ_FACTS:
            continue
        chosen = _food_facts(found, MAX_QUIZ_FACTS) if topic_key == "food" else _best(found, MAX_QUIZ_FACTS)
        title = quiz.title.format(city=city.name)
        ref = f"local-{city.slug}-{topic_key}"
        plans.append(CoursePlan("quiz", topic_key, ref, title, quiz.topic, None, quiz.icon, chosen))
    return plans


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def _cited(numbers: list[int], facts: tuple[Fact, ...]) -> tuple[list[Fact], list[int]]:
    """The facts behind the numbers the agent cited, and the numbers that don't exist."""
    found = [facts[number - 1] for number in dict.fromkeys(numbers) if 1 <= number <= len(facts)]
    return found, [number for number in numbers if not 1 <= number <= len(facts)]


def _has_chinese(exercise: Exercise) -> bool:
    texts = [exercise.prompt, exercise.solution.hanzi]
    if exercise.kind == "choice":
        texts += [exercise.hanzi, *(option.hanzi for option in exercise.options)]
    return any(checks.han_count(text) for text in texts)


def question_problems(
    exercises: list[Exercise], facts: list[Fact], allowed: set[str] | frozenset[str], advice: str
) -> list[str]:
    """What's wrong with a lesson's or quiz's questions beyond the lesson validators."""
    problems: list[str] = []
    for number, exercise in enumerate(exercises, start=1):
        if not _has_chinese(exercise):
            problems.append(f'question {number} ("{exercise.prompt}") has no Chinese; every question teaches Mandarin')
        if exercise.solution.hanzi and not checks.has_tone_marks(exercise.solution.pinyin):
            problems.append(f'question {number}: "{exercise.solution.hanzi}" needs pinyin with tone marks')
    problems += checks.number_problems((exercise.model_dump_json() for exercise in exercises), facts)
    problems += checks.level_problems((exercise.solution.hanzi for exercise in exercises), allowed, advice)
    return problems


def _lesson_problems(lesson: Lesson, facts: list[Fact], allowed: set[str] | frozenset[str]) -> list[str]:
    problems: list[str] = []
    if not 5 <= len(lesson.exercises) <= 8:
        problems.append(f"the lesson has {len(lesson.exercises)} questions; write 5 to 8")
    if len(lesson.words) > 8:
        problems.append(f"the lesson has {len(lesson.words)} words; teach at most 8")
    phrases = [*lesson.examples, *lesson.words, *([lesson.pattern] if lesson.pattern else [])]
    for phrase in phrases:
        if phrase.hanzi and not checks.has_tone_marks(phrase.pinyin):
            problems.append(f'"{phrase.hanzi}" needs pinyin with tone marks (it has "{phrase.pinyin}")')
    taught = allowed | checks.han_chars(" ".join(word.hanzi for word in lesson.words))
    problems += checks.number_problems((f"{phrase.hanzi} {phrase.english}" for phrase in phrases), facts)
    problems += checks.level_problems(
        (phrase.hanzi for phrase in [*lesson.examples, *([lesson.pattern] if lesson.pattern else [])]),
        taught,
        "Use simpler words, or teach them in the lesson's words.",
    )
    problems += question_problems(lesson.exercises, facts, taught, "Use simpler words, or teach them in the lesson's words.")
    return problems


def _sources(facts: list[Fact]) -> list[Source]:
    titles: dict[str, str] = {}
    for fact in facts:
        titles.setdefault(fact.source_url, fact.source_title or fact.source_url)
    return [Source(url=url, title=title) for url, title in list(titles.items())[:MAX_SOURCES]]


def _checked_at(facts: list[Fact]) -> str | None:
    return max(fact.retrieved_at for fact in facts).date().isoformat() if facts else None


def build_unit_notes(draft: UnitNotesDraft, plan: CoursePlan, city: City) -> tuple[LocalUnitNotes | None, list[str]]:
    """The draft as LocalUnitNotes, and its problems. (None, []) when the agent rightly wrote no notes."""
    if not draft.notes:
        return None, []
    body = clean(draft.model_dump())
    problems: list[str] = []
    notes, used = [], []
    for number, note in enumerate(body["notes"], start=1):
        cited, unknown = _cited(note["facts"], plan.facts)
        if unknown:
            problems.append(f"note {number} cites facts {unknown}, which aren't in the list")
        for term in note["terms"]:
            if term["hanzi"] and not checks.has_tone_marks(term["pinyin"]):
                problems.append(f'note {number}: "{term["hanzi"]}" needs pinyin with tone marks')
        problems += [f"note {number}: {problem}" for problem in checks.number_problems([note["title"], note["body"]], cited)]
        used += cited
        fact_ids = [fact.id for fact in cited]
        notes.append({"title": note["title"], "body": note["body"], "terms": note["terms"], "fact_ids": fact_ids})

    lesson = None
    if body["lesson"] is not None:
        if plan.lesson is None:
            problems.append("this unit has no local practice lesson: set lesson to null")
        else:
            lesson = lesson_body(body["lesson"], f"local-{city.slug}-{plan.key}")
            used = list(plan.facts)  # a lesson can use any of the unit's facts
    elif plan.lesson is not None:
        problems.append(f"write the local practice lesson: it practises {plan.lesson}")

    try:
        result = LocalUnitNotes.model_validate(
            {
                "unit_id": plan.key,
                "notes": notes,
                "lesson": lesson,
                "sources": _sources(used),
                "checked_at": _checked_at(list(plan.facts)),
            }
        )
    except pydantic.ValidationError as error:
        return None, validation_problems(error, "notes") + problems
    if result.lesson is not None:
        allowed = checks.beginner_chars() | checks.name_chars(plan.facts)
        problems += [f"lesson: {problem}" for problem in _lesson_problems(result.lesson, list(plan.facts), allowed)]
    return (None, problems) if problems else (result, [])


def build_quiz(draft: QuizDraft, plan: CoursePlan) -> tuple[LocalQuiz | None, list[str]]:
    body = clean(draft.model_dump())
    cited, unknown = _cited(body["facts"], plan.facts)
    problems: list[str] = []
    if unknown:
        problems.append(f"the quiz cites facts {unknown}, which aren't in the list")
    if not cited:
        problems.append("list the numbers of the facts the questions use")
    try:
        quiz = LocalQuiz.model_validate(
            {
                "id": plan.ref,
                "title": body["title"] or plan.title,
                "summary": body["summary"],
                "icon": plan.icon,
                "exercises": [exercise_body(item) for item in body["exercises"]],
                "fact_ids": [fact.id for fact in cited],
                "sources": _sources(cited),
                "checked_at": _checked_at(list(plan.facts)),
            }
        )
    except pydantic.ValidationError as error:
        return None, validation_problems(error, "quiz") + problems
    allowed = checks.beginner_chars() | checks.name_chars(plan.facts)
    problems += question_problems(
        quiz.exercises, list(plan.facts), allowed, "Use beginner words, or the facts' own Chinese names and terms."
    )
    return (None, problems) if problems else (quiz, [])


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

CourseItem = LocalUnitNotes | LocalQuiz


def _ready_unit(notes: LocalUnitNotes) -> str:
    lesson = f" and a {len(notes.lesson.exercises)}-question lesson" if notes.lesson else ""
    return f"Notes ready for {COURSE_UNITS[notes.unit_id]}: {len(notes.notes)} notes{lesson}"


def write_course_item(
    client: anthropic.Anthropic,
    plan: CoursePlan,
    city: City,
    trace: Trace,
    *,
    model: str,
    effort: str,
    stage: str = "generate",
) -> CourseItem | None:
    """One unit's notes or one quiz, with up to 3 tries. None if it couldn't be written, or the facts didn't fit."""
    common = {"model": model, "effort": effort, "system": prompts.course_system(), "trace": trace, "stage": stage}
    if plan.kind == "unit":
        return write_checked(
            client,
            **common,
            task=prompts.unit_message(city, plan.title, plan.topic, plan.lesson, list(plan.facts)),
            output_format=UnitNotesDraft,
            build=lambda draft: build_unit_notes(draft, plan, city),
            worker=f"unit:{plan.key}",
            what=f'the {city.name} notes for "{plan.title}"',
            ready=_ready_unit,
            declined=f'No {city.name} notes for "{plan.title}": the facts don\'t fit it',
        )
    return write_checked(
        client,
        **common,
        task=prompts.quiz_message(city, plan.title, plan.topic, list(plan.facts)),
        output_format=QuizDraft,
        build=lambda draft: build_quiz(draft, plan),
        worker=f"quiz:{plan.key}",
        what=f'the quiz "{plan.title}"',
        ready=lambda quiz: f"Quiz ready: {quiz.title}, {len(quiz.exercises)} questions",
    )


def _content_item(pack_id: str, item: CourseItem) -> ContentItem:
    if isinstance(item, LocalUnitNotes):
        fact_ids = list(dict.fromkeys(fact_id for note in item.notes for fact_id in note.fact_ids))
        return ContentItem(
            pack_id=pack_id, kind="unit_notes", ref=item.unit_id, payload=item.model_dump(), fact_ids=fact_ids
        )
    return ContentItem(pack_id=pack_id, kind="quiz", ref=item.id, payload=item.model_dump(), fact_ids=item.fact_ids)


def generate_course(
    client: anthropic.Anthropic,
    store: PackStore | None,
    pack_id: str,
    city: City,
    facts: list[Fact],
    trace: Trace,
    *,
    model: str,
    effort: str,
    plans: list[CoursePlan] | None = None,
    stage: str = "generate",
) -> list[CourseItem]:
    """Writes the units' notes and the quizzes in parallel, and saves each one (unless store is None: a dry run)."""
    plans = plan_course(city, facts) if plans is None else plans
    if not plans:
        trace.step(stage, "check", "Not enough facts for any local notes or quizzes")
        return []

    def write(plan: CoursePlan) -> CourseItem | None:
        return write_course_item(client, plan, city, trace, model=model, effort=effort, stage=stage)

    with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL, len(plans))) as pool:
        written = [item for item in pool.map(write, plans) if item is not None]
    if store is not None:
        for item in written:
            store.upsert_content(_content_item(pack_id, item))
    units = sum(isinstance(item, LocalUnitNotes) for item in written)
    trace.step(stage, "done", f"Wrote notes for {units} units and {len(written) - units} quizzes")
    return written
