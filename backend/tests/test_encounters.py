import json
from collections.abc import Callable
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient

from app import speech, tutor
from app.content import checks, cli, drafts, encounters, lookup, prompts
from app.content.encounters import DraftPhrase, EncounterDraft, EncounterPlan
from app.locations.cities import find_city
from app.locations.models import ContentItem, Fact, FactDraft
from app.locations.store import InMemoryPackStore
from app.research.trace import Trace
from app.scenarios import SCENARIOS, get_scenario
from app.tutor import TutorReply

CHENGDU = find_city("chengdu")
assert CHENGDU is not None
NOODLES = get_scenario("restaurant")
assert NOODLES is not None


def fact(id: str = "f1", **overrides: Any) -> Fact:
    fields: dict[str, Any] = {
        "id": id,
        "pack_id": "pack-1",
        "retrieved_at": datetime(2026, 10, 31, 9, 55, tzinfo=UTC),
        "category": "culture",
        "title": "Teahouses",
        "body": "People spend whole afternoons in teahouses.",
        "source_url": "https://example.com/teahouses",
        "source_title": "Chengdu teahouses",
    }
    return Fact.model_validate({**fields, **overrides})


def noodle_facts() -> list[Fact]:
    """A restaurant whose menu has every price the hand-written noodle scene uses."""
    prices = sorted(checks.prices_in(json.dumps(NOODLES.model_dump(), ensure_ascii=False)))
    restaurant = fact(
        "r1",
        category="restaurant",
        place_key="wang-noodles",
        title="Auntie Wang's noodles",
        body="A small family noodle shop.",
        hanzi="王阿姨面馆",
        data={"name": "Auntie Wang's noodles", "name_hanzi": "王阿姨面馆", "cuisine": "noodles"},
        source_url="https://example.com/wang",
        source_title="Wang's noodles",
    )
    dishes = [
        fact(
            f"m{price}",
            category="menu_item",
            place_key="wang-noodles",
            title=f"Dish {price}",
            body="On the menu.",
            data={"dish": f"Dish {price}", "dish_hanzi": "牛肉面", "dish_pinyin": "niúròu miàn", "price_cny": price},
            source_url="https://example.com/wang/menu",
            source_title="Wang's menu",
        )
        for price in prices
    ]
    return [restaurant, *dishes]


def dumplings() -> Fact:
    return fact(
        "m-dumplings",
        category="menu_item",
        place_key="wang-noodles",
        title="Dumplings",
        body="On the menu.",
        data={"dish": "Dumplings", "dish_hanzi": "饺子", "dish_pinyin": "jiǎozi", "price_cny": 20},
        source_url="https://example.com/wang/menu",
    )


def noodle_plan() -> EncounterPlan:
    facts = (*noodle_facts(), dumplings())
    return EncounterPlan("wang-noodles", "restaurant", "restaurant", "Auntie Wang's noodles (王阿姨面馆)", facts)


def good_draft() -> EncounterDraft:
    """The hand-written noodle scene, with goals of its own (a copy of the template's goals isn't accepted)."""
    draft = encounters.draft_from(NOODLES)
    labels = [
        ("party_size", "Say how many people"),  # the one generic step allowed
        ("order_noodles", "Order the house beef noodles"),
        ("dumpling_price", "Ask how much the dumplings are"),
        ("free_tea", "Ask if the tea is free"),
    ]
    draft.goals = [encounters.DraftGoal(id=goal_id, label=label) for goal_id, label in labels]
    return draft


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
            input_tokens=200, output_tokens=3000, cache_read_input_tokens=0, cache_creation_input_tokens=0, server_tool_use=None
        )
        return SimpleNamespace(parsed_output=reply, usage=usage, model="claude-sonnet-5-5", stop_reason="end_turn")


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "number"),
    [("十八", 18), ("三十八", 38), ("一百零五", 105), ("两百", 200), ("二零二四", 2024), ("八", 8), ("十块", None)],
)
def test_chinese_numbers(text: str, number: int | None) -> None:
    assert checks.chinese_number(text) == number


def test_prices_and_lines_in_text() -> None:
    assert checks.prices_in("牛肉面 ¥28, 三十八块, 15 yuan, 10元") == {28, 38, 15, 10}
    assert checks.prices_in("我们一块儿去吧") == set()  # together, not a price
    assert checks.lines_in("坐十八号线, then Line 2, 3号线") == {18, 2, 3}


def test_numbers_from_facts() -> None:
    metro = fact(
        category="transport",
        title="Metro Line 18 to the airport",
        body="About ¥10 into the city.",
        data={"mode": "metro", "line": "18", "fare_cny_min": 2, "fare_cny_max": 10},
    )
    assert checks.fact_numbers([metro]) == ({2, 10}, {18})


def test_level() -> None:
    allowed = checks.beginner_chars()
    assert {"你", "好", "转"} <= allowed  # HSK 1–2, and the hand-written scenes' words (转盘)
    assert "鳄" not in allowed
    assert checks.above_level(["你好", "我想吃鳄鱼"], allowed) == {"鳄": "我想吃鳄鱼"}
    assert "陈" in checks.name_chars([fact(hanzi="陈麻婆豆腐")])


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------


def test_plan_encounters() -> None:
    airport = fact("a1", category="transport", title="Line 18 to Tianfu Airport", body="Into the city.",
                   data={"mode": "airport_link", "origin": "Tianfu Airport", "fare_cny_max": 10})
    metro = [fact(f"t{n}", category="transport", title=f"Metro line {n}", body="Across town.", data={"mode": "metro", "line": str(n)}) for n in (1, 2)]
    sight = fact("h1", category="hot_spot", place_key="panda-base", title="Panda Base", body="Pandas.",
                 data={"name": "Panda Base", "name_hanzi": "熊猫基地", "ticket_cny": 55})
    lonely = fact("r9", category="restaurant", place_key="no-menu", title="No menu", body="x", data={"name": "No menu", "cuisine": "x"})
    plans = encounters.plan_encounters(CHENGDU, [airport, *metro, *noodle_facts(), sight, lonely])
    assert [(plan.place_key, plan.kind, plan.template) for plan in plans] == [
        ("airport", "airport", "airport"),
        ("getting-around", "getting_around", "train"),
        ("wang-noodles", "restaurant", "restaurant"),  # the one without a menu isn't planned
        ("panda-base", "hot_spot", "train"),
    ]
    assert plans[0].place == "Tianfu Airport" and plans[3].place == "Panda Base (熊猫基地)"
    assert len(encounters.plan_encounters(CHENGDU, [airport, *metro], limit=1)) == 1


def test_sightseeing_scene_is_at_the_must_see() -> None:
    chongqing = find_city("chongqing")
    assert chongqing is not None and chongqing.must_see is not None
    ticketed = fact("h1", category="hot_spot", place_key="three-gorges-museum", title="Three Gorges Museum", body="History.",
                    data={"name": "Three Gorges Museum", "name_hanzi": "三峡博物馆", "ticket_cny": 30})
    lights = fact("h2", category="hot_spot", place_key="hongyadong", title="Hongyadong", body="Lit up at night.",
                  data={"name": "Hongyadong", "name_hanzi": "洪崖洞", "opening_hours": "Lit 19:00-23:00"})
    sights = [plan for plan in encounters.plan_encounters(chongqing, [ticketed, lights]) if plan.kind == "hot_spot"]
    assert [plan.place_key for plan in sights] == ["hongyadong"]
    # Without a must-see, a sight with a ticket price comes first.
    assert [plan.place_key for plan in encounters.plan_encounters(CHENGDU, [lights, ticketed])] == ["three-gorges-museum"]


# ---------------------------------------------------------------------------
# Building and checking a draft
# ---------------------------------------------------------------------------


def test_a_good_draft_becomes_a_local_scenario() -> None:
    scenario, problems = encounters.build_encounter(good_draft(), noodle_plan(), CHENGDU, "local-chengdu", "pack-1")
    assert problems == [] and scenario is not None
    assert (scenario.id, scenario.language, scenario.difficulty, scenario.city) == (
        "local-chengdu-wang-noodles", "zh-CN", "Beginner", "Chengdu"
    )
    assert scenario.local is not None and scenario.local.pack_id == "pack-1"
    assert scenario.local.fact_ids == [item.id for item in noodle_plan().facts]
    assert [source.url for source in scenario.sources] == ["https://example.com/wang", "https://example.com/wang/menu"]
    assert scenario.checked_at == "2026-10-31"
    public = scenario.public().model_dump()
    assert "local" not in public and "scene_details" not in public and public["sources"]
    # It works with the tutor unchanged.
    assert "王阿姨" in tutor.build_system_prompt(scenario, [])


def _build_exercise(draft: EncounterDraft) -> Any:
    return next(item for lesson in draft.lessons for item in lesson.exercises if item.kind == "build")


def _choice_exercise(draft: EncounterDraft) -> Any:
    return next(item for lesson in draft.lessons for item in lesson.exercises if item.kind == "choice")


def _break_tiles(draft: EncounterDraft) -> None:
    _build_exercise(draft).tiles[0].hanzi = "错"


def _break_answer(draft: EncounterDraft) -> None:
    _choice_exercise(draft).answer = 9


def _long_line(draft: EncounterDraft) -> None:
    draft.scene_outline.append("The traveler waits. You: " + "我们这里的面条" * 6 + "。")


def _goal_for_the_character(draft: EncounterDraft) -> None:
    draft.goals[0].label = "Greet the traveler"


def _character_asks(draft: EncounterDraft) -> None:
    draft.key_phrases[0] = DraftPhrase(hanzi="洗手间在哪里？", pinyin="Xǐshǒujiān zài nǎlǐ?", english="Where's the restroom?")
    draft.scene_outline.append("The traveler looks around. You: 洗手间在哪里？")


def _made_up_price(draft: EncounterDraft) -> None:
    draft.scene_details += " Dumplings cost ¥999."


def _made_up_line(draft: EncounterDraft) -> None:
    draft.scene_details += " Take Line 42 to get here."


def _hard_word(draft: EncounterDraft) -> None:
    draft.scene_outline.append("The traveler asks about dishes. You: 鳄鱼很好吃。")


def _no_tones(draft: EncounterDraft) -> None:
    draft.key_phrases[1].pinyin = "liang wei"


def _no_opening(draft: EncounterDraft) -> None:
    draft.scene_outline[0] = "Hello: 你好！"


def _no_greeting(draft: EncounterDraft) -> None:
    draft.scene_outline[0] = "You open: 现在人很多。"


def _no_menu_offered(draft: EncounterDraft) -> None:
    draft.scene_outline[1] = "The traveler says how many people. You: 请坐！你要吃什么？"


def _no_paying(draft: EncounterDraft) -> None:
    draft.scene_outline = draft.scene_outline[:4]


def _copied_goals(draft: EncounterDraft) -> None:
    draft.goals = encounters.draft_from(NOODLES).goals  # the template's own four


def _generic_goals(draft: EncounterDraft) -> None:
    draft.goals[1].label = "Ask for the bill"
    draft.goals[2].label = "Say thank you"


def _going_to_the_city(draft: EncounterDraft) -> None:
    draft.key_phrases[0] = DraftPhrase(hanzi="我要去成都。", pinyin="Wǒ yào qù Chéngdū.", english="I want to go to Chengdu.")


def _going_to_the_city_in_english(draft: EncounterDraft) -> None:
    draft.scene_outline[1] = "The traveler says they want to go to Chengdu. " + draft.scene_outline[1].split(". ", 1)[1]


def _no_leading_question(draft: EncounterDraft) -> None:
    draft.scene_outline[2] = "The traveler orders a dish. You: 好！"


def _two_questions_in_a_step(draft: EncounterDraft) -> None:
    draft.scene_outline[2] = "The traveler orders a dish. You: 好！要辣吗？喝什么？"


def _yes_no_question(draft: EncounterDraft) -> None:
    draft.scene_outline[2] = "The traveler orders a dish. You: 好！ Then ask: 要辣吗？"


def _coaching_question(draft: EncounterDraft) -> None:
    draft.scene_outline[2] = "The traveler orders a dish. You: 好！ Then ask: 你想知道多少钱吗？"


@pytest.mark.parametrize(
    ("breaks", "problem"),
    [
        (_break_tiles, "tiles spell"),
        (_break_answer, "is not one of the options"),
        (_long_line, "too long for a beginner"),
        (_goal_for_the_character, "written to the learner"),
        (_character_asks, "the character says the traveler's line"),
        (_made_up_price, "the price 999 yuan isn't in the facts"),
        (_made_up_line, "metro line 42 isn't in the facts"),
        (_hard_word, "above beginner level"),
        (_no_tones, "tone marks"),
        (_no_opening, '"You open:"'),
        (_copied_goals, "steps any scene has, or copy the example scene"),
        (_no_greeting, "must greet the traveler"),
        (_no_menu_offered, "offer at least 2 real dishes"),
        (_no_paying, "must end with paying"),
        (_generic_goals, "Keep at most one"),
        (_going_to_the_city, "already in Chengdu"),
        (_going_to_the_city_in_english, "already in Chengdu"),
        (_no_leading_question, "doesn't ask the traveler anything"),
        (_two_questions_in_a_step, "step 3 asks 2 questions"),
        (_yes_no_question, 'step 3 asks a yes/no question ("要辣吗？")'),
        (_coaching_question, "step 3 (\"The traveler orders a dish. You: 好！ Then ask: 你想知道多少钱吗？\") tells the traveler what"),
    ],
)
def test_checks_catch_problems(breaks: Callable[[EncounterDraft], None], problem: str) -> None:
    draft = good_draft()
    breaks(draft)
    scenario, problems = encounters.build_encounter(draft, noodle_plan(), CHENGDU, "local-chengdu", "pack-1")
    assert scenario is None
    assert any(problem in item for item in problems), problems


def test_side_steps_and_the_goodbye_need_no_question() -> None:
    draft = good_draft()
    draft.scene_outline.insert(-1, "If the traveler asks where the restroom is, you: 洗手间在后面。")
    scenario, problems = encounters.build_encounter(draft, noodle_plan(), CHENGDU, "local-chengdu", "pack-1")
    assert scenario is not None, problems


def test_places_in_the_city_are_fine_destinations() -> None:
    scenario, _ = encounters.build_encounter(good_draft(), noodle_plan(), CHENGDU, "local-chengdu", "pack-1")
    assert scenario is not None
    for text in ("我要去成都东站。", "去成都的熊猫基地", "The traveler wants to go to Chengdu East Station.", "Welcome to Chengdu!"):
        assert encounters.going_to_the_city(scenario.model_copy(update={"subtitle": text}), CHENGDU) == [], text
    for text in ("你要去成都吗？", "I want to go to Chengdu.", "They're heading to Chengdu"):
        assert encounters.going_to_the_city(scenario.model_copy(update={"subtitle": text}), CHENGDU), text


def test_hand_written_scripts_lead_to_every_goal() -> None:
    for scenario in SCENARIOS:
        assert encounters.outline_question_problems(scenario.scene_outline) == [], scenario.id


def test_only_the_characters_part_of_a_step_is_checked() -> None:
    # The traveler's yes/no question is theirs to ask; the character's question is the open one.
    step = "The traveler asks 我坐十号线吗？ You: 对，坐十号线。 Then ask: 你还想知道什么？"
    assert encounters.outline_question_problems(["You open: 你好！你要去哪儿？", step, "The traveler says thanks. You: 再见！"]) == []


def test_hard_words_are_fine_when_a_lesson_teaches_them() -> None:
    draft = good_draft()
    _hard_word(draft)
    draft.lessons[0].words.append(DraftPhrase(hanzi="鳄鱼", pinyin="èyú", english="crocodile"))
    scenario, problems = encounters.build_encounter(draft, noodle_plan(), CHENGDU, "local-chengdu", "pack-1")
    assert scenario is not None, problems


# ---------------------------------------------------------------------------
# The writing loop
# ---------------------------------------------------------------------------


def _write(client: FakeWriter, trace: Trace) -> Any:
    return encounters.write_encounter(
        client, noodle_plan(), CHENGDU, trace, model="claude-sonnet-5-5", effort="medium",  # type: ignore[arg-type]
        id_prefix="local-chengdu", pack_id="pack-1",
    )


def test_problems_go_back_to_be_fixed() -> None:
    bad = good_draft()
    _made_up_price(bad)
    client, trace = FakeWriter(bad, good_draft()), new_trace()
    scenario = _write(client, trace)
    assert scenario is not None and scenario.id == "local-chengdu-wang-noodles"

    first, second = client.requests
    assert first["model"] == "claude-sonnet-5-5" and first["output_format"] is EncounterDraft
    assert first["output_config"] == {"effort": "medium"}
    assert first["betas"] == ["server-side-fallback-2026-07-01"] and first["fallbacks"] == "default"
    assert first["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert first["system"][0]["text"] == prompts.encounter_system()
    assert "<facts>" in first["messages"][0]["content"] and "王阿姨面馆" in first["messages"][0]["content"]
    fix = second["messages"][0]["content"]
    assert "previous draft" in fix and "the price 999 yuan isn't in the facts" in fix and "¥999" in fix
    assert [step["kind"] for step in trace.steps] == ["write", "check", "done"]


def test_a_scene_that_never_passes_is_skipped() -> None:
    bad = good_draft()
    _made_up_price(bad)
    client, trace = FakeWriter(bad), new_trace()
    assert _write(client, trace) is None
    assert len(client.requests) == drafts.MAX_ROUNDS and trace.steps[-1]["kind"] == "error"


def test_claude_errors_skip_the_scene() -> None:
    error = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"))
    assert _write(FakeWriter(error), new_trace()) is None
    assert _write(FakeWriter(None), new_trace()) is None  # no draft (max_tokens or a refusal)


def test_generate_saves_scenes_into_the_pack() -> None:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    saved = store.insert_facts(pack.id, [FactDraft.model_validate(item.model_dump()) for item in noodle_facts()])
    plans = encounters.plan_encounters(CHENGDU, saved)
    written = encounters.generate_encounters(
        FakeWriter(good_draft()), store, pack.id, CHENGDU, saved, new_trace(),  # type: ignore[arg-type]
        model="claude-sonnet-5-5", effort="medium", plans=plans,
    )
    assert [scenario.id for scenario in written] == ["local-chengdu-wang-noodles"]
    content = store.get_content(pack.id, "encounter")
    assert [item.ref for item in content] == ["local-chengdu-wang-noodles"]
    assert content[0].fact_ids == [item.id for item in saved]
    assert content[0].payload["local"]["pack_id"] == pack.id

    dry = encounters.generate_encounters(
        FakeWriter(good_draft()), None, pack.id, CHENGDU, saved, new_trace(),  # type: ignore[arg-type]
        model="claude-sonnet-5-5", effort="medium", plans=plans,
    )
    assert len(dry) == 1 and len(store.get_content(pack.id, "encounter")) == 1  # a dry run saves nothing


# ---------------------------------------------------------------------------
# Playing a local encounter
# ---------------------------------------------------------------------------


@pytest.fixture
def local_pack(monkeypatch: pytest.MonkeyPatch) -> InMemoryPackStore:
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    store.finish_pack(pack.id)
    scenario, _ = encounters.build_encounter(good_draft(), noodle_plan(), CHENGDU, "local-chengdu", pack.id)
    assert scenario is not None
    store.upsert_content(ContentItem(pack_id=pack.id, kind="encounter", ref=scenario.id, payload=scenario.model_dump()))
    monkeypatch.setattr(lookup, "get_store", lambda: store)
    lookup.clear_cache()
    yield store
    lookup.clear_cache()


def test_find_local_scenario(local_pack: InMemoryPackStore) -> None:
    found = lookup.find_local_scenario("local-chengdu-wang-noodles")
    assert found is not None and found.scene_details  # the server-only fields are there for the tutor
    assert lookup.find_local_scenario("local-chengdu-missing") is None
    assert lookup.find_local_scenario("local-tokyo-sushi") is None


def test_conversation_plays_a_local_encounter(
    authed_client: TestClient, local_pack: InMemoryPackStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    played: list[str] = []

    def fake_reply(scenario: Any, history: Any, client_completed_ids: Any, learner_text: Any, local_facts: str = "") -> TutorReply:
        played.append(scenario.id)
        return TutorReply(
            learner_hanzi="", learner_pinyin="", learner_english="", hanzi="你好！几位？", pinyin="Nǐ hǎo! Jǐ wèi?",
            english="Hello! How many?", feedback="", corrected_hanzi="", corrected_pinyin="", suggestions=[],
            completed_goal_ids=[], scenario_complete=False,
        )

    monkeypatch.setattr(tutor, "generate_reply", fake_reply)
    monkeypatch.setattr(speech, "synthesize", lambda text, voice_id=None: b"mp3")
    response = authed_client.post("/conversation/start", json={"scenario_id": "local-chengdu-wang-noodles"})
    assert response.status_code == 200 and played == ["local-chengdu-wang-noodles"]
    missing = authed_client.post("/conversation/start", json={"scenario_id": "local-chengdu-missing"})
    assert missing.status_code == 404


def test_built_in_scenes_have_no_sources(client: TestClient) -> None:
    for scenario in client.get("/scenarios").json():
        assert scenario["sources"] == [] and scenario["checked_at"] is None and "local" not in scenario


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------


def test_cli_list_is_free(local_pack: InMemoryPackStore, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    pack = local_pack.get_live_pack("chengdu")
    assert pack is not None
    local_pack.insert_facts(pack.id, [FactDraft.model_validate(item.model_dump()) for item in noodle_facts()])
    monkeypatch.setattr(cli, "get_store", lambda: local_pack)
    monkeypatch.setattr(cli, "get_client", lambda: pytest.fail("--list must not call Claude"))
    assert cli.main(["chengdu", "--list"]) == 0
    assert "wang-noodles" in capsys.readouterr().out


def test_every_example_scene_is_in_the_prompt() -> None:
    system = prompts.encounter_system()
    for scene in prompts.EXAMPLE_SCENES:
        assert f'<scene example="{scene}">' in system
    assert all(scenario.id in {"airport", "restaurant", "train", "hotel"} for scenario in SCENARIOS)


def test_generic_goals() -> None:
    restaurant = get_scenario("restaurant")
    scenario, _ = encounters.build_encounter(good_draft(), noodle_plan(), CHENGDU, "local-chengdu", "pack-1")
    assert scenario is not None
    assert encounters.generic_goals(scenario, restaurant) == ["Say how many people"]  # one is fine
    copied = scenario.model_copy(update={"goals": restaurant.goals})
    assert len(encounters.generic_goals(copied, restaurant)) == 4  # all four are the template's


def test_the_prompt_asks_for_goals_from_the_place() -> None:
    message = prompts.encounter_message("restaurant", "restaurant", "Shu Jiu Xiang (蜀九香)", CHENGDU, [])
    assert "Don't copy its goals" in message and "only for the style" in message
    assert "choosing the broth" in prompts.KIND_BRIEFS["restaurant"]
    assert "At most one goal may be a generic step" in prompts.encounter_system()


def test_the_prompt_asks_for_a_script_that_leads_to_the_goals() -> None:
    system = prompts.encounter_system()
    assert 'every reply of the character ends with "Then ask:" and one short question whose answer is the next goal' in system
    assert "never a yes/no question (…吗？, 要不要, 有没有, 好吗)" in system
    assert "the character never says it first: it may name the thing (你可以坐地铁。), then invites the question" in system
    assert "never the city itself: in Beijing, never 我要去北京" in system
    airport = prompts.encounter_message("airport", "airport", "Shuangliu Airport", CHENGDU, [])
    assert "They're already in Chengdu" in airport

