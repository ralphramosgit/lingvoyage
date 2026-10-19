"""The character's brain: Claude with structured outputs, plus server-side clean-up."""

import logging
import re
import threading
from typing import Literal

import anthropic
import pydantic
from anthropic.types import MessageParam
from pydantic import BaseModel, Field

from app.config import get_settings
from app.errors import ApiError, missing_setting
from app.scenarios import ScenarioDefinition

logger = logging.getLogger("lingvoyage.tutor")

MAX_TOKENS = 2000
REQUEST_TIMEOUT_SECONDS = 15.0
MAX_HISTORY_LINES = 30
MAX_SUGGESTIONS = 3
OPENING_MESSAGE = "[Scene starts. The learner has just walked up to you. Greet them and open the conversation.]"


class Phrase(BaseModel):
    hanzi: str
    pinyin: str
    english: str


class TutorReply(BaseModel):
    # What the learner just said, shown under their message. All "" on the opening line.
    learner_hanzi: str  # their words in Simplified Chinese, as said (not corrected), "" if no Chinese
    learner_pinyin: str
    learner_english: str  # meaning of their whole message, "" if it was all English
    hanzi: str  # the character's line, Simplified Chinese
    pinyin: str  # tone marks, words spaced
    english: str  # natural translation
    feedback: str  # one short English sentence about the learner's last message, "" on the opening line
    corrected_hanzi: str  # natural Chinese for what the learner meant, "" if not needed
    corrected_pinyin: str
    suggestions: list[Phrase]  # exactly 3, easiest first
    completed_goal_ids: list[str]  # cumulative
    scenario_complete: bool


class ChatLine(BaseModel):
    role: Literal["npc", "learner"]
    text: str = Field(max_length=1000)


# ---------------------------------------------------------------------------
# Emoji stripping (safety net; the prompt already forbids them)
# ---------------------------------------------------------------------------

_EMOJI_RE = re.compile(
    "["
    "\U0001f000-\U0001faff"  # emoji, pictographs, flags, symbols & pictographs extended
    "\U00002600-\U000027bf"  # misc symbols, dingbats
    "\U00002b00-\U00002bff"  # stars, arrows (e.g. U+2B50)
    "\U00002300-\U000023ff"  # misc technical (watch, hourglass, alarm clock)
    "\U0000fe00-\U0000fe0f"  # variation selectors
    "\U0000200d"  # zero width joiner
    "\U000020e3"  # combining keycap
    "\U000e0020-\U000e007f"  # tag characters
    "\U00003030\U0000303d\U00003297\U00003299"  # emoji-presentation CJK symbols
    "]+"
)
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")


def strip_emojis(text: str) -> str:
    cleaned = _EMOJI_RE.sub("", text)
    return _MULTI_SPACE_RE.sub(" ", cleaned).strip()


# ---------------------------------------------------------------------------
# Prompt and messages
# ---------------------------------------------------------------------------


def build_system_prompt(scenario: ScenarioDefinition, completed_goal_ids: list[str]) -> str:
    character = scenario.character
    role = character.role[0].lower() + character.role[1:]
    goals = "\n".join(f"- [{goal.id}] {goal.label}" for goal in scenario.goals)
    completed = ", ".join(completed_goal_ids) if completed_goal_ids else "none"
    return f"""You are {character.name_hanzi} ({character.name_pinyin}), {role} at {scenario.setting} in {scenario.city}, China. You are role-playing a real travel situation with a beginner Mandarin learner, a traveler whose first language is English.

Scene details: {scenario.scene_details}

The learner's goals for this scene (ids in brackets):
{goals}
Goals already completed: {completed}

Rules for every reply:
1. Stay in character as a friendly, patient local. Speak only Simplified Chinese in "hanzi": one or two short sentences, at most about 20 characters, using HSK 1-2 vocabulary wherever possible.
2. Move the scene forward. React naturally to what the learner said, then, if goals remain, ask one simple question or give one prompt that invites the learner toward the next unfinished goal. Never list or mention the goals. Once every goal is completed, wrap up the scene with a natural goodbye.
3. The learner may write or speak Chinese, pinyin, English or a mix, and speech recognition may garble their words. Work out what they meant and respond to that.
4. "pinyin": pinyin for "hanzi" with tone marks (nǐ hǎo), words separated by spaces, punctuation kept.
5. "english": a natural English translation of "hanzi".
6. "feedback": one short, warm sentence in English about the learner's last message. Praise what was right; if something was wrong, or they used English, say how to say it in Chinese. Use "" for the opening line.
7. "corrected_hanzi" and "corrected_pinyin": the natural Chinese version of what the learner meant, when their message had mistakes or wasn't in Chinese; otherwise "". Use "" for the opening line.
8. "suggestions": exactly 3 short things the learner could say next, easiest first, each with hanzi, pinyin and english. At least one should move toward the next unfinished goal.
9. "completed_goal_ids": every goal id completed so far, including earlier ones. A goal counts when the learner attempted it in Chinese or pinyin, even with mistakes. If they only used English, don't count it yet; teach the Chinese in "feedback" instead.
10. "scenario_complete": true only when every goal is completed and your line in this reply is a natural goodbye.
11. Never use emojis or emoticons. Don't mention being an AI or that this is a lesson unless the learner asks directly. If the learner goes off topic or says something inappropriate, politely steer back to the scene, in character.
12. "learner_hanzi", "learner_pinyin" and "learner_english" show the learner what they just said, under their message. "learner_hanzi": their last message in Simplified Chinese exactly as they said it, keeping their words and mistakes (write pinyin as characters, leave any English words as they are); "" if it had no Chinese or pinyin. "learner_pinyin": pinyin for "learner_hanzi" with tone marks, words separated by spaces. "learner_english": a natural English translation of their whole last message; "" if it was entirely in English. Use "" for all three on the opening line."""


def build_messages(history: list[ChatLine], learner_text: str | None) -> list[MessageParam]:
    """Opening cue, then the last 30 history lines (npc -> assistant, learner -> user), then the new
    learner text. Consecutive same-role messages are merged so roles always alternate."""
    turns: list[tuple[Literal["user", "assistant"], str]] = [("user", OPENING_MESSAGE)]

    def add(role: Literal["user", "assistant"], text: str) -> None:
        text = text.strip()
        if not text:
            return
        if turns[-1][0] == role:
            turns[-1] = (role, f"{turns[-1][1]}\n{text}")
        else:
            turns.append((role, text))

    for line in history[-MAX_HISTORY_LINES:]:
        add("assistant" if line.role == "npc" else "user", line.text)
    if learner_text:
        add("user", learner_text)

    return [{"role": role, "content": text} for role, text in turns]


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------


def merge_goal_ids(scenario: ScenarioDefinition, *sources: list[str]) -> list[str]:
    """Union of the given goal-id lists, keeping only ids that exist in the scenario, in scenario order."""
    seen = {goal_id for source in sources for goal_id in source}
    return [goal_id for goal_id in scenario.goal_ids if goal_id in seen]


def finalize_reply(reply: TutorReply, scenario: ScenarioDefinition, client_completed_ids: list[str]) -> TutorReply:
    completed = merge_goal_ids(scenario, client_completed_ids, reply.completed_goal_ids)
    suggestions = [
        Phrase(hanzi=strip_emojis(p.hanzi), pinyin=strip_emojis(p.pinyin), english=strip_emojis(p.english))
        for p in reply.suggestions[:MAX_SUGGESTIONS]
    ]
    return TutorReply(
        learner_hanzi=strip_emojis(reply.learner_hanzi),
        learner_pinyin=strip_emojis(reply.learner_pinyin),
        learner_english=strip_emojis(reply.learner_english),
        hanzi=strip_emojis(reply.hanzi),
        pinyin=strip_emojis(reply.pinyin),
        english=strip_emojis(reply.english),
        feedback=strip_emojis(reply.feedback),
        corrected_hanzi=strip_emojis(reply.corrected_hanzi),
        corrected_pinyin=strip_emojis(reply.corrected_pinyin),
        suggestions=[p for p in suggestions if p.hanzi],
        completed_goal_ids=completed,
        scenario_complete=reply.scenario_complete and len(completed) == len(scenario.goals),
    )


# ---------------------------------------------------------------------------
# Claude call
# ---------------------------------------------------------------------------

_client: anthropic.Anthropic | None = None
_client_lock = threading.Lock()


def _get_client() -> anthropic.Anthropic:
    global _client
    with _client_lock:
        if _client is None:
            api_key = get_settings().anthropic_api_key
            if not api_key:
                raise missing_setting("ANTHROPIC_API_KEY")
            # Retries are handled below (once, on overload or timeout only).
            _client = anthropic.Anthropic(api_key=api_key, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=0)
        return _client


def _is_retryable(error: Exception) -> bool:
    if isinstance(error, (anthropic.OverloadedError, anthropic.APITimeoutError)):
        return True
    return isinstance(error, anthropic.APIStatusError) and error.status_code == 529


def _map_error(error: Exception) -> ApiError:
    if isinstance(error, (anthropic.OverloadedError, anthropic.APITimeoutError, anthropic.RateLimitError)):
        return ApiError(503, "tutor_busy", "The character is busy right now. Try again in a moment.")
    if isinstance(error, anthropic.APIStatusError) and error.status_code == 529:
        return ApiError(503, "tutor_busy", "The character is busy right now. Try again in a moment.")
    if isinstance(error, anthropic.AuthenticationError):
        return ApiError(502, "tutor_failed", "Claude rejected the API key. Check ANTHROPIC_API_KEY (guide 04).")
    if isinstance(error, anthropic.NotFoundError):
        return ApiError(502, "tutor_failed", "Claude model not found. Check ANTHROPIC_MODEL (guide 04).")
    if isinstance(error, anthropic.BadRequestError):
        return ApiError(502, "tutor_failed", f"Claude rejected the request: {error.message}")
    if isinstance(error, anthropic.APIConnectionError):
        return ApiError(503, "tutor_unavailable", "Couldn't reach Claude. Check the server's internet connection.")
    return ApiError(502, "tutor_failed", "The character couldn't answer. Try again.")


def generate_reply(
    scenario: ScenarioDefinition,
    history: list[ChatLine],
    client_completed_ids: list[str],
    learner_text: str | None,
) -> TutorReply:
    client = _get_client()
    settings = get_settings()
    completed = merge_goal_ids(scenario, client_completed_ids)
    system = build_system_prompt(scenario, completed)
    messages = build_messages(history, learner_text)

    # No temperature / top_p / top_k: Claude Haiku 5.5 rejects sampling parameters.
    for attempt in (1, 2):
        try:
            response = client.messages.parse(
                model=settings.anthropic_model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                output_config={"effort": "low"},
                output_format=TutorReply,
            )
        except anthropic.APIError as error:
            if attempt == 1 and _is_retryable(error):
                logger.warning("Claude overloaded or timed out; retrying once")
                continue
            logger.exception("Claude request failed")
            raise _map_error(error)
        except pydantic.ValidationError:
            logger.exception("Claude returned JSON that doesn't match TutorReply")
            raise ApiError(502, "tutor_failed", "The character's reply came back garbled. Try again.")

        reply = response.parsed_output
        if reply is None:
            logger.error("Claude returned no parsed output (stop_reason=%s)", response.stop_reason)
            raise ApiError(502, "tutor_failed", "The character couldn't answer that. Try saying it another way.")
        return finalize_reply(reply, scenario, client_completed_ids)

    raise ApiError(503, "tutor_busy", "The character is busy right now. Try again in a moment.")
