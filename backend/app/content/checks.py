"""Checks for generated content: beginner level, and every number coming from a fact.

The content agents (encounters now, lessons and quizzes in #36) write Chinese for beginners from
the facts the research agent found. These checks run on every draft, and what they find goes back
to the agent to fix: characters above beginner level that the lessons don't teach, and prices or
metro line numbers that aren't in the facts.
"""

import json
import re
from collections.abc import Iterable
from functools import cache
from pathlib import Path

from app.locations.models import FactDraft
from app.scenarios import SCENARIOS

_HAN_RE = re.compile(r"[㐀-鿿]")
# A run of Chinese: characters, plus Chinese punctuation, digits and spaces between them.
_CHINESE_RUN_RE = re.compile(r"[㐀-鿿][㐀-鿿　-〿！-～0-9 ]*")
_TONE_MARK_RE = re.compile("[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]")

_CN_DIGITS = {"零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
_CN_UNITS = {"十": 10, "百": 100, "千": 1000}
_CN_NUMBER = "[零〇一二两三四五六七八九十百千]+"
_PRICE_RES = (
    re.compile(r"[¥￥]\s*(\d+)"),
    re.compile(r"(\d+)\s*(?:元|块(?!儿)|yuan\b|kuai\b|RMB\b|CNY\b)", re.IGNORECASE),
    re.compile(rf"({_CN_NUMBER})\s*(?:元|块(?!儿))"),  # 三十八块, but not 一块儿 (together)
)
_LINE_RES = (
    re.compile(r"(\d+)\s*号线"),
    re.compile(rf"({_CN_NUMBER})\s*号线"),
    re.compile(r"\bline\s*(\d+)", re.IGNORECASE),
)
_PRICE_FIELDS = (
    "price_cny",
    "price_per_person_cny",
    "fare_cny_min",
    "fare_cny_max",
    "ticket_cny",
    "price_cny_min",
    "price_cny_max",
)


def han_chars(text: str) -> set[str]:
    return set(_HAN_RE.findall(text))


def han_count(text: str) -> int:
    return len(_HAN_RE.findall(text))


def chinese_runs(text: str) -> list[str]:
    """The stretches of Chinese in a mixed English and Chinese line."""
    return [match.group(0).strip() for match in _CHINESE_RUN_RE.finditer(text)]


def has_tone_marks(pinyin: str) -> bool:
    return bool(_TONE_MARK_RE.search(pinyin))


# ---------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------


def chinese_number(text: str) -> int | None:
    """三十八 → 38, 一百零五 → 105, 两百 → 200, 十八 → 18, 二零二四 → 2024. None if it isn't a number."""
    if any(char not in _CN_DIGITS and char not in _CN_UNITS for char in text) or not text:
        return None
    if not any(char in _CN_UNITS for char in text):
        return int("".join(str(_CN_DIGITS[char]) for char in text))
    total = current = 0
    for char in text:
        if char in _CN_DIGITS:
            current = _CN_DIGITS[char]
        else:
            total += (current or 1) * _CN_UNITS[char]
            current = 0
    return total + current


def _numbers(text: str, patterns: tuple[re.Pattern[str], ...]) -> set[int]:
    found: set[int] = set()
    for pattern in patterns:
        for match in pattern.finditer(text):
            raw = match.group(1)
            value = int(raw) if raw.isdigit() else chinese_number(raw)
            if value is not None:
                found.add(value)
    return found


def prices_in(text: str) -> set[int]:
    """Prices written with ¥, 元, 块 or yuan, in digits or Chinese numerals."""
    return _numbers(text, _PRICE_RES)


def lines_in(text: str) -> set[int]:
    """Metro line numbers: 18号线, 十八号线, Line 18."""
    return _numbers(text, _LINE_RES)


def fact_numbers(facts: Iterable[FactDraft]) -> tuple[set[int], set[int]]:
    """Every price and line number the facts give, from their data and their text."""
    prices: set[int] = set()
    lines: set[int] = set()
    for fact in facts:
        for field in _PRICE_FIELDS:
            value = fact.data.get(field)
            if isinstance(value, int):
                prices.add(value)
        line = fact.data.get("line")
        if isinstance(line, str) and line.strip().isdigit():
            lines.add(int(line))
        text = f"{fact.title} {fact.body} {fact.hanzi}"
        prices |= prices_in(text)
        lines |= lines_in(text)
    return prices, lines


# ---------------------------------------------------------------------------
# Level
# ---------------------------------------------------------------------------


@cache
def beginner_chars() -> frozenset[str]:
    """Characters of the HSK 1–2 words, plus every character the hand-written scenes already use."""
    lines = Path(__file__).with_name("hsk12.txt").read_text(encoding="utf-8").splitlines()
    chars = han_chars("".join(line.strip() for line in lines if not line.startswith("#")))
    for scenario in SCENARIOS:
        taught = scenario.model_dump(include={"key_phrases", "lessons", "scene_outline"})
        chars |= han_chars(json.dumps(taught, ensure_ascii=False))
    return frozenset(chars)


def name_chars(facts: Iterable[FactDraft]) -> set[str]:
    """Characters in the facts' Chinese. Place, dish and line names can be above beginner level."""
    chars: set[str] = set()
    for fact in facts:
        chars |= han_chars(fact.hanzi)
        for value in fact.data.values():
            if isinstance(value, str):
                chars |= han_chars(value)
            elif isinstance(value, list):
                chars |= han_chars(" ".join(item for item in value if isinstance(item, str)))
    return chars


def above_level(texts: Iterable[str], allowed: set[str] | frozenset[str]) -> dict[str, str]:
    """Characters that aren't in `allowed`, each with the first text it appears in."""
    found: dict[str, str] = {}
    for text in texts:
        for char in _HAN_RE.findall(text):
            if char not in allowed and char not in found:
                found[char] = text
    return found
