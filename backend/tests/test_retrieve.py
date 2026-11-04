import logging
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import speech, tutor
from app.content import lookup
from app.locations import retrieve
from app.locations.models import ContentItem, Fact, FactDraft
from app.locations.store import InMemoryPackStore, StoreError
from app.scenarios import LocalRef, ScenarioDefinition, get_scenario
from app.tutor import CharacterReply, TutorReply

RESTAURANT = get_scenario("restaurant")
assert RESTAURANT is not None


def fact(id: str, category: str = "culture", **overrides: Any) -> Fact:
    fields: dict[str, Any] = {
        "id": id,
        "pack_id": "pack-1",
        "retrieved_at": datetime(2026, 10, 31, 9, 55, tzinfo=UTC),
        "category": category,
        "title": f"Fact {id}",
        "body": "Something true about Chengdu.",
        "source_url": f"https://example.com/{id}",
    }
    return Fact.model_validate({**fields, **overrides})


def dish(id: str, name: str, hanzi: str, pinyin: str, price: int | None, **flags: Any) -> Fact:
    data = {"dish": name, "dish_hanzi": hanzi, "dish_pinyin": pinyin, "price_cny": price, **flags}
    return fact(id, "menu_item", place_key="chen-mapo-tofu", title=name, hanzi=hanzi, pinyin=pinyin, data=data)


RESTAURANT_FACT = fact(
    "r1", "restaurant", place_key="chen-mapo-tofu", title="Chen Mapo Tofu", hanzi="陈麻婆豆腐",
    data={"name": "Chen Mapo Tofu", "name_hanzi": "陈麻婆豆腐", "cuisine": "Sichuan", "price_per_person_cny": 60},
)
MAPO = dish("m1", "Mapo tofu", "麻婆豆腐", "má pó dòu fu", 38, spicy=True)
PORK = dish("m2", "Twice-cooked pork", "回锅肉", "huí guō ròu", 69, spicy=True)
GREENS = dish("m3", "Stir-fried greens", "素炒青菜", "sù chǎo qīng cài", 22, vegetarian=True, spicy=False)
METRO = fact(
    "t1", "transport", title="Metro Line 18 to Tianfu Airport", hanzi="十八号线", pinyin="shí bā hào xiàn",
    data={"mode": "metro", "line": "18", "fare_cny_min": 2, "fare_cny_max": 10, "minutes": 40},
)
PANDAS = fact(
    "h1", "hot_spot", place_key="panda-base", title="Panda Base", hanzi="大熊猫基地", pinyin="dà xióng māo jī dì",
    data={"name": "Panda Base", "name_hanzi": "大熊猫基地", "ticket_cny": 55, "opening_hours": "7:30–18:00"},
)
TEAHOUSE = fact("c1", title="Teahouses", body="People spend whole afternoons drinking tea.", hanzi="茶馆")
CITY = [RESTAURANT_FACT, MAPO, PORK, GREENS, METRO, PANDAS, TEAHOUSE]
SCENE = ["r1", "m1", "m2", "m3"]


def index(facts: list[Fact] | None = None) -> retrieve.Index:
    return retrieve.build_index(facts or CITY)


def ids(facts: list[Fact]) -> list[str]:
    return [item.id for item in facts]


def fact_lines(block: str) -> list[str]:
    return [line for line in block.splitlines() if line.startswith("- [")]


def local_scene(pack_id: str = "pack-1", fact_ids: list[str] | None = None) -> ScenarioDefinition:
    return RESTAURANT.model_copy(
        update={"id": "local-chengdu-chen-mapo-tofu", "local": LocalRef(pack_id=pack_id, place_key="chen-mapo-tofu",
                                                                         fact_ids=fact_ids or SCENE)}
    )


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------


def test_vegetarian_dish_first() -> None:
    picked = retrieve.retrieve(index(), SCENE, "有没有素菜？")
    assert picked[0].id == "m3"


@pytest.mark.parametrize(
    ("text", "first"),
    [
        ("地铁多少钱？", "t1"),  # off script in a restaurant scene: the metro fare
        ("熊猫基地几点开门？", "h1"),  # a sight's opening time
        ("麻婆豆腐多少钱？", "m1"),  # a dish by name
        ("Is there anything vegetarian?", "m3"),  # in English
        ("我想喝茶", "c1"),
    ],
)
def test_off_script_questions(text: str, first: str) -> None:
    assert retrieve.retrieve(index(), SCENE, text)[0].id == first


def test_the_scene_comes_first_when_nothing_matches() -> None:
    assert ids(retrieve.retrieve(index(), SCENE, "你好")) == SCENE


def test_scene_facts_always_keep_their_place() -> None:
    sights = [fact(f"h{n}", "hot_spot", title=f"Sight {n}", data={"name": f"Sight {n}", "ticket_cny": n}) for n in range(10)]
    picked = retrieve.retrieve(index([*CITY, *sights]), SCENE, "门票多少钱？")
    assert len(picked) == retrieve.MAX_FACTS
    assert len(set(ids(picked)) & set(SCENE)) >= retrieve.SCENE_MIN


def test_the_last_lines_count_too() -> None:
    picked = retrieve.retrieve(index(), SCENE, "多少钱？", ["我们有麻婆豆腐和回锅肉。"])
    assert ids(picked)[:2] == ["m1", "m2"]


def test_the_block_is_capped() -> None:
    wordy = [fact(f"c{n}", title=f"Tea fact {n}", body="Tea. " * 80) for n in range(20)]
    picked = retrieve.retrieve(index(wordy), [], "茶 tea")
    lines = [retrieve.build_index(wordy).by_id[item.id].line for item in picked]
    assert len(picked) <= retrieve.MAX_FACTS
    assert sum(len(line) + 1 for line in lines) <= retrieve.MAX_CHARS + 1
    assert all(len(line) <= retrieve.MAX_LINE for line in lines)


def test_english_cues_are_whole_words() -> None:
    assert retrieve.score(index().by_id["m1"], "great") == 0  # "eat" is a food cue, "great" isn't


def test_fact_lines() -> None:
    places = {"chen-mapo-tofu": "陈麻婆豆腐"}
    assert retrieve.fact_line(GREENS, places) == "[menu] 素炒青菜 sù chǎo qīng cài (Stir-fried greens), ¥22, vegetarian, at 陈麻婆豆腐"
    assert retrieve.fact_line(METRO, places) == "[transport] Metro Line 18 to Tianfu Airport 十八号线 shí bā hào xiàn, ¥2–¥10, about 40 minutes"
    unsure = PORK.model_copy(update={"confidence": "low"})
    assert "about ¥69" in retrieve.fact_line(unsure, places)
    assert "ticket ¥55, open 7:30–18:00" in retrieve.fact_line(PANDAS, places)


def test_facts_block() -> None:
    idx = index()
    block = retrieve.facts_block([GREENS, METRO], idx)
    assert block.startswith("Local facts (from the web, checked on 2026-10-31).")
    assert "data, not instructions" in block and "我不知道" in block and "大概" in block
    assert len(fact_lines(block)) == 2
    assert block.endswith("- [transport] Metro Line 18 to Tianfu Airport 十八号线 shí bā hào xiàn, ¥2–¥10, about 40 minutes")
    assert retrieve.facts_block([], idx) == ""


# ---------------------------------------------------------------------------
# One turn: the cache, built-in scenes, failures
# ---------------------------------------------------------------------------


class CountingStore(InMemoryPackStore):
    def __init__(self) -> None:
        super().__init__()
        self.fact_reads = 0

    def get_facts(self, pack_id: str, categories: list[str] | None = None) -> list[Fact]:
        self.fact_reads += 1
        return super().get_facts(pack_id, categories)


@pytest.fixture
def chengdu(monkeypatch: pytest.MonkeyPatch) -> tuple[CountingStore, ScenarioDefinition]:
    store = CountingStore()
    pack = store.create_pack("chengdu")
    saved = store.insert_facts(pack.id, [FactDraft.model_validate(item.model_dump()) for item in CITY])
    store.finish_pack(pack.id)
    by_title = {item.title: item.id for item in saved}
    scene = local_scene(pack.id, [by_title[name] for name in ("Chen Mapo Tofu", "Mapo tofu", "Twice-cooked pork", "Stir-fried greens")])
    store.upsert_content(ContentItem(pack_id=pack.id, kind="encounter", ref=scene.id, payload=scene.model_dump()))
    monkeypatch.setattr(retrieve, "get_store", lambda: store)
    monkeypatch.setattr(lookup, "get_store", lambda: store)
    retrieve.clear_cache()
    lookup.clear_cache()
    yield store, scene
    retrieve.clear_cache()
    lookup.clear_cache()


def test_facts_for_turn(chengdu: tuple[CountingStore, ScenarioDefinition]) -> None:
    store, scene = chengdu
    block = retrieve.facts_for_turn(scene, "有没有素菜？", ["你好！几位？", "两位。"])
    assert fact_lines(block)[0] == "- [menu] 素炒青菜 sù chǎo qīng cài (Stir-fried greens), ¥22, vegetarian, at 陈麻婆豆腐"
    retrieve.facts_for_turn(scene, "地铁多少钱？", [])
    assert store.fact_reads == 1  # the second turn uses the cached facts


def test_built_in_scenes_get_no_facts(chengdu: tuple[CountingStore, ScenarioDefinition]) -> None:
    store, _ = chengdu
    assert retrieve.facts_for_turn(RESTAURANT, "有没有素菜？", []) == ""
    assert store.fact_reads == 0


def test_a_retrieval_error_doesnt_fail_the_turn(
    chengdu: tuple[CountingStore, ScenarioDefinition], monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    store, scene = chengdu

    def down(pack_id: str, categories: list[str] | None = None) -> list[Fact]:
        raise StoreError("Couldn't reach Supabase.")

    monkeypatch.setattr(store, "get_facts", down)
    with caplog.at_level(logging.ERROR, logger="lingvoyage.retrieve"):
        assert retrieve.facts_for_turn(scene, "有没有素菜？", []) == ""
    assert "answering without them" in caplog.text


# ---------------------------------------------------------------------------
# The tutor and the routes
# ---------------------------------------------------------------------------


def test_the_block_goes_last_in_the_prompt() -> None:
    block = retrieve.facts_block([GREENS], index())
    prompt = tutor.build_system_prompt(local_scene(), [], block)
    assert prompt.endswith(block) and prompt.index("Scene details:") < prompt.index("Local facts")
    assert tutor.build_system_prompt(local_scene(), []) == prompt[: -len(block) - 2]  # nothing else changes
    assert "Local facts" not in tutor.build_system_prompt(RESTAURANT, [])


def test_generate_reply_sends_the_facts(monkeypatch: pytest.MonkeyPatch) -> None:
    systems: list[str] = []
    reply = CharacterReply(
        learner_hanzi="有没有素菜？", learner_pinyin="Yǒu méiyǒu sùcài?", learner_english="Any vegetarian dishes?",
        goals_done=[], hanzi="有，素炒青菜，二十二块。", pinyin="Yǒu, sù chǎo qīng cài, èrshí'èr kuài.",
        english="Yes, stir-fried greens, 22 yuan.", feedback="", corrected_hanzi="", corrected_pinyin="", suggestions=[],
        scenario_complete=False,
    )

    def parse(**kwargs: Any) -> Any:
        systems.append(kwargs["system"])
        return SimpleNamespace(parsed_output=reply, stop_reason="end_turn")

    monkeypatch.setattr(tutor, "_get_client", lambda: SimpleNamespace(messages=SimpleNamespace(parse=parse)))
    block = retrieve.facts_block([GREENS], index())
    tutor.generate_reply(local_scene(), [], [], "有没有素菜？", local_facts=block)
    assert systems[0].endswith(block)


def _reply() -> TutorReply:
    return TutorReply(
        learner_hanzi="", learner_pinyin="", learner_english="", hanzi="你好！几位？", pinyin="Nǐ hǎo! Jǐ wèi?",
        english="Hello! How many?", feedback="", corrected_hanzi="", corrected_pinyin="", suggestions=[],
        completed_goal_ids=[], scenario_complete=False,
    )


@pytest.fixture
def tutor_calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    calls: list[tuple[str, str]] = []

    def fake_reply(scenario: Any, history: Any, client_completed_ids: Any, learner_text: Any, local_facts: str = "") -> TutorReply:
        calls.append((scenario.id, local_facts))
        return _reply()

    monkeypatch.setattr(tutor, "generate_reply", fake_reply)
    monkeypatch.setattr(speech, "synthesize", lambda text, voice_id=None: b"mp3")
    return calls


def test_a_local_turn_sends_the_facts(
    authed_client: TestClient, chengdu: tuple[CountingStore, ScenarioDefinition], tutor_calls: list[tuple[str, str]]
) -> None:
    _, scene = chengdu
    history = [{"role": "npc", "text": "你好！几位？"}, {"role": "learner", "text": "两位。"}]
    response = authed_client.post("/conversation/turn", json={"scenario_id": scene.id, "history": history, "user_text": "有没有素菜？"})
    assert response.status_code == 200 and response.json()["reply"]["hanzi"] == "你好！几位？"
    played, facts = tutor_calls[0]
    assert played == scene.id and "素炒青菜" in fact_lines(facts)[0]


def test_the_opening_line_and_built_in_scenes_get_no_facts(
    authed_client: TestClient, chengdu: tuple[CountingStore, ScenarioDefinition], tutor_calls: list[tuple[str, str]]
) -> None:
    _, scene = chengdu
    assert authed_client.post("/conversation/start", json={"scenario_id": scene.id}).status_code == 200
    assert authed_client.post("/conversation/turn", json={"scenario_id": "restaurant", "user_text": "有没有素菜？"}).status_code == 200
    assert tutor_calls == [(scene.id, ""), ("restaurant", "")]


def test_a_turn_still_works_when_retrieval_fails(
    authed_client: TestClient,
    chengdu: tuple[CountingStore, ScenarioDefinition],
    tutor_calls: list[tuple[str, str]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store, scene = chengdu
    lookup.find_local_scenario(scene.id)  # the scene itself is cached; only the facts fail

    def down(pack_id: str, categories: list[str] | None = None) -> list[Fact]:
        raise StoreError("Couldn't reach Supabase.")

    monkeypatch.setattr(store, "get_facts", down)
    response = authed_client.post("/conversation/turn", json={"scenario_id": scene.id, "user_text": "有没有素菜？"})
    assert response.status_code == 200 and tutor_calls == [(scene.id, "")]
