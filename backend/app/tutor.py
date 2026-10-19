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
_NOT_A_WORD_RE = re.compile(r"[\s，。？！、,.?!…]")


def strip_emojis(text: str) -> str:
    cleaned = _EMOJI_RE.sub("", text)
    return _MULTI_SPACE_RE.sub(" ", cleaned).strip()


# ---------------------------------------------------------------------------
# Prompt and messages
# ---------------------------------------------------------------------------


def _outline_section(scenario: ScenarioDefinition) -> str:
    if not scenario.scene_outline:
        return ""
    steps = "\n".join(f"{number}. {step}" for number, step in enumerate(scenario.scene_outline, start=1))
    return f"""

How the scene goes. Follow this script in order, but let the traveler lead: if they skip ahead, change the order or say something else, go with them. Only the lines after "You" are yours; the traveler's part is described in English because it's theirs to say.
{steps}"""


def _practiced_section(scenario: ScenarioDefinition) -> str:
    """What the pre-encounter lessons teach: listed so the character recognizes it, not to say it."""
    patterns = [f"- {lesson.pattern.hanzi} ({lesson.pattern.english})" for lesson in scenario.lessons if lesson.pattern]
    words: dict[str, str] = {}
    for lesson in scenario.lessons:
        for word in lesson.words:
            words.setdefault(word.hanzi, f"{word.hanzi} {word.pinyin} ({word.english})")
    if not patterns and not words:
        return ""
    return f"""

Before the scene, the learner may have practiced these sentence patterns. Listen for them in what the traveler says. They are for the traveler to say to you: don't use them to ask the traveler anything.
{chr(10).join(patterns)}
Words the learner practiced: {", ".join(words.values())}. Prefer these words in your own lines."""


def build_system_prompt(scenario: ScenarioDefinition, completed_goal_ids: list[str]) -> str:
    character = scenario.character
    role = character.role[0].lower() + character.role[1:]
    goals = "\n".join(f"- [{goal.id}] {goal.label}" for goal in scenario.goals)
    completed = ", ".join(completed_goal_ids) if completed_goal_ids else "none"
    return f"""You are {character.name_hanzi} ({character.name_pinyin}), {role} at {scenario.setting} in {scenario.city}, China. You are role-playing a real travel situation with a beginner Mandarin learner, who plays the traveler. Their first language is English.

Scene details: {scenario.scene_details}{_outline_section(scenario)}{_practiced_section(scenario)}

The traveler's goals for this scene (ids in brackets). These are things THE TRAVELER says or asks, never you:
{goals}
Goals already completed: {completed}

Rules for every reply:
1. Stay in character as a friendly, patient local. Speak only Simplified Chinese in "hanzi": one or two short sentences, at most about 20 characters, as simple as your lines in the script, using the practiced words where they fit and otherwise HSK 1-2 vocabulary.
2. Keep to your own part. You are the local with the answers from the scene details, so never ask the traveler the questions that are theirs to ask you (where something is, what time something happens, how much something costs, a password), and never say the traveler's lines. Don't coach in "hanzi" either (no 你可以说… or 你可以问…): showing the learner what to say is the job of "feedback" and "suggestions".
3. Move the scene forward. React naturally to what the traveler said, then, if goals remain, invite them toward the next unfinished goal the way your script lines do: offer help, or ask about their plans. When that goal is the traveler asking you something, leave the question to them, and don't give away the answer before they ask. If they seem stuck, offer help again or repeat your last question more simply. Never list or mention the goals. Once every goal is completed, wrap up the scene with a natural goodbye.
4. The learner may write or speak Chinese, pinyin, English or a mix, and speech recognition may garble their words. Work out what they meant and respond to that.
5. "pinyin": pinyin for "hanzi" with tone marks (nǐ hǎo), words separated by spaces, punctuation kept.
6. "english": a natural English translation of "hanzi".
7. "feedback": one short, warm sentence in English about the learner's last message. Praise what was right; if something was wrong, or they used English, say how to say it in Chinese. Use "" for the opening line.
8. "corrected_hanzi" and "corrected_pinyin": the natural Chinese version of what the learner meant, when their message had mistakes or wasn't in Chinese; otherwise "". Use "" for the opening line.
9. "suggestions": exactly 3 short things the traveler could say next, easiest first, each with hanzi, pinyin and english. At least one should move toward the next unfinished goal, using a practiced pattern if one fits.
10. "completed_goal_ids": every goal id completed so far, including earlier ones. A goal counts when the learner attempted it in Chinese or pinyin, even with mistakes. If they only used English, don't count it yet; teach the Chinese in "feedback" instead.
11. "scenario_complete": true only when every goal is completed and your line in this reply is a natural goodbye.
12. Never use emojis or emoticons. Don't mention being an AI or that this is a lesson unless the learner asks directly. If the learner goes off topic or says something inappropriate, politely steer back to the scene, in character.
13. "learner_hanzi", "learner_pinyin" and "learner_english" show the learner what they just said, under their message. "learner_hanzi": their last message in Simplified Chinese exactly as they said it, keeping their words and mistakes (write pinyin as characters, leave any English words as they are); "" if it had no Chinese or pinyin. "learner_pinyin": pinyin for "learner_hanzi" with tone marks, words separated by spaces. "learner_english": a natural English translation of their whole last message; "" if it was entirely in English. Use "" for all three on the opening line."""


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
# Role check: the character must not ask the traveler's questions
# ---------------------------------------------------------------------------


def asks_travelers_question(scenario: ScenarioDefinition, hanzi: str) -> str | None:
    """The scene's key-phrase question that `hanzi` contains, if any. Key phrases are the learner's
    lines, so the character saying one (e.g. 你的行李在哪里？ at the airport) has swapped roles."""
    line = _NOT_A_WORD_RE.sub("", hanzi)
    for phrase in scenario.key_phrases:
        if phrase.hanzi.rstrip().endswith(("？", "?")):
            question = _NOT_A_WORD_RE.sub("", phrase.hanzi)
            if question and question in line:
                return phrase.hanzi
    return None


def _role_swap_note(hanzi: str) -> str:
    return (
        f'\n\nYour last draft line was "{hanzi}". That is the traveler\'s question to ask you, not yours. '
        "Write the reply again in your own part: answer them, offer help, or ask about their plans."
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


def _ask_claude(client: anthropic.Anthropic, system: str, messages: list[MessageParam], attempts: int) -> TutorReply:
    # No temperature / top_p / top_k: Claude Haiku 5.5 rejects sampling parameters.
    for attempt in range(1, attempts + 1):
        try:
            response = client.messages.parse(
                model=get_settings().anthropic_model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                output_config={"effort": "low"},
                output_format=TutorReply,
            )
        except anthropic.APIError as error:
            if attempt < attempts and _is_retryable(error):
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
        return reply

    raise ApiError(503, "tutor_busy", "The character is busy right now. Try again in a moment.")


def generate_reply(
    scenario: ScenarioDefinition,
    history: list[ChatLine],
    client_completed_ids: list[str],
    learner_text: str | None,
) -> TutorReply:
    client = _get_client()
    completed = merge_goal_ids(scenario, client_completed_ids)
    system = build_system_prompt(scenario, completed)
    messages = build_messages(history, learner_text)

    reply = _ask_claude(client, system, messages, attempts=2)

    # Now and then the character asks the traveler's question (e.g. 巴士在哪里？). Ask once more,
    # without the overload retry to stay inside the Lambda timeout; if that fails, keep the first reply.
    if asks_travelers_question(scenario, reply.hanzi):
        logger.warning("Character said the traveler's line %r in scenario %s; asking again", reply.hanzi, scenario.id)
        try:
            second = _ask_claude(client, system + _role_swap_note(reply.hanzi), messages, attempts=1)
        except ApiError:
            second = None
        if second is not None and not asks_travelers_question(scenario, second.hanzi):
            reply = second

    return finalize_reply(reply, scenario, client_completed_ids)
