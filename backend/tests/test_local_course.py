from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx
import pydantic
import pytest

from app.content import cli, course, drafts, encounters, prompts
from app.content.course import CoursePlan, NoteDraft, QuizDraft, UnitNotesDraft
from app.content.drafts import DraftLesson, DraftPhrase
from app.content.models import LocalNote, LocalUnitNotes
from app.locations.cities import find_city
from app.locations.models import ContentItem, Fact, FactDraft
from app.locations.store import InMemoryPackStore
from app.research.trace import Trace
from app.scenarios import get_scenario

CHENGDU = find_city("chengdu")
assert CHENGDU is not None
RESTAURANT = get_scenario("restaurant")
assert RESTAURANT is not None


def fact(id: str, **overrides: Any) -> Fact:
    fields: dict[str, Any] = {
        "id": id,
        "pack_id": "pack-1",
        "retrieved_at": datetime(2026, 10, 31, 9, 55, tzinfo=UTC),
        "category": "culture",
        "title": f"Fact {id}",
        "body": "Something true about Chengdu.",
        "source_url": f"https://example.com/{id}",
        "source_title": f"Page {id}",
    }
    return Fact.model_validate({**fields, **overrides})


def dish(id: str, name: str, hanzi: str, pinyin: str, price: int | None) -> Fact:
    return fact(
        id,
        category="menu_item",
        place_key="chen-mapo-tofu",
        title=name,
        body=f"On the menu: {name}.",
        hanzi=hanzi,
        pinyin=pinyin,
        data={"dish": name, "dish_hanzi": hanzi, "dish_pinyin": pinyin, "price_cny": price},
    )


FOOD = (
    fact("r1", category="restaurant", place_key="chen-mapo-tofu", title="Chen Mapo Tofu", hanzi="陈麻婆豆腐",
         data={"name": "Chen Mapo Tofu", "name_hanzi": "陈麻婆豆腐", "cuisine": "Sichuan"}),
    dish("m1", "Mapo tofu", "麻婆豆腐", "má pó dòu fu", 38),
    dish("m2", "Twice-cooked pork", "回锅肉", "huí guō ròu", 69),
    dish("m3", "Dan dan noodles", "担担面", "dàn dàn miàn", None),
)


def food_plan(lesson: str | None = "ordering the real local dishes") -> CoursePlan:
    return CoursePlan("unit", "food", "food", "Ordering food", "the local dishes", lesson, None, FOOD)


def quiz_plan() -> CoursePlan:
    return CoursePlan("quiz", "food", "local-chengdu-food", "Eating in Chengdu", "dishes", None, "UtensilsCrossed", FOOD)


def note(**overrides: Any) -> NoteDraft:
    fields: dict[str, Any] = {
        "title": "Mapo tofu was born here",
        "body": "Chen Mapo Tofu has served it since 1862, and a plate costs about ¥38.",
        "terms": [DraftPhrase(hanzi="麻婆豆腐", pinyin="má pó dòu fu", english="mapo tofu")],
        "facts": [1, 2],
    }
    return NoteDraft.model_validate({**fields, **overrides})


def known_lesson() -> DraftLesson:
    """A hand-written practice lesson (5 questions) as a draft."""
    return encounters.draft_from(RESTAURANT).lessons[1]


def unit_draft(lesson: bool = True, **overrides: Any) -> UnitNotesDraft:
    fields: dict[str, Any] = {
        "notes": [note(), note(title="Twice-cooked pork", body="Locals order it with rice; it's about ¥69.", facts=[3])],
        "lesson": known_lesson() if lesson else None,
    }
    return UnitNotesDraft.model_validate({**fields, **overrides})


def quiz_draft(count: int = 7, **overrides: Any) -> QuizDraft:
    questions = [item for lesson in encounters.draft_from(RESTAURANT).lessons for item in lesson.exercises][:count]
    fields: dict[str, Any] = {"title": "Eating in Chengdu", "summary": "Order like a local.", "exercises": questions, "facts": [2, 3]}
    return QuizDraft.model_validate({**fields, **overrides})


def new_trace() -> Trace:
    store = InMemoryPackStore()
    return Trace(store, store.create_pack("chengdu").id)


class FakeWriter:
    """Answers beta.messages.parse with drafts (or errors) in order, then repeats the last one."""

    def __init__(self, *replies: Any) -> None:
        self.replies = list(replies)
        self.requests: list[dict[str, Any]] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(parse=self._parse))

    def _parse(self, **kwargs: Any) -> Any:
        self.requests.append(kwargs)
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(reply, Exception):
            raise reply
        usage = SimpleNamespace(
            input_tokens=200, output_tokens=2000, cache_read_input_tokens=0, cache_creation_input_tokens=0, server_tool_use=None
        )
        return SimpleNamespace(parsed_output=reply, usage=usage, model="claude-sonnet-5-5", stop_reason="end_turn")


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------


def test_plan_course() -> None:
    airport = [fact(f"a{n}", category="transport", title=f"Airport link {n}", data={"mode": "airport_link"}) for n in range(3)]
    metro = [fact(f"t{n}", category="transport", title=f"Metro line {n}", data={"mode": "metro", "line": str(n)}) for n in range(2)]
    hospital_stop = fact("t9", category="transport", title="Line 3 to the Panda Base", body="Change at West China Hospital.",
                         data={"mode": "metro"})
    teahouses = [fact(f"c{n}", title=f"Teahouse {n}", body="People drink tea all afternoon.") for n in range(2)]
    found = course.plan_course(CHENGDU, [*airport, *metro, hospital_stop, *teahouses, *FOOD])
    plans = {f"{plan.kind}:{plan.key}": plan for plan in found}

    assert plans["unit:airport"].lesson and plans["unit:food"].lesson  # 3 facts or more: a practice lesson too
    assert plans["unit:getting-around"].lesson  # two metro facts and the Line 3 one
    assert plans["unit:table"].lesson is None and {item.id for item in plans["unit:table"].facts} == {"c0", "c1"}
    assert "unit:help" not in plans  # a hospital station name isn't emergency help
    assert "unit:money" not in plans and "unit:time" not in plans  # no facts for them: no vague notes
    assert plans["quiz:transport"].ref == "local-chengdu-transport" and plans["quiz:transport"].icon == "TrainFront"
    assert plans["quiz:transport"].title == "Getting around Chengdu" and "quiz:food" in plans
    assert "quiz:culture" not in plans  # a quiz needs 4 facts


def test_food_facts_put_priced_dishes_first() -> None:
    chosen = course._food_facts(list(FOOD), 3)
    assert [item.id for item in chosen] == ["r1", "m1", "m2"]  # the dish without a price is left out


# ---------------------------------------------------------------------------
# Building and checking
# ---------------------------------------------------------------------------


def test_good_unit_notes() -> None:
    notes, problems = course.build_unit_notes(unit_draft(), food_plan(), CHENGDU)
    assert problems == [] and notes is not None
    assert notes.unit_id == "food" and notes.checked_at == "2026-10-31"
    assert [item.fact_ids for item in notes.notes] == [["r1", "m1"], ["m2"]]  # cited numbers become fact ids
    assert notes.lesson is not None and notes.lesson.id == "local-chengdu-food"
    assert [source.url for source in notes.sources] == [f"https://example.com/{item.id}" for item in FOOD]


def test_notes_without_a_lesson() -> None:
    notes, problems = course.build_unit_notes(unit_draft(lesson=False), food_plan(lesson=None), CHENGDU)
    assert problems == [] and notes is not None and notes.lesson is None
    assert [source.url for source in notes.sources] == ["https://example.com/r1", "https://example.com/m1", "https://example.com/m2"]


def test_the_agent_can_decline() -> None:
    assert course.build_unit_notes(unit_draft(notes=[], lesson=False), food_plan(None), CHENGDU) == (None, [])


def test_models_reject_bad_notes() -> None:
    good = {"title": "Teahouses", "body": "People spend afternoons there.", "terms": [], "fact_ids": ["f1"]}
    with pytest.raises(pydantic.ValidationError, match="isn't a unit in the course"):
        LocalUnitNotes.model_validate({"unit_id": "not-a-unit", "notes": [good, good]})
    with pytest.raises(pydantic.ValidationError, match="fact_ids"):
        LocalNote.model_validate({**good, "fact_ids": []})
    with pytest.raises(pydantic.ValidationError, match="300"):
        LocalNote.model_validate({**good, "body": "x" * 301})
    with pytest.raises(pydantic.ValidationError, match="at least 2"):
        LocalUnitNotes.model_validate({"unit_id": "food", "notes": [good]})


def _bad_tiles(draft: UnitNotesDraft) -> None:
    assert draft.lesson is not None
    next(item for item in draft.lesson.exercises if item.kind == "build").tiles[0].hanzi = "错"


def _bad_answer(draft: UnitNotesDraft) -> None:
    assert draft.lesson is not None
    next(item for item in draft.lesson.exercises if item.kind == "choice").answer = 9


def _made_up_price(draft: UnitNotesDraft) -> None:
    draft.notes[0].body = "A plate costs ¥999."


def _wrong_citation(draft: UnitNotesDraft) -> None:
    draft.notes[1].facts = [9]


def _no_facts(draft: UnitNotesDraft) -> None:
    draft.notes[1].facts = []


def _long_body(draft: UnitNotesDraft) -> None:
    draft.notes[0].body = "Long. " * 60


def _no_tones(draft: UnitNotesDraft) -> None:
    draft.notes[0].terms[0].pinyin = "ma po dou fu"


def _no_chinese(draft: UnitNotesDraft) -> None:
    assert draft.lesson is not None
    question = draft.lesson.exercises[0]
    question.prompt, question.hanzi, question.pinyin = "Which is spicy?", "", ""
    for option in question.options:
        option.hanzi = option.pinyin = ""
    question.solution.hanzi = ""


def _hard_word(draft: UnitNotesDraft) -> None:
    assert draft.lesson is not None
    draft.lesson.examples.append(DraftPhrase(hanzi="我想吃鳄鱼。", pinyin="Wǒ xiǎng chī èyú.", english="I'd like crocodile."))


def _missing_lesson(draft: UnitNotesDraft) -> None:
    draft.lesson = None


@pytest.mark.parametrize(
    ("breaks", "problem"),
    [
        (_bad_tiles, "tiles spell"),
        (_bad_answer, "is not one of the options"),
        (_made_up_price, "the price 999 yuan isn't in the facts"),
        (_wrong_citation, "cites facts [9]"),
        (_no_facts, "fact_ids"),
        (_long_body, "300"),
        (_no_tones, "tone marks"),
        (_no_chinese, "has no Chinese"),
        (_hard_word, "above beginner level"),
        (_missing_lesson, "write the local practice lesson"),
    ],
)
def test_unit_checks_catch_problems(breaks: Any, problem: str) -> None:
    draft = unit_draft()
    breaks(draft)
    notes, problems = course.build_unit_notes(draft, food_plan(), CHENGDU)
    assert notes is None
    assert any(problem in item for item in problems), problems


def test_a_lesson_where_none_was_asked_for() -> None:
    notes, problems = course.build_unit_notes(unit_draft(), food_plan(lesson=None), CHENGDU)
    assert notes is None and any("set lesson to null" in item for item in problems)


def test_good_quiz() -> None:
    quiz, problems = course.build_quiz(quiz_draft(), quiz_plan())
    assert problems == [] and quiz is not None
    assert (quiz.id, quiz.icon, len(quiz.exercises)) == ("local-chengdu-food", "UtensilsCrossed", 7)
    assert quiz.fact_ids == ["m1", "m2"] and [source.title for source in quiz.sources] == ["Page m1", "Page m2"]


@pytest.mark.parametrize(
    ("draft", "problem"),
    [
        (quiz_draft(count=5), "at least 6"),
        (quiz_draft(facts=[]), "list the numbers of the facts"),
        (quiz_draft(facts=[2, 7]), "cites facts [7]"),
        (quiz_draft(summary="Dishes from ¥999 up."), None),  # summary isn't a question: fine
    ],
)
def test_quiz_checks(draft: QuizDraft, problem: str | None) -> None:
    quiz, problems = course.build_quiz(draft, quiz_plan())
    if problem is None:
        assert quiz is not None, problems
    else:
        assert quiz is None and any(problem in item for item in problems), problems


def test_a_made_up_price_in_a_quiz_question() -> None:
    draft = quiz_draft()
    draft.exercises[0].hint = "It costs ¥999."
    quiz, problems = course.build_quiz(draft, quiz_plan())
    assert quiz is None and any("the price 999 yuan" in item for item in problems)


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------


def _write(client: FakeWriter, plan: CoursePlan, trace: Trace) -> Any:
    return course.write_course_item(client, plan, CHENGDU, trace, model="claude-sonnet-5-5", effort="medium")  # type: ignore[arg-type]


def test_problems_go_back_to_be_fixed() -> None:
    bad = unit_draft()
    _made_up_price(bad)
    client, trace = FakeWriter(bad, unit_draft()), new_trace()
    notes = _write(client, food_plan(), trace)
    assert isinstance(notes, LocalUnitNotes)

    first, second = client.requests
    assert first["output_format"] is UnitNotesDraft and first["system"][0]["text"] == prompts.course_system()
    assert first["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert first["betas"] == ["server-side-fallback-2026-07-01"] and first["fallbacks"] == "default"
    task = first["messages"][0]["content"]
    assert '"Ordering food"' in task and "Local practice: Chengdu" in task and "1. [restaurant]" in task
    assert "the price 999 yuan" in second["messages"][0]["content"]
    assert [step["kind"] for step in trace.steps] == ["write", "check", "done"]


def test_a_declined_unit_isnt_retried() -> None:
    client, trace = FakeWriter(unit_draft(notes=[], lesson=False)), new_trace()
    assert _write(client, food_plan(None), trace) is None
    assert len(client.requests) == 1 and "the facts don't fit it" in trace.steps[-1]["text"]


def test_a_piece_that_never_passes_is_skipped() -> None:
    bad = unit_draft()
    _made_up_price(bad)
    client, trace = FakeWriter(bad), new_trace()
    assert _write(client, food_plan(), trace) is None
    assert len(client.requests) == drafts.MAX_ROUNDS
    assert trace.steps[-1]["kind"] == "error" and "Skipped" in trace.steps[-1]["text"]


def test_claude_errors_skip_the_piece() -> None:
    error = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"))
    assert _write(FakeWriter(error), quiz_plan(), new_trace()) is None
    assert _write(FakeWriter(None), quiz_plan(), new_trace()) is None


def test_quizzes_use_their_own_prompt() -> None:
    client = FakeWriter(quiz_draft())
    assert _write(client, quiz_plan(), new_trace()) is not None
    assert client.requests[0]["output_format"] is QuizDraft
    assert 'quiz titled "Eating in Chengdu"' in client.requests[0]["messages"][0]["content"]


def test_generate_course_saves_into_the_pack() -> None:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    plans = [food_plan(), quiz_plan()]

    class Writer(FakeWriter):
        def _parse(self, **kwargs: Any) -> Any:
            self.replies = [unit_draft() if kwargs["output_format"] is UnitNotesDraft else quiz_draft()]
            return super()._parse(**kwargs)

    written = course.generate_course(
        Writer(), store, pack.id, CHENGDU, list(FOOD), new_trace(),  # type: ignore[arg-type]
        model="claude-sonnet-5-5", effort="medium", plans=plans,
    )
    assert len(written) == 2
    saved = {item.ref: item for item in store.get_content(pack.id)}
    assert saved["food"].kind == "unit_notes" and saved["food"].fact_ids == ["r1", "m1", "m2"]
    assert saved["local-chengdu-food"].kind == "quiz" and saved["local-chengdu-food"].fact_ids == ["m1", "m2"]

    dry = course.generate_course(
        Writer(), None, pack.id, CHENGDU, list(FOOD), new_trace(),  # type: ignore[arg-type]
        model="claude-sonnet-5-5", effort="medium", plans=plans,
    )
    assert len(dry) == 2 and len(store.get_content(pack.id)) == 2  # a dry run saves nothing


def test_course_prompt() -> None:
    system = prompts.course_system()
    assert '<lesson example="order">' in system and '<lesson example="what-time">' in system
    assert "Every question teaches Mandarin" in system


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------


@pytest.fixture
def chengdu_pack(monkeypatch: pytest.MonkeyPatch) -> tuple[InMemoryPackStore, str]:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    teahouses = [fact(f"c{n}", title=f"Teahouse {n}", body="People drink tea all afternoon.") for n in range(2)]
    store.insert_facts(pack.id, [FactDraft.model_validate(item.model_dump()) for item in [*FOOD, *teahouses]])
    store.finish_pack(pack.id)
    notes, _ = course.build_unit_notes(unit_draft(), food_plan(), CHENGDU)
    assert notes is not None
    store.upsert_content(ContentItem(pack_id=pack.id, kind="unit_notes", ref="food", payload=notes.model_dump()))
    monkeypatch.setattr(cli, "get_store", lambda: store)
    return store, pack.id


def test_cli_list_shows_whats_saved(chengdu_pack: Any, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(cli, "get_client", lambda: pytest.fail("--list must not call Claude"))
    assert cli.main(["chengdu", "--course", "--list"]) == 0
    out = capsys.readouterr().out
    assert "unit:food" in out and "saved" in out and "unit:table" in out and "to write" in out
    assert "scene:" not in out  # --course leaves the scenes out


def test_cli_skips_saved_pieces(chengdu_pack: Any, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    store, pack_id = chengdu_pack
    written: list[str] = []

    def fake_generate(client: Any, target: Any, pack: str, city: Any, facts: Any, trace: Any, *, plans: list[CoursePlan], **_: Any) -> list[Any]:
        written.extend(f"{plan.kind}:{plan.key}" for plan in plans)
        return []

    monkeypatch.setattr(cli, "get_client", lambda: object())
    monkeypatch.setattr(cli, "generate_course", fake_generate)
    cli.main(["chengdu", "--course"])
    assert "unit:food" not in written and "unit:table" in written  # food's notes are already saved
    written.clear()
    cli.main(["chengdu", "--course", "--only", "unit:food"])
    assert written == ["unit:food"]  # --only writes it again
