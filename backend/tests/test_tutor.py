from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app import tutor
from app.scenarios import get_scenario
from app.tutor import (
    OPENING_MESSAGE,
    CharacterReply,
    ChatLine,
    Phrase,
    asks_travelers_question,
    build_messages,
    build_system_prompt,
    drop_asked_questions,
    ending_problems,
    finalize_reply,
    generate_reply,
    is_closing,
    line_problems,
    merge_goal_ids,
    question_count,
    strip_emojis,
    yes_no_questions,
)


def _scenario(scenario_id: str = "restaurant"):
    scenario = get_scenario(scenario_id)
    assert scenario is not None
    return scenario


def _reply(**overrides: object) -> CharacterReply:
    values: dict[str, object] = {
        "learner_hanzi": "",
        "learner_pinyin": "",
        "learner_english": "",
        "goals_done": [],
        "hanzi": "好的。",
        "pinyin": "Hǎo de.",
        "english": "Okay.",
        "feedback": "",
        "corrected_hanzi": "",
        "corrected_pinyin": "",
        "suggestions": [Phrase(hanzi=f"句子{i}", pinyin="jùzi", english="sentence") for i in range(5)],
        "scenario_complete": False,
    }
    values.update(overrides)
    return CharacterReply.model_validate(values)


# --- emoji stripping -------------------------------------------------------


def test_strip_emojis_removes_emoji_and_keeps_chinese_and_pinyin() -> None:
    assert strip_emojis("你好！\U0001f60a 欢迎光临 \U0001f35c") == "你好！ 欢迎光临"
    assert strip_emojis("Great job! \U0001f44d\U0001f3fd") == "Great job!"
    assert strip_emojis("Nǐ hǎo, huānyíng guānglín!") == "Nǐ hǎo, huānyíng guānglín!"
    assert strip_emojis("Well done \u2764\ufe0f \u2b50") == "Well done"
    assert strip_emojis("\U0001f1e8\U0001f1f3 中国") == "中国"
    assert strip_emojis("我叫……，请问？") == "我叫……，请问？"


def test_finalize_strips_emojis_from_every_string() -> None:
    reply = _reply(
        learner_hanzi="两位\U0001f44b",
        learner_pinyin="liǎng wèi \U0001f44b",
        learner_english="Two people \U0001f44b",
        hanzi="你好\U0001f60a",
        pinyin="Nǐ hǎo \U0001f60a",
        english="Hello \U0001f44b",
        feedback="Nice \U0001f389",
        corrected_hanzi="两位\U0001f60a",
        corrected_pinyin="liǎng wèi \u2728",
        suggestions=[Phrase(hanzi="谢谢\U0001f64f", pinyin="xièxie \U0001f64f", english="Thanks \U0001f64f")],
    )
    result = finalize_reply(reply, _scenario(), [])
    assert result.learner_hanzi == "两位"
    assert result.learner_pinyin == "liǎng wèi"
    assert result.learner_english == "Two people"
    assert result.hanzi == "你好"
    assert result.pinyin == "Nǐ hǎo"
    assert result.english == "Hello"
    assert result.feedback == "Nice"
    assert result.corrected_hanzi == "两位"
    assert result.corrected_pinyin == "liǎng wèi"
    assert result.suggestions[0] == Phrase(hanzi="谢谢", pinyin="xièxie", english="Thanks")


# --- history normalization -------------------------------------------------


def test_build_messages_starts_with_scene_cue_and_maps_roles() -> None:
    history = [ChatLine(role="npc", text="你好！几位？"), ChatLine(role="learner", text="两位")]
    messages = build_messages(history, "我要牛肉面")
    assert messages == [
        {"role": "user", "content": OPENING_MESSAGE},
        {"role": "assistant", "content": "你好！几位？"},
        {"role": "user", "content": "两位\n我要牛肉面"},
    ]


def test_build_messages_for_opening_line() -> None:
    assert build_messages([], None) == [{"role": "user", "content": OPENING_MESSAGE}]


def test_build_messages_merges_consecutive_same_role() -> None:
    history = [
        ChatLine(role="learner", text="hello"),
        ChatLine(role="npc", text="你好！"),
        ChatLine(role="npc", text="几位？"),
        ChatLine(role="learner", text=" "),
    ]
    messages = build_messages(history, "liang wei")
    roles = [m["role"] for m in messages]
    assert roles == ["user", "assistant", "user"]
    assert messages[0]["content"] == f"{OPENING_MESSAGE}\nhello"
    assert messages[1]["content"] == "你好！\n几位？"
    assert messages[2]["content"] == "liang wei"


def test_build_messages_keeps_only_last_30_lines() -> None:
    history = [ChatLine(role="npc" if i % 2 == 0 else "learner", text=f"line {i}") for i in range(40)]
    messages = build_messages(history, None)
    contents = "\n".join(str(m["content"]) for m in messages)
    assert "line 9\n" not in contents and not contents.endswith("line 9")
    assert "line 10" in contents
    assert "line 39" in contents
    # cue + 30 alternating lines (line 10 is npc -> assistant)
    assert len(messages) == 31


# --- goals -----------------------------------------------------------------


def test_goal_ids_are_filtered_and_unioned_in_scenario_order() -> None:
    scenario = _scenario()
    reply = _reply(goals_done=["order_dish", "made_up_goal", "party_size"])
    result = finalize_reply(reply, scenario, client_completed_ids=["pay", "also_fake"])
    assert result.completed_goal_ids == ["party_size", "order_dish", "pay"]


def test_client_goals_are_kept_even_if_model_forgets_them() -> None:
    result = finalize_reply(_reply(goals_done=[]), _scenario(), ["party_size"])
    assert result.completed_goal_ids == ["party_size"]


def test_merge_goal_ids_ignores_other_scenarios_goals() -> None:
    assert merge_goal_ids(_scenario("hotel"), ["wifi", "pay"]) == ["wifi"]


def test_scenario_complete_requires_every_goal() -> None:
    scenario = _scenario()
    premature = finalize_reply(_reply(goals_done=["party_size"], scenario_complete=True), scenario, [])
    assert premature.scenario_complete is False

    done = finalize_reply(
        _reply(goals_done=["order_dish", "special_request", "pay"], scenario_complete=True),
        scenario,
        ["party_size"],
    )
    assert done.scenario_complete is True


def test_the_scene_ends_on_a_goodbye_not_a_question() -> None:
    every_goal = ["party_size", "order_dish", "special_request", "pay"]
    closing = finalize_reply(_reply(hanzi="好！还需要什么？", scenario_complete=True), _scenario(), every_goal)
    assert closing.scenario_complete is False
    goodbye = finalize_reply(_reply(hanzi="不客气！再见！", scenario_complete=False), _scenario(), every_goal)
    assert goodbye.scenario_complete is True


def test_suggestions_trimmed_to_three() -> None:
    result = finalize_reply(_reply(), _scenario(), [])
    assert len(result.suggestions) == 3
    assert result.suggestions[0].hanzi == "句子0"


# --- prompt ----------------------------------------------------------------


def test_system_prompt_includes_scene_goals_and_progress() -> None:
    prompt = build_system_prompt(_scenario("train"), ["ask_politely"])
    assert "李明 (Lǐ Míng)" in prompt
    assert "Shanghai Hongqiao Railway Station" in prompt
    assert "B12" in prompt
    assert "- [departure_time] Ask when the train to Hangzhou leaves" in prompt
    assert "Goals already completed: ask_politely" in prompt
    assert "Never use emojis" in prompt
    assert '"learner_hanzi"' in prompt and '"learner_english"' in prompt


def test_system_prompt_names_the_next_goal_and_the_ones_after_it() -> None:
    prompt = build_system_prompt(_scenario("restaurant"), ["party_size"])
    assert "Next goal, the one to lead to now: [order_dish] Order a dish\n" in prompt
    assert "After it, in order: [special_request] Ask for no spice or order a drink; then [pay] Ask for the bill\n" in prompt
    assert "Ask the question whose answer does the next goal" in prompt

    last = build_system_prompt(_scenario("restaurant"), ["party_size", "order_dish", "special_request"])
    assert "Next goal, the one to lead to now: [pay] Ask for the bill\nIt's the last one.\n" in last

    done = build_system_prompt(_scenario("restaurant"), ["party_size", "order_dish", "special_request", "pay"])
    assert "Next goal: none, every goal is done. Close the scene (rule 5).\n" in done


def test_system_prompt_asks_one_open_question_and_suggestions_that_fit_it() -> None:
    prompt = build_system_prompt(_scenario("restaurant"), [])
    assert "end every reply with exactly one short, easy question, and ask nothing else" in prompt
    assert "never two (not 好！你要哪个？喝什么？)" in prompt
    assert "never a yes/no question (…吗？, …吧？, 要不要, 有没有, 好吗)" in prompt
    assert "invite their question without answering it: 你找什么？ 你还想知道什么？" in prompt
    assert "never tell them something a goal still to do has them ask you" in prompt
    assert "Every one must make sense said right now: an answer to your question" in prompt
    assert "Never suggest just yes or no, a goal they've already done" in prompt


def test_system_prompt_flags_yes_no_questions_in_older_scripts() -> None:
    old = _scenario("airport").model_copy(
        update={"scene_outline": ["You open: 你好！你要去哪儿？", "The traveler asks where the subway is. You: 地铁在前面。 Then ask: 你要买票吗？"]}
    )
    prompt = build_system_prompt(old, [])
    assert "1. You open: 你好！你要去哪儿？\n" in prompt
    step = "2. The traveler asks where the subway is. You: 地铁在前面。 Then ask: [an open or choice question that leads to the next goal]"
    assert step in prompt and "你要买票吗" not in prompt
    # The hand-written scripts ask open questions, so they're given as written.
    airport = _scenario("airport")
    assert all(step in build_system_prompt(airport, []) for step in airport.scene_outline)


def test_system_prompt_closes_the_scene_only_after_the_goals() -> None:
    prompt = build_system_prompt(_scenario("airport"), [])
    assert "Never say goodbye while a goal is still to do" in prompt
    assert "When the traveler's last message did the last goal, answer it, then ask one closing question (还需要什么？)" in prompt


def test_system_prompt_follows_the_script_and_keeps_roles_apart() -> None:
    prompt = build_system_prompt(_scenario("airport"), [])
    assert "1. You open: 你好！欢迎来成都！你找什么？" in prompt
    assert "Then ask: 你要去哪里？" in prompt
    assert "巴士在五号门外面。" in prompt
    assert "Never jump ahead (don't ask about spice, drinks or a second dish before they've ordered" in prompt
    assert "offer two or three real options by name from the scene details" in prompt
    assert "never just 在那里 on its own" in prompt
    assert "- [place] + 在哪里？ (Where is [place]?)" in prompt
    assert "don't use them to ask the traveler anything" in prompt
    assert "never ask the traveler the questions that are theirs to ask you" in prompt
    assert "行李 xíngli (luggage)" in prompt
    assert prompt.count("哪里 nǎlǐ (where)") == 1


def test_script_never_gives_the_character_a_travelers_question() -> None:
    for scenario_id in ("airport", "restaurant", "train", "hotel"):
        scenario = _scenario(scenario_id)
        for step in scenario.scene_outline:
            # Only the part after "You" is the character's line.
            yours = step.split("You:", 1)[-1] if "You:" in step else step.split("You open:", 1)[-1]
            assert asks_travelers_question(scenario, yours) is None, (scenario_id, step)
            # The script is what the character copies: one question per line there too.
            assert question_count(yours) <= 1, (scenario_id, step)


# --- role check -------------------------------------------------------------


def test_asks_travelers_question_spots_the_learners_lines() -> None:
    airport = _scenario("airport")
    assert asks_travelers_question(airport, "好！你的行李在哪里？") == "行李在哪里？"
    assert asks_travelers_question(airport, "好。巴士在哪里？") == "巴士在哪里？"
    assert asks_travelers_question(airport, "巴士在那里。") is None
    assert asks_travelers_question(airport, "你找行李吗？") is None
    assert asks_travelers_question(airport, "不客气！你要去哪里？") is None

    hotel = _scenario("hotel")
    assert asks_travelers_question(hotel, "WiFi密码是多少？") == "WiFi 密码是多少？"
    assert asks_travelers_question(hotel, "早餐七点到十点。") is None

    train = _scenario("train")
    assert asks_travelers_question(train, "去杭州的火车下午三点半出发。") is None


def test_suggestions_drop_questions_the_learner_already_asked() -> None:
    airport = _scenario("airport")
    suggestions = [
        Phrase(hanzi="我要去熊猫酒店。", pinyin="", english=""),
        Phrase(hanzi="我的行李在哪里？", pinyin="", english=""),
        Phrase(hanzi="巴士在哪里？", pinyin="", english=""),
    ]
    kept = drop_asked_questions(airport, suggestions, ["你好", "行李 在哪里?"])
    assert [phrase.hanzi for phrase in kept] == ["我要去熊猫酒店。", "巴士在哪里？"]
    assert drop_asked_questions(airport, suggestions, []) == suggestions


def test_generate_reply_drops_suggestions_already_asked(monkeypatch: pytest.MonkeyPatch) -> None:
    suggestions = [Phrase(hanzi="我要去酒店。", pinyin="", english=""), Phrase(hanzi="行李在哪里？", pinyin="", english="")]
    client = _FakeClient(_reply(hanzi="你的行李在三号转盘。你要去哪里？", suggestions=suggestions))
    _use_client(monkeypatch, client)
    history = [ChatLine(role="npc", text="你找什么？")]
    reply = generate_reply(_scenario("airport"), history, [], "行李在哪里？")
    assert [phrase.hanzi for phrase in reply.suggestions] == ["我要去酒店。"]


def test_question_count_counts_each_question_once() -> None:
    assert question_count("你好！几位？") == 1
    assert question_count("好！你坐巴士还是滴滴？") == 1
    assert question_count("真的吗？？") == 1
    assert question_count("好！要辣吗？喝什么？") == 2
    assert question_count("Hǎo! Is that ok? 好吗？") == 2
    assert question_count("不客气！再见！") == 0


def test_line_problems_finds_a_role_swap_and_a_second_question() -> None:
    airport = _scenario("airport")
    assert line_problems(airport, "你的行李在三号转盘。你要去哪里？") == []
    assert len(line_problems(airport, "好。巴士在哪里？")) == 1
    assert len(line_problems(airport, "你好！你找什么？你要去哪里？")) == 1
    assert len(line_problems(airport, "好！你要去哪里？巴士在哪里？")) == 2


def test_line_problems_finds_coaching() -> None:
    train = _scenario("train")
    for line in ("你可以说：我有票。", "你可以问几点出发。", "好，你想问多少钱，还是多长时间？"):
        assert len(line_problems(train, line)) == 1, line
    # Asked as yes/no questions, these are coaching and yes/no both.
    for line in ("好的。你要问几点出发吗？", "门票多少钱，你想问吗？", "好！你想知道多少钱吗？"):
        assert len(line_problems(train, line)) == 2, line
    for line in ("你想问什么？", "你要去哪里？", "你还想知道什么？"):
        assert line_problems(train, line) == [], line


def test_yes_no_questions() -> None:
    for line in ("你要找检票口吗？", "地铁在前面。你要买票吗？", "要不要辣？", "是十号线吧？", "有没有行李？", "好吗?"):
        assert yes_no_questions(line), line
    for line in ("你要去哪里？", "你坐巴士还是滴滴？", "要辣的还是不辣的？", "几位？", "你的护照呢？", "你找什么？", "不客气！再见！"):
        assert yes_no_questions(line) == [], line
    assert yes_no_questions("好！要辣吗？喝什么？") == ["要辣吗？"]


def test_line_problems_finds_a_yes_no_question_except_when_closing() -> None:
    airport = _scenario("airport")
    problems = line_problems(airport, "地铁在前面。你要买票吗？")
    assert len(problems) == 1 and '"你要买票吗？" can be answered with just yes or no' in problems[0]
    assert line_problems(airport, "不客气。还需要什么吗？", closing=True) == []


def test_the_scene_is_closing_once_only_a_thank_you_is_left() -> None:
    airport = _scenario("airport")
    assert is_closing(airport, ["find_luggage", "destination", "find_ride"])  # left: "Say thank you"
    assert not is_closing(airport, ["find_luggage", "destination"])
    assert is_closing(_scenario("hotel"), ["reservation", "name_passport", "breakfast", "wifi"])
    assert not is_closing(_scenario("hotel"), ["reservation", "name_passport", "breakfast"])


def test_ending_problems() -> None:
    airport = _scenario("airport")
    every_goal = airport.goal_ids
    # Goodbye with goals still to do.
    early = ending_problems(airport, "不客气！再见！", ["find_luggage"], ["find_luggage", "thanks"], "谢谢")
    assert len(early) == 1 and 'next: "Say where you want to go"' in early[0]
    # Goodbye straight after the last goal, before the traveler could thank the character.
    abrupt = ending_problems(airport, "巴士在五号门外面。再见！", every_goal[:3], every_goal, "巴士在哪里？")
    assert len(abrupt) == 1 and "还需要什么？" in abrupt[0]
    # Fine: they thanked, or every goal was already done, or it isn't a goodbye.
    assert ending_problems(airport, "不客气！再见！", every_goal[:3], every_goal, "xièxie!") == []
    assert ending_problems(airport, "好的，再见！", every_goal, every_goal, "没有了") == []
    assert ending_problems(airport, "巴士在五号门外面。还需要什么？", every_goal[:2], every_goal[:3], "巴士在哪里？") == []


class _FakeClient:
    """Stands in for anthropic.Anthropic: hands out queued replies (or errors) and records the calls."""

    def __init__(self, *results: CharacterReply | Exception) -> None:
        self.results = list(results)
        self.systems: list[str] = []
        self.messages = SimpleNamespace(parse=self._parse)

    def _parse(self, **kwargs: object) -> SimpleNamespace:
        self.systems.append(str(kwargs["system"]))
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return SimpleNamespace(parsed_output=result, stop_reason="end_turn")


def _use_client(monkeypatch: pytest.MonkeyPatch, client: _FakeClient) -> None:
    monkeypatch.setattr(tutor, "_get_client", lambda: client)


def test_role_swap_is_asked_again(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(_reply(hanzi="好。巴士在哪里？"), _reply(hanzi="好。你坐巴士还是滴滴？"))
    _use_client(monkeypatch, client)
    reply = generate_reply(_scenario("airport"), [], [], "我要去酒店。")
    assert reply.hanzi == "好。你坐巴士还是滴滴？"
    assert len(client.systems) == 2
    assert '"好。巴士在哪里？"' in client.systems[1]
    assert '"好。巴士在哪里？"' not in client.systems[0]


def test_normal_reply_is_not_asked_again(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(_reply(hanzi="在那里。"))
    _use_client(monkeypatch, client)
    assert generate_reply(_scenario("airport"), [], [], "行李在哪里？").hanzi == "在那里。"
    assert len(client.systems) == 1


def test_first_reply_is_kept_if_asking_again_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    client = _FakeClient(_reply(hanzi="巴士在哪里？"), anthropic.APITimeoutError(request=request))
    _use_client(monkeypatch, client)
    assert generate_reply(_scenario("airport"), [], [], "我要去酒店。").hanzi == "巴士在哪里？"
    assert len(client.systems) == 2


def test_first_reply_is_kept_if_the_second_swaps_too(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(_reply(hanzi="巴士在哪里？"), _reply(hanzi="行李在哪里？"))
    _use_client(monkeypatch, client)
    assert generate_reply(_scenario("airport"), [], [], "你好").hanzi == "巴士在哪里？"


def test_two_questions_are_asked_again(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(_reply(hanzi="好！要辣的还是不辣的？喝什么？"), _reply(hanzi="好！要辣的还是不辣的？"))
    _use_client(monkeypatch, client)
    reply = generate_reply(_scenario("restaurant"), [], ["party_size"], "我要一碗牛肉面。")
    assert reply.hanzi == "好！要辣的还是不辣的？"
    assert len(client.systems) == 2
    assert '"好！要辣的还是不辣的？喝什么？"' in client.systems[1]
    assert "It asks 2 questions; ask only one." in client.systems[1]


def test_first_reply_is_kept_if_the_second_is_no_better(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(_reply(hanzi="好！你要哪个？喝什么？"), _reply(hanzi="几位？你要哪个？"))
    _use_client(monkeypatch, client)
    assert generate_reply(_scenario("restaurant"), [], [], "你好").hanzi == "好！你要哪个？喝什么？"


def test_a_yes_no_question_is_asked_again(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(_reply(hanzi="地铁在前面。你要买票吗？"), _reply(hanzi="地铁在前面。你还想知道什么？"))
    _use_client(monkeypatch, client)
    reply = generate_reply(_scenario("airport"), [], ["find_luggage"], "我要去酒店。")
    assert reply.hanzi == "地铁在前面。你还想知道什么？"
    assert "can be answered with just yes or no" in client.systems[1]


def test_an_early_goodbye_is_asked_again(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(
        _reply(hanzi="不客气！再见！", goals_done=["thanks"], scenario_complete=True),
        _reply(hanzi="不客气！你要去哪里？", goals_done=["thanks"]),
    )
    _use_client(monkeypatch, client)
    reply = generate_reply(_scenario("airport"), [], ["find_luggage"], "谢谢！")
    assert reply.hanzi == "不客气！你要去哪里？"
    assert reply.completed_goal_ids == ["find_luggage", "thanks"] and reply.scenario_complete is False
    assert "That says goodbye, but the traveler hasn't done every goal yet" in client.systems[1]


def test_goals_are_judged_on_the_last_message_and_added_to_the_earlier_ones(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _FakeClient(_reply(hanzi="好！哪个酒店？", goals_done=["destination"]))
    _use_client(monkeypatch, client)
    reply = generate_reply(_scenario("airport"), [], ["find_luggage"], "我要去酒店。")
    assert reply.completed_goal_ids == ["find_luggage", "destination"]
    assert "Next goal, the one to lead to now: [destination] Say where you want to go" in client.systems[0]


def test_system_prompt_knows_the_traveler_is_already_in_the_city() -> None:
    prompt = build_system_prompt(_scenario("airport"), [])
    assert "The traveler is already in Chengdu: never ask if they want to go to Chengdu" in prompt
    assert "said just yes or no (要, 对, 好), greeted you, or picked an option" in prompt


def test_system_prompt_with_no_progress_says_none() -> None:
    assert "Goals already completed: none" in build_system_prompt(_scenario("hotel"), [])
