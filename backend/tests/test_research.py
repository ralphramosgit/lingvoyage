import json
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx
import pytest
from anthropic.types.beta import BetaMessage

from app.locations.cities import find_city
from app.locations.models import FactDraft
from app.locations.store import InMemoryPackStore
from app.research import cli, pipeline, prompts, tools, workers
from app.research.briefs import Brief, menu_brief, plan_briefs
from app.research.trace import Trace
from app.research.verify import Verdict, Verdicts, check_facts, judge_facts

CHENGDU = find_city("chengdu")
assert CHENGDU is not None
METRO_URL = "https://www.chengdurail.com/fares"

# ---------------------------------------------------------------------------
# Fakes: real SDK message objects, no network
# ---------------------------------------------------------------------------


def message(*blocks: dict[str, Any], stop: str = "tool_use", searches: int = 0, fetches: int = 0) -> BetaMessage:
    return BetaMessage.model_validate(
        {
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "model": "claude-opus-5-5",
            "content": list(blocks),
            "stop_reason": stop,
            "usage": {
                "input_tokens": 1000,
                "output_tokens": 200,
                "cache_read_input_tokens": 0,
                "cache_creation_input_tokens": 0,
                "server_tool_use": {"web_search_requests": searches, "web_fetch_requests": fetches},
            },
        }
    )


def search(query: str, *urls: str, block_id: str = "srvtoolu_1") -> list[dict[str, Any]]:
    return [
        {"type": "server_tool_use", "id": block_id, "name": "web_search", "input": {"query": query}},
        {
            "type": "web_search_tool_result",
            "tool_use_id": block_id,
            "content": [
                {"type": "web_search_result", "url": url, "title": "A page", "encrypted_content": "abc"} for url in urls
            ],
        },
    ]


def tool_use(name: str, tool_input: dict[str, Any], block_id: str = "toolu_1") -> dict[str, Any]:
    return {"type": "tool_use", "id": block_id, "name": name, "input": tool_input}


def transport_input(**overrides: Any) -> dict[str, Any]:
    fields = {
        "mode": "metro",
        "title": "Metro Line 18 to the airport",
        "body": "Line 18 runs from Tianfu Airport into the city in about 40 minutes.",
        "hanzi": "十八号线",
        "pinyin": "shí bā hào xiàn",
        "line": "18",
        "fare_cny_min": 2,
        "fare_cny_max": 10,
        "source_url": METRO_URL,
    }
    return {**fields, **overrides}


class FakeStream:
    def __init__(self, reply: BetaMessage) -> None:
        self.reply = reply

    def __enter__(self) -> "FakeStream":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def __iter__(self) -> Any:
        return iter(())  # no live events: the worker reads everything from the final message

    def get_final_message(self) -> BetaMessage:
        return self.reply


class FakeClient:
    """Answers stream() calls from a script, and parse() calls (the fact judge) with fixed verdicts."""

    def __init__(self, replies: list[Any] | None = None, verdicts: list[Verdict] | Exception | None = None) -> None:
        self.replies = list(replies or [])
        self.requests: list[dict[str, Any]] = []
        self.verdicts = verdicts if verdicts is not None else []
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))
        self.messages = SimpleNamespace(parse=self._parse)

    def _stream(self, **kwargs: Any) -> FakeStream:
        self.requests.append({**kwargs, "messages": list(kwargs["messages"])})
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(reply, Exception):
            raise reply
        return FakeStream(reply() if callable(reply) else reply)

    def _parse(self, **_: Any) -> Any:
        if isinstance(self.verdicts, Exception):
            raise self.verdicts
        usage = SimpleNamespace(input_tokens=500, output_tokens=50, server_tool_use=None)
        return SimpleNamespace(parsed_output=Verdicts(verdicts=self.verdicts), usage=usage, model="claude-haiku-5-5")


def connection_error() -> anthropic.APIConnectionError:
    return anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"))


@pytest.fixture
def trace() -> Trace:
    store = InMemoryPackStore()
    return Trace(store, store.create_pack("chengdu").id)


def brief(**overrides: Any) -> Brief:
    fields: dict[str, Any] = {
        "worker": "transport",
        "topic": "transport",
        "goal": "How visitors get around.",
        "target": "a few facts",
        "tools": ("record_transport", "record_price", "finish"),
    }
    return Brief(**{**fields, **overrides})


def run(client: FakeClient, trace: Trace, **brief_overrides: Any) -> workers.WorkerResult:
    return workers.run_worker(
        client, brief(**brief_overrides), CHENGDU, trace, "research", model="claude-opus-5-5", effort="medium"
    )


def has_key(value: Any, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(has_key(item, key) for item in value.values())
    if isinstance(value, list):
        return any(has_key(item, key) for item in value)
    return False


# ---------------------------------------------------------------------------
# Briefs and tools
# ---------------------------------------------------------------------------


def test_briefs() -> None:
    assert [item.worker for item in plan_briefs(CHENGDU)] == ["culture", "transport", "hot_spots", "food"]
    assert [item.worker for item in plan_briefs(CHENGDU, ["food"])] == ["food"]
    with pytest.raises(ValueError, match="weather"):
        plan_briefs(CHENGDU, ["weather"])
    assert all(name in tools.SPECS for item in plan_briefs(CHENGDU) for name in item.tools)


def test_tool_schemas_are_strict() -> None:
    for name in tools.SPECS:
        definition = tools.tool_definition(name)
        schema = definition["input_schema"]
        assert definition["strict"] is True
        assert schema["additionalProperties"] is False
        for unsupported in ("maxLength", "minLength", "minimum", "maximum", "maxItems"):
            assert not has_key(schema, unsupported), (name, unsupported)
        if "source_url" in schema["properties"]:
            assert list(schema["properties"])[-3:] == ["source_url", "source_title", "confidence"]


def test_record_saves_a_fact_from_a_page_it_saw(trace: Trace) -> None:
    box = tools.ToolBox(brief(), trace, "research")
    for block in message(*search("Chengdu metro fares", METRO_URL)).content:
        box.see(block)
    result = box.run(SimpleNamespace(id="toolu_1", name="record_transport", input=transport_input()))
    assert result == {"type": "tool_result", "tool_use_id": "toolu_1", "content": result["content"], "is_error": False}
    assert [fact.title for fact in box.facts] == ["Metro Line 18 to the airport"]
    assert box.facts[0].data["fare_cny_max"] == 10
    assert trace.steps[-1]["kind"] == "found" and "¥2–¥10" in trace.steps[-1]["text"]


def test_record_accepts_another_page_on_a_site_it_saw(trace: Trace) -> None:
    box = tools.ToolBox(brief(), trace, "research")
    for block in message(*search("Chengdu metro", METRO_URL)).content:
        box.see(block)
    other_page = "https://chengdurail.com/lines/18/"
    assert not box.run(SimpleNamespace(id="t", name="record_transport", input=transport_input(source_url=other_page)))[
        "is_error"
    ]


@pytest.mark.parametrize(
    ("name", "tool_input", "problem"),
    [
        ("record_transport", transport_input(source_url="https://made-up.example/fares"), "source_url"),
        ("record_transport", transport_input(fare_cny_min=20, fare_cny_max=2), "minimum"),
        ("record_transport", transport_input(title="x" * 81), "title"),
        ("record_transport", transport_input(mode="rocket"), "mode"),
        ("record_hot_spot", {"name": "Panda Base"}, "no tool"),
    ],
)
def test_record_rejects_bad_input(trace: Trace, name: str, tool_input: dict[str, Any], problem: str) -> None:
    box = tools.ToolBox(brief(), trace, "research")
    for block in message(*search("Chengdu metro", METRO_URL)).content:
        box.see(block)
    result = box.run(SimpleNamespace(id="t", name=name, input=tool_input))
    assert result["is_error"] is True and problem in result["content"]
    assert box.facts == []


def test_urls_the_agent_typed_dont_count_as_seen(trace: Trace) -> None:
    box = tools.ToolBox(brief(), trace, "research")
    box.see(message({"type": "text", "text": f"I found {METRO_URL}"}, stop="end_turn").content[0])
    assert not box.has_seen(METRO_URL)
    cited = {
        "type": "text",
        "text": "Line 18 costs ¥10.",
        "citations": [
            {"type": "web_search_result_location", "url": METRO_URL, "title": "Fares", "cited_text": "¥10",
             "encrypted_index": "x"}
        ],
    }
    box.see(message(cited, stop="end_turn").content[0])
    assert box.has_seen(METRO_URL)


def test_duplicates_are_saved_once(trace: Trace) -> None:
    box = tools.ToolBox(brief(), trace, "research")
    for block in message(*search("Chengdu metro", METRO_URL)).content:
        box.see(block)
    box.run(SimpleNamespace(id="a", name="record_transport", input=transport_input()))
    second = box.run(SimpleNamespace(id="b", name="record_transport", input=transport_input(title="metro line 18 to the airport!")))
    assert second["is_error"] is False and "Already saved" in second["content"]
    assert len(box.facts) == 1


def test_menu_items_belong_to_the_briefs_restaurant(trace: Trace) -> None:
    restaurant = FactDraft(
        category="restaurant",
        place_key="chen-mapo-tofu",
        title="Chen Mapo Tofu",
        body="The restaurant that made mapo tofu famous.",
        data={"name": "Chen Mapo Tofu", "name_hanzi": "陈麻婆豆腐", "cuisine": "Sichuan"},
        source_url="https://example.com/chen",
    )
    box = tools.ToolBox(menu_brief(CHENGDU, restaurant), trace, "deep_dive")
    for block in message(*search("Chen Mapo Tofu menu", "https://example.com/chen/menu")).content:
        box.see(block)
    dish = {
        "dish": "Mapo tofu",
        "dish_hanzi": "麻婆豆腐",
        "dish_pinyin": "má pó dòu fu",
        "price_cny": 38,
        "spicy": True,
        "source_url": "https://example.com/chen/menu",
    }
    assert not box.run(SimpleNamespace(id="t", name="record_menu_item", input=dish))["is_error"]
    saved = box.facts[0]
    assert saved.place_key == "chen-mapo-tofu" and saved.body == "On the menu at Chen Mapo Tofu: Mapo tofu (麻婆豆腐), ¥38."


# ---------------------------------------------------------------------------
# The worker loop
# ---------------------------------------------------------------------------


def test_worker_saves_facts_and_finishes(trace: Trace) -> None:
    client = FakeClient(
        [
            message(*search("Chengdu metro fares", METRO_URL), tool_use("record_transport", transport_input()), searches=1),
            message(tool_use("finish", {"summary": "Metro lines and fares", "gaps": ["bike share"]}, "toolu_2")),
        ]
    )
    result = run(client, trace)
    assert (result.stopped, result.summary, result.gaps) == ("finished", "Metro lines and fares", ["bike share"])
    assert len(result.facts) == 1 and result.error is None

    first, second = client.requests
    assert first["model"] == "claude-opus-5-5" and first["system"] == prompts.RESEARCH_SYSTEM
    assert first["betas"] == ["server-side-fallback-2026-07-01"] and first["fallbacks"] == "default"
    assert first["cache_control"] == {"type": "ephemeral"} and first["output_config"] == {"effort": "medium"}
    search_tool = next(tool for tool in first["tools"] if tool.get("name") == "web_search")
    assert search_tool["type"] == "web_search_20260209" and search_tool["user_location"]["city"] == "Chengdu"
    assert [tool["name"] for tool in first["tools"]] == ["web_search", "web_fetch", "record_transport", "record_price", "finish"]

    assert [turn["role"] for turn in second["messages"]] == ["user", "assistant", "user"]
    assert second["messages"][-1]["content"][0]["tool_use_id"] == "toolu_1"
    assert second["messages"][-1]["content"][0]["is_error"] is False
    assert [step["kind"] for step in trace.steps if step.get("worker")] == ["search", "found", "done"]


def test_worker_resumes_a_paused_turn(trace: Trace) -> None:
    client = FakeClient(
        [message(*search("Chengdu metro", METRO_URL), stop="pause_turn"), message(tool_use("finish", {"summary": "ok"}))]
    )
    assert run(client, trace).stopped == "finished"
    assert client.requests[1]["messages"][-1]["role"] == "assistant"  # sent back as is, no "continue" message


def test_worker_stops_at_its_request_cap(trace: Trace) -> None:
    count = iter(range(100))

    def new_fact() -> BetaMessage:
        n = next(count)
        return message(*search("metro", METRO_URL, block_id=f"s{n}"), tool_use("record_transport", transport_input(title=f"Line {n}"), f"t{n}"))

    result = run(FakeClient([new_fact]), trace, max_iterations=3)
    assert result.stopped == "max_iterations" and len(result.facts) == 3


def test_worker_stops_at_its_time_limit(trace: Trace) -> None:
    now = iter(float(seconds) for seconds in range(0, 1000, 100))
    reply = message(*search("metro", METRO_URL), tool_use("record_price", {"item": "metro ride", "price_cny_min": 2, "price_cny_max": 10, "source_url": METRO_URL}))
    result = workers.run_worker(
        FakeClient([reply]), brief(time_limit_seconds=150), CHENGDU, trace, "research",
        model="claude-opus-5-5", effort="medium", clock=lambda: next(now),
    )
    assert result.stopped == "time_limit" and len(result.facts) == 1


def test_worker_wraps_up_at_its_search_budget(trace: Trace) -> None:
    counter = iter(range(100))

    def busy() -> BetaMessage:
        n = next(counter)
        return message(*search("metro", METRO_URL, block_id=f"s{n}"), tool_use("record_transport", transport_input(title=f"Line {n}"), f"t{n}"), searches=2)

    client = FakeClient([busy])
    result = run(client, trace, max_searches=2)
    assert client.requests[1]["messages"][-1]["content"][-1] == {"type": "text", "text": prompts.BUDGET_NOTE}
    assert result.stopped == "search_budget" and len(result.facts) == 2


def test_worker_keeps_its_facts_when_claude_fails(trace: Trace) -> None:
    client = FakeClient([message(*search("metro", METRO_URL), tool_use("record_transport", transport_input())), connection_error()])
    result = run(client, trace)
    assert (result.stopped, result.error, len(result.facts)) == ("error", "claude_unavailable", 1)
    assert trace.steps[-1]["kind"] == "error"


def test_worker_ends_when_the_agent_stops_calling_tools(trace: Trace) -> None:
    result = run(FakeClient([message({"type": "text", "text": "That's all I found."}, stop="end_turn")]), trace)
    assert result.stopped == "end_turn" and result.facts == []


# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------


def fact(**overrides: Any) -> FactDraft:
    fields: dict[str, Any] = {
        "category": "transport",
        "title": "Metro Line 18",
        "body": "To the airport.",
        "data": {"mode": "metro", "fare_cny_min": 2, "fare_cny_max": 10},
        "source_url": METRO_URL,
    }
    return FactDraft.model_validate({**fields, **overrides})


def test_check_facts() -> None:
    low, high = fact(confidence="low"), fact(title="Metro line 18!", confidence="high")
    pricey_metro = fact(title="Metro Line 1", data={"mode": "metro", "fare_cny_max": 80})
    orphan = fact(
        category="menu_item",
        place_key="nowhere",
        title="Noodles",
        data={"dish": "Noodles", "dish_hanzi": "面", "dish_pinyin": "miàn"},
    )
    kept, dropped = check_facts([low, high, pricey_metro, orphan])
    assert kept == [high]
    assert sorted(reason.split(":")[0] for _, reason in dropped) == [
        "duplicate",
        "implausible",
        "its restaurant wasn't recorded",
    ]


def test_judge_drops_and_lowers(trace: Trace) -> None:
    facts = [fact(title="A", confidence="high"), fact(title="B", confidence="high"), fact(title="C")]
    verdicts = [Verdict(number=1, decision="drop", reason="ad"), Verdict(number=2, decision="lower_confidence", reason="old")]
    kept, dropped, lowered = judge_facts(FakeClient(verdicts=verdicts), "claude-haiku-5-5", CHENGDU, facts, trace)
    assert [(item.title, item.confidence) for item in kept] == [("B", "medium"), ("C", "medium")]
    assert (dropped, lowered) == (1, 1)


def test_judge_failure_keeps_everything(trace: Trace) -> None:
    facts = [fact(title="A"), fact(title="B")]
    kept, dropped, lowered = judge_facts(FakeClient(verdicts=connection_error()), "claude-haiku-5-5", CHENGDU, facts, trace)
    assert kept == facts and (dropped, lowered) == (0, 0)


# ---------------------------------------------------------------------------
# The pipeline
# ---------------------------------------------------------------------------

RESTAURANT = {
    "category": "restaurant",
    "place_key": "chen-mapo-tofu",
    "title": "Chen Mapo Tofu",
    "body": "Famous for mapo tofu.",
    "hanzi": "陈麻婆豆腐",
    "data": {"name": "Chen Mapo Tofu", "name_hanzi": "陈麻婆豆腐", "cuisine": "Sichuan", "price_per_person_cny": 60},
    "source_url": "https://example.com/chen",
}
DISH = {
    "category": "menu_item",
    "place_key": "chen-mapo-tofu",
    "title": "Mapo tofu",
    "body": "On the menu.",
    "data": {"dish": "Mapo tofu", "dish_hanzi": "麻婆豆腐", "dish_pinyin": "má pó dòu fu", "price_cny": 38},
    "source_url": "https://example.com/chen/menu",
}


def fake_workers(monkeypatch: pytest.MonkeyPatch, facts_by_topic: dict[str, list[dict[str, Any]]], failing: set[str] = frozenset()) -> list[str]:
    seen: list[str] = []

    def fake_run_worker(client: Any, worker_brief: Brief, city: Any, worker_trace: Trace, stage: str, **_: Any) -> workers.WorkerResult:
        seen.append(worker_brief.worker)
        if worker_brief.topic in failing:
            return workers.WorkerResult(worker_brief, [], stopped="error", error="claude_unavailable")
        found = [FactDraft.model_validate(item) for item in facts_by_topic.get(worker_brief.topic, [])]
        return workers.WorkerResult(worker_brief, found, summary="done", stopped="finished")

    monkeypatch.setattr(workers, "run_worker", fake_run_worker)
    return seen


def test_pipeline_builds_a_pack(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = fake_workers(monkeypatch, {"transport": [fact().model_dump()], "food": [RESTAURANT], "menu": [DISH]})
    store = InMemoryPackStore()
    report = pipeline.run_pack("chengdu", store, client=FakeClient())  # type: ignore[arg-type]

    assert report.status == "ready" and report.error is None
    assert sorted(seen[:4]) == ["culture", "food", "hot_spots", "transport"]  # in parallel, so in any order
    assert seen[4:] == ["menu:chen-mapo-tofu"]  # the deep dive starts once they've all finished
    pack = store.get_live_pack("chengdu")
    assert pack is not None and pack.id == report.pack_id
    assert sorted(item.category for item in store.get_facts(pack.id)) == ["menu_item", "restaurant", "transport"]
    stages = [step["stage"] for step in pack.trace if step["kind"] == "stage"]
    assert stages == ["plan", "research", "deep_dive", "verify", "publish"]
    assert set(pack.usage["seconds"]) == set(stages) and "cost_usd_estimate" in pack.usage


def test_pipeline_fails_when_nothing_is_found(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_workers(monkeypatch, {}, failing={"culture", "transport", "hot_spots", "food"})
    store = InMemoryPackStore()
    report = pipeline.run_pack("chengdu", store, client=FakeClient())  # type: ignore[arg-type]
    pack = store.get_pack(report.pack_id)
    assert (report.status, report.error) == ("failed", "research_failed")
    assert pack is not None and pack.status == "failed" and pack.error == "research_failed"
    assert store.get_active_run("chengdu") is None  # the city is free for another run


def test_pipeline_survives_one_failed_worker(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_workers(monkeypatch, {"transport": [fact().model_dump()]}, failing={"food"})
    report = pipeline.run_pack("chengdu", InMemoryPackStore(), client=FakeClient(), deep_dive=False)  # type: ignore[arg-type]
    assert report.status == "ready" and len(report.facts) == 1


def test_pipeline_fills_a_queued_pack(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_workers(monkeypatch, {"transport": [fact().model_dump()]})
    store = InMemoryPackStore()
    queued = store.create_pack("chengdu", requested_by="user-123")
    report = pipeline.run_pack("chengdu", store, client=FakeClient(), pack_id=queued.id, topics=["transport"])  # type: ignore[arg-type]
    assert report.pack_id == queued.id and report.status == "ready"


# ---------------------------------------------------------------------------
# Trace and command line
# ---------------------------------------------------------------------------


def test_trace_saves_every_few_seconds_and_keeps_the_last_steps() -> None:
    now = [0.0]
    store = InMemoryPackStore()
    pack = store.create_pack("chengdu")
    trace = Trace(store, pack.id, clock=lambda: now[0])
    for n in range(250):
        trace.step("research", "search", f"query {n}")
    stored = store.get_pack(pack.id)
    assert stored is not None and stored.trace == []  # not saved yet: under 3 seconds
    now[0] = 5.0
    trace.step("research", "search", "one more")
    stored = store.get_pack(pack.id)
    assert stored is not None and len(stored.trace) == 200 and stored.trace[-1]["text"] == "one more"


def test_trace_estimates_cost(trace: Trace) -> None:
    usage = SimpleNamespace(input_tokens=1_000_000, output_tokens=100_000, cache_read_input_tokens=0,
                            cache_creation_input_tokens=0, server_tool_use=SimpleNamespace(web_search_requests=10, web_fetch_requests=3))
    assert trace.add_usage("claude-opus-5-5", usage) == 10
    totals = trace.usage()
    assert totals["web_search_requests"] == 10 and totals["web_fetch_requests"] == 3
    assert totals["cost_usd_estimate"] == pytest.approx(4.00 + 2.00 + 0.10)


def test_cli_dry_run(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    fake_workers(monkeypatch, {"transport": [fact().model_dump()]})
    monkeypatch.setattr(pipeline, "get_client", lambda: FakeClient())
    assert cli.main(["chengdu", "--dry-run", "--topics", "transport"]) == 0
    out = capsys.readouterr().out
    assert "Chengdu pack: ready" in out and "Estimated cost" in out
    assert json.loads(out[out.index("{"):])["facts"][0]["title"] == "Metro Line 18"


def test_quick_run_is_one_small_worker(monkeypatch: pytest.MonkeyPatch) -> None:
    caps: list[Brief] = []

    def fake_run_worker(client: Any, worker_brief: Brief, *_: Any, **__: Any) -> workers.WorkerResult:
        caps.append(worker_brief)
        return workers.WorkerResult(worker_brief, [fact()], stopped="finished")

    monkeypatch.setattr(workers, "run_worker", fake_run_worker)
    report = pipeline.run_pack("chengdu", InMemoryPackStore(), client=FakeClient(), quick=True)  # type: ignore[arg-type]
    assert report.status == "ready"
    assert [(item.worker, item.max_iterations, item.max_searches) for item in caps] == [("transport", 3, 2)]


def test_cli_rejects_an_unknown_city(capsys: pytest.CaptureFixture[str]) -> None:
    assert cli.main(["tokyo"]) == 2
    assert "Unknown city" in capsys.readouterr().out
