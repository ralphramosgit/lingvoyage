import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.lessons import BLANK, BuildExercise, ChoiceExercise
from app.scenarios import SCENARIOS, Character, get_scenario


def test_scenarios_lists_public_fields_only(client: TestClient) -> None:
    response = client.get("/scenarios")
    assert response.status_code == 200
    data = response.json()

    assert [s["id"] for s in data] == ["airport", "restaurant", "train", "hotel", "taxi", "shopping"]
    for scenario in data:
        assert "scene_details" not in scenario
        assert "scene_outline" not in scenario
        assert scenario["language"] == "zh-CN"
        assert len(scenario["goals"]) == 4
        assert len(scenario["key_phrases"]) == 5
        assert set(scenario["character"]) == {"name_hanzi", "name_pinyin", "name_english", "role", "avatar_char", "gender", "age"}


def test_scene_details_stay_on_the_server() -> None:
    restaurant = get_scenario("restaurant")
    assert restaurant is not None
    assert "25 yuan" in restaurant.scene_details
    assert all(s.scene_details for s in SCENARIOS)
    assert all(s.scene_outline for s in SCENARIOS)


def test_every_scenario_has_lessons_with_unique_ids(client: TestClient) -> None:
    for scenario in client.get("/scenarios").json():
        lesson_ids = [lesson["id"] for lesson in scenario["lessons"]]
        assert lesson_ids, scenario["id"]
        assert len(set(lesson_ids)) == len(lesson_ids), scenario["id"]
        for lesson in scenario["lessons"]:
            assert lesson["title"] and lesson["examples"] and lesson["words"]
            assert all(exercise["kind"] in ("choice", "build") for exercise in lesson["exercises"])


def test_lesson_exercises_are_answerable() -> None:
    for scenario in SCENARIOS:
        for lesson in scenario.lessons:
            for exercise in lesson.exercises:
                where = f"{scenario.id}/{lesson.id}: {exercise.prompt}"
                assert exercise.hint, where
                assert BLANK not in exercise.solution.hanzi, where
                if isinstance(exercise, ChoiceExercise):
                    right = exercise.options[exercise.answer]
                    # The blank, filled with the right option, gives the solution.
                    if BLANK in exercise.hanzi:
                        assert exercise.hanzi.replace(BLANK, right.hanzi) == exercise.solution.hanzi, where
                else:
                    assert isinstance(exercise, BuildExercise)
                    assert all(tile.hanzi and tile.pinyin for tile in exercise.tiles + exercise.extra_tiles), where


def test_bad_lesson_content_is_rejected() -> None:
    solution = {"hanzi": "行李在哪里？", "pinyin": "Xíngli zài nǎlǐ?", "english": "Where is my luggage?"}
    with pytest.raises(ValidationError, match="tiles spell"):
        BuildExercise.model_validate(
            {"prompt": "x", "hint": "x", "solution": solution, "tiles": [{"hanzi": "行李", "pinyin": "xíngli"}, {"hanzi": "哪里", "pinyin": "nǎlǐ"}]}
        )
    with pytest.raises(ValidationError, match="not one of the options"):
        ChoiceExercise.model_validate(
            {"prompt": "x", "hint": "x", "solution": solution, "options": [{"english": "a"}, {"english": "b"}], "answer": 2}
        )


def test_voice_matches_the_character() -> None:
    settings = get_settings()
    assert settings.voice_pool("female", "young") == ["woman-1", "woman-2"]
    assert settings.voice_id_for("female", "young", "小林") in {"woman-1", "woman-2"}
    assert settings.voice_id_for("male", "older", "陈经理") == "older-man-1"
    # The same character always gets the same voice.
    assert {settings.voice_id_for("female", "young", "小美") for _ in range(5)} == {settings.voice_id_for("female", "young", "小美")}


def test_voice_keeps_the_gender_when_a_pool_is_empty() -> None:
    settings = get_settings()
    # No older women: an older woman speaks with a young woman's voice, not a man's.
    assert settings.voice_id_for("female", "older", "王阿姨") in {"woman-1", "woman-2"}
    no_men = Settings(elevenlabs_voices_male_young="", elevenlabs_voices_male_older="")
    assert no_men.voice_id_for("male", "young", "李明") == "default-voice"


def test_built_in_characters_have_a_gender_and_age() -> None:
    looks = {s.id: (s.character.gender, s.character.age) for s in SCENARIOS}
    assert looks == {
        "airport": ("female", "young"),
        "restaurant": ("female", "older"),
        "train": ("male", "young"),
        "hotel": ("male", "older"),
        "taxi": ("male", "older"),
        "shopping": ("female", "young"),
    }


def test_older_characters_get_a_gender_and_age_from_their_name() -> None:
    """City packs written before characters had a gender and age."""

    def character(name_hanzi: str, name_english: str, role: str) -> Character:
        return Character.model_validate(
            {"name_hanzi": name_hanzi, "name_pinyin": "", "name_english": name_english, "role": role, "avatar_char": name_hanzi[0]}
        )

    auntie = character("孙大妈", "Auntie Sun", "Stall owner")
    assert (auntie.gender, auntie.age) == ("female", "older")
    driver = character("刘师傅", "Driver Liu", "Taxi driver")
    assert (driver.gender, driver.age) == ("male", "young")
    waitress = character("小美", "Xiao Mei", "Waitress")
    assert (waitress.gender, waitress.age) == ("female", "young")
    # Given ones are kept.
    given = Character.model_validate({**auntie.model_dump(), "gender": "male", "age": "young"})
    assert (given.gender, given.age) == ("male", "young")
