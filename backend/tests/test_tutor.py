from app.scenarios import get_scenario
from app.tutor import (
    OPENING_MESSAGE,
    ChatLine,
    Phrase,
    TutorReply,
    build_messages,
    build_system_prompt,
    finalize_reply,
    merge_goal_ids,
    strip_emojis,
)


def _scenario(scenario_id: str = "restaurant"):
    scenario = get_scenario(scenario_id)
    assert scenario is not None
    return scenario


def _reply(**overrides: object) -> TutorReply:
    values: dict[str, object] = {
        "hanzi": "好的。",
        "pinyin": "Hǎo de.",
        "english": "Okay.",
        "feedback": "",
        "corrected_hanzi": "",
        "corrected_pinyin": "",
        "suggestions": [Phrase(hanzi=f"句子{i}", pinyin="jùzi", english="sentence") for i in range(5)],
        "completed_goal_ids": [],
        "scenario_complete": False,
    }
    values.update(overrides)
    return TutorReply.model_validate(values)


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
        hanzi="你好\U0001f60a",
        pinyin="Nǐ hǎo \U0001f60a",
        english="Hello \U0001f44b",
        feedback="Nice \U0001f389",
        corrected_hanzi="两位\U0001f60a",
        corrected_pinyin="liǎng wèi \u2728",
        suggestions=[Phrase(hanzi="谢谢\U0001f64f", pinyin="xièxie \U0001f64f", english="Thanks \U0001f64f")],
    )
    result = finalize_reply(reply, _scenario(), [])
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
    reply = _reply(completed_goal_ids=["order_dish", "made_up_goal", "party_size"])
    result = finalize_reply(reply, scenario, client_completed_ids=["pay", "also_fake"])
    assert result.completed_goal_ids == ["party_size", "order_dish", "pay"]


def test_client_goals_are_kept_even_if_model_forgets_them() -> None:
    result = finalize_reply(_reply(completed_goal_ids=[]), _scenario(), ["party_size"])
    assert result.completed_goal_ids == ["party_size"]


def test_merge_goal_ids_ignores_other_scenarios_goals() -> None:
    assert merge_goal_ids(_scenario("hotel"), ["wifi", "pay"]) == ["wifi"]


def test_scenario_complete_requires_every_goal() -> None:
    scenario = _scenario()
    premature = finalize_reply(_reply(completed_goal_ids=["party_size"], scenario_complete=True), scenario, [])
    assert premature.scenario_complete is False

    done = finalize_reply(
        _reply(completed_goal_ids=["order_dish", "special_request", "pay"], scenario_complete=True),
        scenario,
        ["party_size"],
    )
    assert done.scenario_complete is True


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


def test_system_prompt_with_no_progress_says_none() -> None:
    assert "Goals already completed: none" in build_system_prompt(_scenario("hotel"), [])
