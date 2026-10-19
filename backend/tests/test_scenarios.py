import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import get_settings
from app.lessons import BLANK, BuildExercise, ChoiceExercise
from app.scenarios import SCENARIOS, get_scenario


def test_scenarios_lists_public_fields_only(client: TestClient) -> None:
    response = client.get("/scenarios")
    assert response.status_code == 200
    data = response.json()

    assert [s["id"] for s in data] == ["airport", "restaurant", "train", "hotel"]
    for scenario in data:
        assert "scene_details" not in scenario
        assert "scene_outline" not in scenario
        assert "voice_env" not in scenario
        assert scenario["language"] == "zh-CN"
        assert len(scenario["goals"]) == 4
        assert len(scenario["key_phrases"]) == 5
        assert set(scenario["character"]) == {"name_hanzi", "name_pinyin", "name_english", "role", "avatar_char"}


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


def test_voice_falls_back_to_default() -> None:
    settings = get_settings()
    assert settings.voice_id_for("ELEVENLABS_VOICE_ID_TRAIN") == "train-voice"
    assert settings.voice_id_for("ELEVENLABS_VOICE_ID_RESTAURANT") == "default-voice"
    assert settings.voice_id_for(None) == "default-voice"
    airport = get_scenario("airport")
    assert airport is not None
    assert settings.voice_id_for(airport.voice_env) == "default-voice"
