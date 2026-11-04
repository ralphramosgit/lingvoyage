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
GLOSS_MAX_TOKENS = 1000
REQUEST_TIMEOUT_SECONDS = 15.0
MAX_HISTORY_LINES = 30
MAX_SUGGESTIONS = 3
MAX_QUESTIONS = 1  # per reply: a beginner answers one thing at a time
OPENING_MESSAGE = "[Scene starts. The learner has just walked up to you. Greet them and open the conversation.]"


class Phrase(BaseModel):
    hanzi: str
    pinyin: str
    english: str


class TutorReply(BaseModel):
    """What the app gets for each turn."""

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


class CharacterReply(BaseModel):
    """What Claude writes. It judges the goals on the learner's last message only, and before its own line, so
    the line leads to the next goal; finalize_reply adds them to the earlier ones for the TutorReply."""

    learner_hanzi: str
    learner_pinyin: str
    learner_english: str
    goals_done: list[str]  # ids of the goals the learner's last message did, [] on the opening line
    hanzi: str
    pinyin: str
    english: str
    feedback: str
    corrected_hanzi: str
    corrected_pinyin: str
    suggestions: list[Phrase]
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
_QUESTION_RE = re.compile(r"[？?]+")
_QUESTION_SENTENCE_RE = re.compile(r"[㐀-鿿][^。！？!?]*[？?]+")
# Answered with just 要 or 对: …吗？, …吧？, and A-not-A (要不要, 是不是, 有没有). Not 什么, 哪儿, 几 or A还是B.
_YES_NO_RE = re.compile(r"[吗吧]\s*[？?]+$|([㐀-鿿])[不没]\1")
# The character telling the traveler what to say, or asking if or which they want to ask (你要问几点关门吗？,
# 你想知道多少钱吗？, 你想问多少钱，还是多长时间？).
_COACHING_RE = re.compile(r"你可以(?:说|问)|你(?:要|想)(?:说|问|知道)[^。！？.!?]*(?:吗|还是)")
_GOODBYE_RE = re.compile(r"再见|一路平安|慢走|拜拜")
# The learner thanking the character or saying goodbye, in Chinese, pinyin or English.
_THANKS_RE = re.compile(r"谢|再见|拜拜|xi[eèéěē]\s*xi|z[aàáǎ]i\s*ji[aàáǎ]n|thank|bye", re.IGNORECASE)
_THANKS_GOAL_RE = re.compile(r"\b(?:thank|thanks|goodbye|bye)\b", re.IGNORECASE)
# Where the character's part of a script step starts; the traveler's part before it is in English.
_YOUR_PART_RE = re.compile(r"\byou(?: open)?:", re.IGNORECASE)
_OPEN_QUESTION_SLOT = "[an open or choice question that leads to the next goal]"


def strip_emojis(text: str) -> str:
    cleaned = _EMOJI_RE.sub("", text)
    return _MULTI_SPACE_RE.sub(" ", cleaned).strip()


# ---------------------------------------------------------------------------
# Prompt and messages
# ---------------------------------------------------------------------------


def characters_part(step: str) -> str:
    """The character's part of a script step: what comes after "You open:" or "You:" (all of it if neither)."""
    match = _YOUR_PART_RE.search(step)
    return step[match.end() :] if match else step


def _outline_step(number: int, step: str) -> str:
    """One script step. Scenes written before the open-question rule (#68) can still ask yes/no questions
    (你要买票吗？); they're left out, so the character asks an open one instead of copying them."""
    yours = characters_part(step)
    lead = step[: len(step) - len(yours)]
    for question in yes_no_questions(yours):
        yours = yours.replace(question, _OPEN_QUESTION_SLOT, 1)
    return f"{number}. {lead}{yours}"


def _outline_section(scenario: ScenarioDefinition) -> str:
    if not scenario.scene_outline:
        return ""
    steps = "\n".join(_outline_step(number, step) for number, step in enumerate(scenario.scene_outline, start=1))
    return f"""

How the scene goes. Follow this script in order, the way a real visit goes. If the traveler skips ahead, changes the order or says something else, go with them, then carry on from the step that fits. Only the lines after "You" are yours; the traveler's part is described in English because it's theirs to say.
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


def _next_goals(scenario: ScenarioDefinition, completed_goal_ids: list[str]) -> str:
    """The open goals in scenario order (the order they happen in the script): the first is the one to lead to."""
    open_goals = [f"[{goal.id}] {goal.label}" for goal in scenario.goals if goal.id not in completed_goal_ids]
    if not open_goals:
        return "Next goal: none, every goal is done. Close the scene (rule 5)."
    after = f"\nAfter it, in order: {'; then '.join(open_goals[1:])}" if len(open_goals) > 1 else "\nIt's the last one."
    return f"Next goal, the one to lead to now: {open_goals[0]}{after}"


def build_system_prompt(scenario: ScenarioDefinition, completed_goal_ids: list[str], local_facts: str = "") -> str:
    """`local_facts`: the facts retrieved for this turn of a local scene (app/locations/retrieve.py), at the very
    end, after everything that stays the same for the scene."""
    character = scenario.character
    role = character.role[0].lower() + character.role[1:]
    goals = "\n".join(f"- [{goal.id}] {goal.label}" for goal in scenario.goals)
    completed = ", ".join(completed_goal_ids) if completed_goal_ids else "none"
    facts = f"\n\n{local_facts}" if local_facts else ""
    return f"""You are {character.name_hanzi} ({character.name_pinyin}), {role} at {scenario.setting} in {scenario.city}, China. You are role-playing a real travel situation with a beginner Mandarin learner, who plays the traveler. Their first language is English. The traveler is already in {scenario.city}: never ask if they want to go to {scenario.city}, and if they say where they're going, go along with it.

Scene details: {scenario.scene_details}{_outline_section(scenario)}{_practiced_section(scenario)}

The traveler's goals for this scene, in the order the script comes to them (ids in brackets). These are things THE TRAVELER says or asks, never you:
{goals}
Goals already completed: {completed}
{_next_goals(scenario, completed_goal_ids)}

Rules for every reply:
1. Stay in character as a friendly, patient local. Speak only Simplified Chinese in "hanzi": one to three short sentences, at most about 25 characters, as simple as your lines in the script, using the practiced words where they fit and otherwise HSK 1-2 vocabulary.
2. Keep to your own part. You are the local with the answers from the scene details, so never ask the traveler the questions that are theirs to ask you (where something is, what time something happens, how much something costs, a password), and never say the traveler's lines. Don't coach in "hanzi" either (no 你可以说…, 你可以问…, 你要问…吗？ or 你想知道…吗？): showing the learner what to say is the job of "feedback" and "suggestions".
3. Be specific. When the traveler asks you something, answer with the exact details from the scene details (which number, door, floor, side, time or price), never just 在那里 on its own. Answer only what they asked: never tell them something a goal still to do has them ask you (where something is, a time, a price, how long it takes) before they ask it, so they get to ask.
4. Lead the traveler to the next goal, one goal at a time, in order. Unless you are closing the scene, end every reply with exactly one short, easy question, and ask nothing else: one question in "hanzi", never two (not 好！你要哪个？喝什么？). Make it an open question (什么, 哪儿, 哪里, 几, 多少, 怎么) or a choice (A还是B？, the easiest for a beginner), never a yes/no question (…吗？, …吧？, 要不要, 有没有, 好吗): a beginner answers those with just 要 or 对, which does no goal. Ask the question whose answer does the next goal:
   - When the goal is something the traveler says or chooses (where they're going, how many people, a dish, no spice, the bill, how they'll pay), ask for it: 你要去哪儿？ 几位？ 我们有牛肉面和饺子。你要哪个？ 要辣的还是不辣的？
   - When the goal is the traveler asking you something (where something is, a time, a price, how long it takes), you may name the thing (你可以坐地铁。), then invite their question without answering it: 你找什么？ 你还想知道什么？ 还有什么问题？ Their question is the answer. Don't turn their question around on them (not 你怎么去？ or 多少钱？ when they're the one to ask how to get there or the price).
   If the traveler's last message did the next goal, answer it, then lead to the one after. Take your questions from the script, in order, but where a script line asks a yes/no question, ask an open or choice question instead. Script steps that aren't goals are only on the way: keep each to one short reply, and never add small talk or topics the script doesn't have. Never jump ahead (don't ask about spice, drinks or a second dish before they've ordered, and don't bring up paying before they're done), and never go back to a goal that's done. If they seem stuck, ask again more simply. Never list or mention the goals.
5. Closing the scene. Never say goodbye while a goal is still to do: if the traveler thanks you or says goodbye early, answer warmly and lead to the next goal. When the traveler's last message did the last goal, answer it, then ask one closing question (还需要什么？), unless that message also thanked you or said goodbye. Once every goal is done and they thank you, say goodbye or need nothing else, say a short, natural goodbye with no question (不客气！再见！).
6. When the traveler has to choose something (a dish, a drink, a ticket, a line), offer two or three real options by name from the scene details, as in 我们有麻婆豆腐和回锅肉。 Don't ask what they want without saying what there is.
7. The learner may write or speak Chinese, pinyin, English or a mix, and speech recognition may garble their words. Work out what they meant and respond to that.
8. "goals_done": decide this first, before you write your line. Judge the traveler's last message only: the ids of the goals it did, [] if none, and [] on the opening line. A goal counts when they attempted it in Chinese or pinyin, even with mistakes:
   - a goal where they ask something: they asked it (行李在哪里？, 多少钱？, or just 在哪儿？ or 几点？ about the thing you're talking about), or named what they need when you asked what they're looking for (行李 after 你找什么？);
   - a goal where they say or choose something: they said it, even as a short answer to your question (两位 after 几位？, 牛肉面 after 你要哪个？).
   It doesn't count when they only used English (teach the Chinese in "feedback" instead), said just yes or no (要, 对, 好), greeted you, or picked an option or said something that isn't what the goal is about (我坐三号线 doesn't ask how to get there), or when you said it rather than them.
9. "pinyin": pinyin for "hanzi" with tone marks (nǐ hǎo), words separated by spaces, punctuation kept.
10. "english": a natural English translation of "hanzi".
11. "feedback": one short, warm sentence in English about the learner's last message. Praise what was right; if something was wrong, or they used English, say how to say it in Chinese. Use "" for the opening line.
12. "corrected_hanzi" and "corrected_pinyin": the natural Chinese version of what the learner meant, when their message had mistakes or wasn't in Chinese; otherwise "". Use "" for the opening line.
13. "suggestions": exactly 3 short things the traveler could say right after your line in this reply, easiest first, each with hanzi, pinyin and english. Every one must make sense said right now: an answer to your question, using the options you just named (when you invited their question, the questions they could ask you). At least one, and the first where it fits, does the next goal, using a practiced pattern if one fits. Never suggest just yes or no, a goal they've already done, a later step (paying while they're still ordering) or anything your line isn't about. When you're closing the scene, suggest a thank you or a goodbye.
14. "scenario_complete": true only when every goal is done and your line in this reply is a goodbye with no question.
15. Never use emojis or emoticons. Don't mention being an AI or that this is a lesson unless the learner asks directly. If the learner goes off topic or says something inappropriate, politely steer back to the scene, in character.
16. "learner_hanzi", "learner_pinyin" and "learner_english" show the learner what they just said, under their message. "learner_hanzi": their last message in Simplified Chinese exactly as they said it, keeping their words and mistakes (write pinyin as characters, leave any English words as they are); "" if it had no Chinese or pinyin. "learner_pinyin": pinyin for "learner_hanzi" with tone marks, words separated by spaces. "learner_english": a natural English translation of their whole last message; "" if it was entirely in English. Use "" for all three on the opening line.{facts}"""


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


def finalize_reply(reply: CharacterReply, scenario: ScenarioDefinition, client_completed_ids: list[str]) -> TutorReply:
    completed = merge_goal_ids(scenario, client_completed_ids, reply.goals_done)
    hanzi = strip_emojis(reply.hanzi)
    suggestions = [
        Phrase(hanzi=strip_emojis(p.hanzi), pinyin=strip_emojis(p.pinyin), english=strip_emojis(p.english))
        for p in reply.suggestions[:MAX_SUGGESTIONS]
    ]
    # Over once every goal is done and the character says goodbye; a line that still asks something isn't one.
    complete = len(completed) == len(scenario.goals) and question_count(hanzi) == 0
    return TutorReply(
        learner_hanzi=strip_emojis(reply.learner_hanzi),
        learner_pinyin=strip_emojis(reply.learner_pinyin),
        learner_english=strip_emojis(reply.learner_english),
        hanzi=hanzi,
        pinyin=strip_emojis(reply.pinyin),
        english=strip_emojis(reply.english),
        feedback=strip_emojis(reply.feedback),
        corrected_hanzi=strip_emojis(reply.corrected_hanzi),
        corrected_pinyin=strip_emojis(reply.corrected_pinyin),
        suggestions=[p for p in suggestions if p.hanzi],
        completed_goal_ids=completed,
        scenario_complete=complete and (reply.scenario_complete or says_goodbye(hanzi)),
    )


# ---------------------------------------------------------------------------
# Line checks: the character asks one open question, never the traveler's, doesn't coach, and doesn't say
# goodbye before the goals are done
# ---------------------------------------------------------------------------


def _key_questions(scenario: ScenarioDefinition) -> list[tuple[str, str]]:
    """The scene's key phrases that are questions: as written, and as bare words without spaces or punctuation."""
    questions: list[tuple[str, str]] = []
    for phrase in scenario.key_phrases:
        if phrase.hanzi.rstrip().endswith(("？", "?")) and (bare := _NOT_A_WORD_RE.sub("", phrase.hanzi)):
            questions.append((phrase.hanzi, bare))
    return questions


def asks_travelers_question(scenario: ScenarioDefinition, hanzi: str) -> str | None:
    """The scene's key-phrase question that `hanzi` contains, if any. Key phrases are the learner's
    lines, so the character saying one (e.g. 你的行李在哪里？ at the airport) has swapped roles."""
    line = _NOT_A_WORD_RE.sub("", hanzi)
    return next((written for written, bare in _key_questions(scenario) if bare in line), None)


def drop_asked_questions(
    scenario: ScenarioDefinition, suggestions: list[Phrase], learner_lines: list[str]
) -> list[Phrase]:
    """The suggestions without the key questions the learner has already asked (the character answered
    them), e.g. no 我的行李在哪里？ once they've asked 行李在哪里？."""
    said = [_NOT_A_WORD_RE.sub("", line) for line in learner_lines]
    asked = [bare for _, bare in _key_questions(scenario) if any(bare in line for line in said)]
    return [phrase for phrase in suggestions if not any(bare in _NOT_A_WORD_RE.sub("", phrase.hanzi) for bare in asked)]


def question_count(hanzi: str) -> int:
    """Questions in the character's line: each run of question marks is one (A还是B？ counts once)."""
    return len(_QUESTION_RE.findall(hanzi))


def yes_no_questions(hanzi: str) -> list[str]:
    """The questions in `hanzi` that can be answered with just yes or no (你要买票吗？, 要不要辣？). A beginner
    answers 要 or 对, which does no goal; an open question (你要去哪儿？) or a choice (A还是B？) leads to one."""
    questions = [match.group(0).strip() for match in _QUESTION_SENTENCE_RE.finditer(hanzi)]
    return [question for question in questions if _YES_NO_RE.search(question)]


def coaches(hanzi: str) -> bool:
    """The character telling the traveler what to say or ask (你可以说…, 你想知道多少钱吗？)."""
    return bool(_COACHING_RE.search(hanzi))


def says_goodbye(hanzi: str) -> bool:
    return bool(_GOODBYE_RE.search(hanzi))


def is_closing(scenario: ScenarioDefinition, completed_goal_ids: list[str]) -> bool:
    """Every goal is done, or all that's left is saying thank you or goodbye."""
    return all(_THANKS_GOAL_RE.search(goal.label) for goal in scenario.goals if goal.id not in completed_goal_ids)


def line_problems(scenario: ScenarioDefinition, hanzi: str, closing: bool = False) -> list[str]:
    """What's wrong with the character's line, said to Claude when asking again. [] when it's fine. `closing`:
    the scene is closing (is_closing()), so a yes/no question (还需要什么吗？) is fine: it leads to the thank you."""
    problems: list[str] = []
    if asks_travelers_question(scenario, hanzi):
        problems.append(
            "That is the traveler's question to ask you, not yours. Write the reply again in your own part: "
            "answer them, offer help, or ask about their plans."
        )
    if coaches(hanzi):
        problems.append(
            "That coaches the traveler on what to say or ask. Stay in the scene: answer them, or ask about them "
            '(what they need, which one they want, when they\'re going); showing them what to say is the job of "feedback" '
            'and "suggestions".'
        )
    if (count := question_count(hanzi)) > MAX_QUESTIONS:
        problems.append(
            f"It asks {count} questions; ask only one. Keep the one that leads to the next goal, and drop the others."
        )
    if not closing and (yes_no := yes_no_questions(hanzi)):
        problems.append(
            f'"{yes_no[0]}" can be answered with just yes or no, which does no goal. Ask an open question (什么, 哪儿, '
            "几, 多少, 怎么) or a choice (A还是B？) whose answer does the next goal; if the traveler is to ask you "
            "something, invite it (你还想知道什么？)."
        )
    return problems


def ending_problems(
    scenario: ScenarioDefinition, hanzi: str, done_before: list[str], done_after: list[str], learner_text: str | None
) -> list[str]:
    """A goodbye that ends the scene too soon: with goals still to do, or straight after the last one, before the
    traveler could thank the character. `done_before` and `done_after`: the goals done before and after this turn."""
    if not says_goodbye(hanzi):
        return []
    open_goals = [goal for goal in scenario.goals if goal.id not in done_after]
    if open_goals:
        return [
            f'That says goodbye, but the traveler hasn\'t done every goal yet (next: "{open_goals[0].label}"). Don\'t end '
            "the scene: answer them, then ask the question that leads to that goal."
        ]
    if len(done_before) < len(scenario.goals) and not _THANKS_RE.search(learner_text or ""):
        return [
            "That ends the scene right after the traveler's last goal, before they could thank you. Answer them, "
            "then ask one closing question (还需要什么？) instead of saying goodbye."
        ]
    return []


def _ask_again_note(hanzi: str, problems: list[str]) -> str:
    return f'\n\nYour last draft line was "{hanzi}". ' + " ".join(problems)


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


def _ask_claude(client: anthropic.Anthropic, system: str, messages: list[MessageParam], attempts: int) -> CharacterReply:
    # No temperature / top_p / top_k: Claude Sonnet 5.5 and Haiku 5.5 reject sampling parameters.
    for attempt in range(1, attempts + 1):
        try:
            response = client.messages.parse(
                model=get_settings().anthropic_model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                output_config={"effort": "low"},
                output_format=CharacterReply,
            )
        except anthropic.APIError as error:
            if attempt < attempts and _is_retryable(error):
                logger.warning("Claude overloaded or timed out; retrying once")
                continue
            logger.exception("Claude request failed")
            raise _map_error(error)
        except pydantic.ValidationError:
            logger.exception("Claude returned JSON that doesn't match CharacterReply")
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
    local_facts: str = "",
) -> TutorReply:
    client = _get_client()
    completed = merge_goal_ids(scenario, client_completed_ids)
    system = build_system_prompt(scenario, completed, local_facts)
    messages = build_messages(history, learner_text)

    reply = _ask_claude(client, system, messages, attempts=2)

    def problems_of(candidate: CharacterReply) -> list[str]:
        done_after = merge_goal_ids(scenario, completed, candidate.goals_done)
        return line_problems(scenario, candidate.hanzi, is_closing(scenario, done_after)) + ending_problems(
            scenario, candidate.hanzi, completed, done_after, learner_text
        )

    # Now and then the character asks the traveler's question (e.g. 巴士在哪里？), coaches them (你要问…吗？),
    # asks two questions or a yes/no one, or says goodbye too soon. Ask once more, without the overload retry
    # to stay inside the Lambda timeout, and keep the second reply only if it's better; if asking again fails,
    # keep the first.
    problems = problems_of(reply)
    if problems:
        logger.warning(
            "Character's line %r in scenario %s: %s Asking again", reply.hanzi, scenario.id, " ".join(problems)
        )
        try:
            second = _ask_claude(client, system + _ask_again_note(reply.hanzi, problems), messages, attempts=1)
        except ApiError:
            second = None
        if second is not None and len(problems_of(second)) < len(problems):
            reply = second

    learner_lines = [line.text for line in history if line.role == "learner"] + ([learner_text] if learner_text else [])
    suggestions = drop_asked_questions(scenario, reply.suggestions, learner_lines)
    return finalize_reply(reply.model_copy(update={"suggestions": suggestions}), scenario, completed)


# ---------------------------------------------------------------------------
# Gloss: what the learner said into the mic, spelled out before they send it
# ---------------------------------------------------------------------------


def build_gloss_system(scenario: ScenarioDefinition) -> str:
    character = scenario.character
    return f"""A beginner Mandarin learner, whose first language is English, is role-playing a traveler talking to {character.name_hanzi} ({character.role.lower()}) at {scenario.setting} in {scenario.city}. They just spoke into the microphone, and speech recognition wrote down what it heard. Before they send it, show them what they said:
- "hanzi": their words in Simplified Chinese exactly as written, keeping their words and mistakes (write any pinyin as characters, leave English words as they are).
- "pinyin": pinyin for "hanzi" with tone marks, words separated by spaces, punctuation kept.
- "english": a natural English translation of what they said. If a word was misheard, translate what they most likely meant in this scene.
Don't correct them, answer them or add comments. Never use emojis."""


def gloss_learner_line(scenario: ScenarioDefinition, text: str) -> Phrase:
    """The learner's checked transcript in pinyin and English, so they know what they're about to send."""
    client = _get_client()
    for attempt in (1, 2):
        try:
            # No temperature / top_p / top_k: Claude Haiku 5.5 rejects sampling parameters.
            response = client.messages.parse(
                model=get_settings().anthropic_gloss_model,
                max_tokens=GLOSS_MAX_TOKENS,
                system=build_gloss_system(scenario),
                messages=[{"role": "user", "content": text}],
                output_config={"effort": "low"},
                output_format=Phrase,
            )
        except anthropic.APIError as error:
            if attempt == 1 and _is_retryable(error):
                logger.warning("Claude overloaded or timed out on a gloss; retrying once")
                continue
            logger.exception("Claude gloss request failed")
            raise _map_error(error)
        except pydantic.ValidationError:
            logger.exception("Claude returned JSON that doesn't match Phrase")
            raise ApiError(502, "translate_failed", "Couldn't translate that. Try again.")

        gloss = response.parsed_output
        if gloss is None or not gloss.english.strip():
            logger.error("Claude returned no gloss (stop_reason=%s)", response.stop_reason)
            raise ApiError(502, "translate_failed", "Couldn't translate that. Try again.")
        return Phrase(
            hanzi=strip_emojis(gloss.hanzi) or text,
            pinyin=strip_emojis(gloss.pinyin),
            english=strip_emojis(gloss.english),
        )

    raise ApiError(503, "tutor_busy", "Translation is busy right now. Try again in a moment.")
