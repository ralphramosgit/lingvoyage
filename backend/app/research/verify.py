"""Stage 4: check the facts before they're saved. Code first, then one cheap model call."""

import logging
import re
from typing import Any, Literal

import anthropic
import pydantic
from pydantic import BaseModel

from app.locations.cities import City
from app.locations.models import FactDraft
from app.research import prompts
from app.research.trace import Trace

logger = logging.getLogger("lingvoyage.research")

JUDGE_BATCH = 120  # facts per judge call
_NOT_A_WORD_RE = re.compile(r"[\W_]+")
_CONFIDENCE_RANK = {"high": 2, "medium": 1, "low": 0}
_LOWER = {"high": "medium", "medium": "low", "low": "low"}

# Highest believable fare by mode, in yuan. A high-speed train can cost hundreds; a metro ride can't.
_MAX_FARE = {"metro": 30, "bus": 30, "bike": 30, "airport_link": 150, "taxi": 800, "didi": 800, "train": 3000}
_MAX_MENU_PRICE = 2000
_MAX_PER_PERSON = 3000
_MAX_TICKET = 2000


def _key(fact: FactDraft) -> tuple[str, str, str]:
    return fact.category, fact.place_key or "", _NOT_A_WORD_RE.sub("", fact.title.lower())


def _implausible(fact: FactDraft) -> str | None:
    data = fact.data
    if fact.category == "transport":
        fare = data.get("fare_cny_max", data.get("fare_cny_min"))
        if fare is not None and fare > _MAX_FARE[data["mode"]]:
            return f"a {data['mode']} fare of ¥{fare}"
    elif fact.category == "menu_item" and (data.get("price_cny") or 0) > _MAX_MENU_PRICE:
        return f"a dish at ¥{data['price_cny']}"
    elif fact.category == "restaurant" and (data.get("price_per_person_cny") or 0) > _MAX_PER_PERSON:
        return f"¥{data['price_per_person_cny']} per person"
    elif fact.category == "hot_spot" and (data.get("ticket_cny") or 0) > _MAX_TICKET:
        return f"a ¥{data['ticket_cny']} ticket"
    return None


def check_facts(facts: list[FactDraft]) -> tuple[list[FactDraft], list[tuple[FactDraft, str]]]:
    """Dedupes (keeping the most confident copy), and drops implausible prices and orphaned menu items."""
    best: dict[tuple[str, str, str], FactDraft] = {}
    dropped: list[tuple[FactDraft, str]] = []
    for fact in facts:
        key = _key(fact)
        current = best.get(key)
        if current is None:
            best[key] = fact
        elif _CONFIDENCE_RANK[fact.confidence] > _CONFIDENCE_RANK[current.confidence]:
            best[key] = fact
            dropped.append((current, "duplicate"))
        else:
            dropped.append((fact, "duplicate"))

    restaurants = {fact.place_key for fact in best.values() if fact.category == "restaurant"}
    kept: list[FactDraft] = []
    for fact in best.values():
        if reason := _implausible(fact):
            dropped.append((fact, f"implausible: {reason}"))
        elif fact.category == "menu_item" and fact.place_key not in restaurants:
            dropped.append((fact, "its restaurant wasn't recorded"))
        else:
            kept.append(fact)
    return kept, dropped


class Verdict(BaseModel):
    number: int  # the fact's number in the list
    decision: Literal["drop", "lower_confidence"]
    reason: str


class Verdicts(BaseModel):
    verdicts: list[Verdict]


def judge_facts(
    client: anthropic.Anthropic, model: str, city: City, facts: list[FactDraft], trace: Trace
) -> tuple[list[FactDraft], int, int]:
    """Returns the facts the judge keeps, and how many it dropped and lowered. If it can't answer, keeps them all."""
    kept: list[FactDraft] = []
    dropped = lowered = 0
    for start in range(0, len(facts), JUDGE_BATCH):
        batch = facts[start : start + JUDGE_BATCH]
        verdicts = _ask_judge(client, model, city, batch, trace)
        by_number = {verdict.number: verdict for verdict in verdicts}
        for number, fact in enumerate(batch, start=1):
            verdict = by_number.get(number)
            if verdict is None:
                kept.append(fact)
            elif verdict.decision == "drop":
                dropped += 1
            else:
                lowered += 1
                kept.append(fact.model_copy(update={"confidence": _LOWER[fact.confidence]}))
    return kept, dropped, lowered


def _ask_judge(
    client: anthropic.Anthropic, model: str, city: City, batch: list[FactDraft], trace: Trace
) -> list[Verdict]:
    try:
        response = client.messages.parse(
            model=model,
            max_tokens=8000,
            system=prompts.JUDGE_SYSTEM,
            messages=[{"role": "user", "content": prompts.judge_message(city, batch)}],
            output_config={"effort": "low"},
            output_format=Verdicts,
        )
    except (anthropic.APIError, pydantic.ValidationError) as error:
        logger.warning("Fact judge failed (%s); keeping the batch as it is", type(error).__name__)
        trace.step("verify", "error", "Couldn't run the fact check on one batch, so it was kept as it is")
        return []
    trace.add_usage(response.model, response.usage)
    parsed: Any = response.parsed_output
    return list(parsed.verdicts) if parsed is not None else []


def verify(client: anthropic.Anthropic, model: str, city: City, facts: list[FactDraft], trace: Trace) -> list[FactDraft]:
    checked, dropped = check_facts(facts)
    if dropped:
        trace.step("verify", "check", f"Removed {len(dropped)} duplicate or implausible facts")
    judged, judge_dropped, lowered = judge_facts(client, model, city, checked, trace)
    trace.step(
        "verify",
        "check",
        f"Kept {len(judged)} of {len(facts)} facts ({judge_dropped} dropped by the fact check, {lowered} marked less sure)",
    )
    return judged
