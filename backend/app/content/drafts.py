"""What the content agents share: the draft shapes and the write → check → fix loop.

Every piece of content (a scene, a unit's local notes, a quiz) is written the same way:

    Claude writes a draft (structured output) ──> build + checks (code)
        ^                                            │ problems
        └──── task + draft + problems, up to 3 tries ┘
                                                     │ none
                                                     └──> the finished model, saved

Drafts are plain shapes with no validators, so a draft with mistakes still comes back and its
problems can be sent back to be fixed. Code then turns it into the real model (ScenarioDefinition,
LocalUnitNotes, LocalQuiz), whose validators and extra checks list what's wrong.
"""

import logging
from collections.abc import Callable
from typing import Any, Literal, TypeVar

import anthropic
import pydantic
from pydantic import BaseModel, Field

from app.content import prompts
from app.research.claude import FALLBACK_BETA
from app.research.trace import Trace
from app.tutor import strip_emojis

logger = logging.getLogger("lingvoyage.content")

MAX_ROUNDS = 3
MAX_TOKENS = 16000

D = TypeVar("D", bound=BaseModel)
R = TypeVar("R")


class DraftPhrase(BaseModel):
    hanzi: str
    pinyin: str
    english: str


class DraftTile(BaseModel):
    hanzi: str
    pinyin: str


class DraftExercise(BaseModel):
    kind: Literal["choice", "build"]
    prompt: str
    hanzi: str = Field(description='choice: the Chinese the question is about ("" if none, ＿＿ marks a gap). build: "".')
    pinyin: str = Field(description='Pinyin for hanzi. build: "".')
    options: list[DraftPhrase] = Field(description='choice: 2 to 4 options (Chinese, or "" hanzi/pinyin for English ones). build: [].')
    answer: int = Field(description="choice: the index of the right option. build: 0.")
    tiles: list[DraftTile] = Field(description="build: the answer's words in order. choice: [].")
    extra_tiles: list[DraftTile] = Field(description="build: 1 or 2 tiles that don't belong. choice: [].")
    hint: str
    solution: DraftPhrase


class DraftLesson(BaseModel):
    id: str
    title: str
    summary: str
    pattern: DraftPhrase | None
    examples: list[DraftPhrase]
    words: list[DraftPhrase]
    tip: str
    exercises: list[DraftExercise]


def clean(value: Any) -> Any:
    """No emojis anywhere (the prompts already forbid them)."""
    if isinstance(value, str):
        return strip_emojis(value)
    if isinstance(value, list):
        return [clean(item) for item in value]
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items()}
    return value


def exercise_body(draft: dict[str, Any]) -> dict[str, Any]:
    """A draft question as the backend's ChoiceExercise or BuildExercise (only that kind's fields)."""
    if draft["kind"] == "choice":
        keep = ("kind", "prompt", "hanzi", "pinyin", "options", "answer", "hint", "solution")
    else:
        keep = ("kind", "prompt", "tiles", "extra_tiles", "hint", "solution")
    return {key: draft[key] for key in keep}


def lesson_body(draft: dict[str, Any], lesson_id: str) -> dict[str, Any]:
    return {**draft, "id": lesson_id, "exercises": [exercise_body(item) for item in draft["exercises"]]}


def validation_problems(error: pydantic.ValidationError, where: str = "draft") -> list[str]:
    problems = []
    for item in error.errors()[:10]:
        location = ".".join(str(part) for part in item["loc"]) or where
        problems.append(f"{location}: {str(item['msg']).removeprefix('Value error, ')}")
    return problems


def ask(client: anthropic.Anthropic, model: str, effort: str, system: str, message: str, output_format: type[D]) -> Any:
    return client.beta.messages.parse(
        model=model,
        max_tokens=MAX_TOKENS,
        # The rules, word list and examples are the same for every piece: cache them.
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": message}],
        output_config={"effort": effort},  # type: ignore[typeddict-item]
        output_format=output_format,
        betas=[FALLBACK_BETA],
        fallbacks="default",
    )


def write_checked(
    client: anthropic.Anthropic,
    *,
    model: str,
    effort: str,
    system: str,
    task: str,
    output_format: type[D],
    build: Callable[[D], tuple[R | None, list[str]]],
    trace: Trace,
    stage: str,
    worker: str,
    what: str,
    ready: Callable[[R], str],
    declined: str = "",
) -> R | None:
    """One piece of content, with up to 3 tries. None if it couldn't be written (the reason is in the trace).

    `build` turns a draft into the finished model and lists its problems. It returns (None, []) when
    the agent rightly wrote nothing (a unit whose facts don't fit it): `declined` goes in the trace.
    """
    message = task
    trace.step(stage, "write", f"Writing {what}", worker=worker)
    for attempt in range(1, MAX_ROUNDS + 1):
        try:
            response = ask(client, model, effort, system, message, output_format)
        except (anthropic.APIError, pydantic.ValidationError) as error:
            logger.warning("%s: request failed (%s)", worker, type(error).__name__)
            trace.step(stage, "error", f"Couldn't write {what}", worker=worker)
            return None
        trace.add_usage(response.model, response.usage)
        draft = response.parsed_output
        if draft is None:
            logger.warning("%s: no draft (stop_reason=%s)", worker, response.stop_reason)
            trace.step(stage, "error", f"{what[:1].upper()}{what[1:]} came back incomplete", worker=worker)
            return None
        result, problems = build(draft)
        if result is not None:
            fixed = f", after fixing {attempt - 1} round{'s' if attempt > 2 else ''} of problems" if attempt > 1 else ""
            trace.step(stage, "done", f"{ready(result)}{fixed}", worker=worker)
            return result
        if not problems:
            trace.step(stage, "done", declined or f"Nothing to write for {what}", worker=worker)
            return None
        logger.info("%s, try %d: %d problems", worker, attempt, len(problems))
        trace.step(stage, "check", f"Checked the draft: {len(problems)} problems to fix", worker=worker)
        message = prompts.fix_message(task, draft.model_dump_json(), problems)
    trace.step(stage, "error", f"Skipped {what}: problems left after {MAX_ROUNDS} tries", worker=worker)
    return None
