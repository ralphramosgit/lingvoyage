"""The research workers' own tools: the only way anything gets saved.

Each tool's schema comes from a Pydantic model below. `anthropic.transform_schema` turns it into a
strict-mode schema (moving the length and number limits into the descriptions), and the same model
checks every input again here. Errors go back to the agent as tool results so it can fix them.

Sources are checked too: a fact's source_url must be a page this worker actually saw in its search
or fetch results or a citation (or another page on a site it saw), so the agent can't make one up.
Code execution output doesn't count: the agent writes that code, so it could print any URL.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from functools import cache
from typing import Any, Literal
from urllib.parse import urlsplit

import pydantic
from anthropic import transform_schema
from pydantic import BaseModel, Field

from app.locations.models import PLACE_KEY_PATTERN, Cny, Confidence, FactDraft
from app.research.briefs import Brief
from app.research.trace import Trace

MAX_FACTS_PER_WORKER = 40

_SOURCE_RESULTS = {"web_search_tool_result", "web_fetch_tool_result"}
_OPAQUE_KEYS = {"encrypted_content", "encrypted_index", "data"}  # blobs and page text, not result URLs
_NOT_A_WORD_RE = re.compile(r"[\W_]+")


# ---------------------------------------------------------------------------
# Tool inputs
# ---------------------------------------------------------------------------


class _Sourced(BaseModel):
    source_url: str = Field(
        max_length=2000,
        description="The exact URL of the page this came from: one from your search results or a page you fetched.",
    )
    source_title: str = Field(default="", max_length=200, description="That page's title.")
    confidence: Confidence = Field(
        default="medium",
        description="high: an official source, or two sources agree. medium: one good source. low: old, vague or a single blog.",
    )


class _Described(_Sourced):
    title: str = Field(max_length=80, description="A short English title.")
    body: str = Field(max_length=400, description="One to three plain English sentences for a traveler.")
    hanzi: str = Field(default="", max_length=80, description="The key Chinese term, in simplified characters, if there is one.")
    pinyin: str = Field(default="", max_length=160, description="Its pinyin with tone marks, words separated by spaces.")


class NoteInput(_Described):
    category: Literal["culture", "etiquette", "fun_fact"]


class TransportInput(_Described):
    mode: Literal["metro", "airport_link", "bus", "taxi", "didi", "train", "bike"]
    line: str | None = Field(default=None, max_length=40, description='Line name or number, e.g. "18".')
    origin: str | None = Field(default=None, max_length=80, description="Where it starts, e.g. Tianfu Airport.")
    destination: str | None = Field(default=None, max_length=80)
    fare_cny_min: Cny | None = None
    fare_cny_max: Cny | None = None
    minutes: int | None = Field(default=None, ge=0, le=24 * 60, description="How long the ride takes.")


class PriceInput(_Sourced):
    item: str = Field(max_length=80, description='What it is, in English: "a bottle of water".')
    item_hanzi: str = Field(default="", max_length=40)
    item_pinyin: str = Field(default="", max_length=80)
    price_cny_min: Cny
    price_cny_max: Cny = Field(description="Same as the minimum if there's one price.")
    note: str = Field(default="", max_length=300, description="Where or when this price applies, in English.")


class _Place(_Sourced):
    place_key: str = Field(
        max_length=60, pattern=PLACE_KEY_PATTERN, description='A lowercase id with hyphens, e.g. "chen-mapo-tofu".'
    )
    name: str = Field(max_length=80, description="The name in English.")
    name_hanzi: str = Field(
        default="", max_length=40, description="The established Chinese name. Leave it empty if there isn't one."
    )
    name_pinyin: str = Field(default="", max_length=80)
    body: str = Field(max_length=400, description="What it is and why visitors go, in one to three sentences.")
    area: str | None = Field(default=None, max_length=80, description="The district or street.")


class HotSpotInput(_Place):
    ticket_cny: Cny | None = Field(default=None, description="0 if it's free.")
    opening_hours: str | None = Field(default=None, max_length=80)
    tips: str | None = Field(default=None, max_length=200, description="One useful tip for a visitor.")


class RestaurantInput(_Place):
    cuisine: str = Field(max_length=60, description='e.g. "Sichuan", "hot pot", "noodles".')
    price_per_person_cny: Cny | None = None
    known_for: list[str] = Field(
        default_factory=list, max_length=10, description="Dishes it's known for, in Chinese characters if you have them."
    )


class MenuItemInput(_Sourced):
    dish: str = Field(max_length=80, description="The dish in English.")
    dish_hanzi: str = Field(min_length=1, max_length=30, description="The dish in simplified characters.")
    dish_pinyin: str = Field(min_length=1, max_length=80)
    price_cny: Cny | None = None
    spicy: bool | None = None
    vegetarian: bool | None = None


class FinishInput(BaseModel):
    summary: str = Field(max_length=160, description="One line on what you found, for the learner to read.")
    gaps: list[str] = Field(default_factory=list, max_length=5, description="What you looked for but couldn't find.")


# ---------------------------------------------------------------------------
# Inputs to facts
# ---------------------------------------------------------------------------


def _source(value: _Sourced) -> dict[str, Any]:
    return {"source_url": value.source_url, "source_title": value.source_title, "confidence": value.confidence}


def _yuan(low: int | None, high: int | None) -> str:
    if low is None and high is None:
        return ""
    if low is None or high is None or low == high:
        return f"¥{low if high is None else high}"
    return f"¥{low}–¥{high}"


def _fact(value: _Sourced, **fields: Any) -> FactDraft:
    return FactDraft(
        source_url=value.source_url, source_title=value.source_title, confidence=value.confidence, **fields
    )


def _note_fact(value: NoteInput, _: Brief) -> FactDraft:
    return _fact(
        value, category=value.category, title=value.title, body=value.body, hanzi=value.hanzi, pinyin=value.pinyin
    )


def _transport_fact(value: TransportInput, _: Brief) -> FactDraft:
    data = value.model_dump(include={"mode", "line", "origin", "destination", "fare_cny_min", "fare_cny_max", "minutes"})
    return _fact(
        value, category="transport", title=value.title, body=value.body, hanzi=value.hanzi, pinyin=value.pinyin, data=data
    )


def _price_fact(value: PriceInput, _: Brief) -> FactDraft:
    return _fact(
        value,
        category="price",
        title=value.item,
        body=value.note or f"{value.item}: {_yuan(value.price_cny_min, value.price_cny_max)}.",
        hanzi=value.item_hanzi,
        pinyin=value.item_pinyin,
        data={"item": value.item, "price_cny_min": value.price_cny_min, "price_cny_max": value.price_cny_max},
    )


def _place_fact(value: _Place, category: str, data: dict[str, Any]) -> FactDraft:
    return _fact(
        value,
        category=category,
        place_key=value.place_key,
        title=value.name,
        body=value.body,
        hanzi=value.name_hanzi,
        pinyin=value.name_pinyin,
        data=data,
    )


def _hot_spot_fact(value: HotSpotInput, _: Brief) -> FactDraft:
    data = value.model_dump(include={"name", "name_hanzi", "area", "ticket_cny", "opening_hours", "tips"})
    return _place_fact(value, "hot_spot", data)


def _restaurant_fact(value: RestaurantInput, _: Brief) -> FactDraft:
    data = value.model_dump(include={"name", "name_hanzi", "cuisine", "area", "price_per_person_cny", "known_for"})
    return _place_fact(value, "restaurant", data)


def _menu_item_fact(value: MenuItemInput, brief: Brief) -> FactDraft:
    price = f", {_yuan(value.price_cny, value.price_cny)}" if value.price_cny is not None else ""
    return _fact(
        value,
        category="menu_item",
        place_key=brief.place_key,
        title=value.dish,
        body=f"On the menu at {brief.place_name}: {value.dish} ({value.dish_hanzi}){price}.",
        hanzi=value.dish_hanzi,
        pinyin=value.dish_pinyin,
        data=value.model_dump(include={"dish", "dish_hanzi", "dish_pinyin", "price_cny", "spicy", "vegetarian"}),
    )


@dataclass(frozen=True)
class _Spec:
    model: type[BaseModel]
    description: str
    to_fact: Callable[[Any, Brief], FactDraft] | None  # None: finish


SPECS: dict[str, _Spec] = {
    "record_note": _Spec(
        NoteInput, "Save one fact about local culture, etiquette and norms, or a fun fact. Call it as soon as you have one.", _note_fact
    ),
    "record_transport": _Spec(
        TransportInput, "Save one fact about getting around: a metro line, an airport or station link, taxis, DiDi, cards.", _transport_fact
    ),
    "record_price": _Spec(PriceInput, "Save what an everyday thing costs here, in whole yuan.", _price_fact),
    "record_hot_spot": _Spec(HotSpotInput, "Save one place visitors go, with its Chinese name, area, ticket and hours.", _hot_spot_fact),
    "record_restaurant": _Spec(
        RestaurantInput, "Save one restaurant a visitor can walk into, with its Chinese name, price per person and dishes.", _restaurant_fact
    ),
    "record_menu_item": _Spec(MenuItemInput, "Save one dish from this restaurant's menu, with its price if you found it.", _menu_item_fact),
    "finish": _Spec(FinishInput, "Call once, at the end, with a one-line summary and what you couldn't find.", None),
}


_SOURCE_FIELDS = ("source_url", "source_title", "confidence")


@cache
def tool_definition(name: str) -> dict[str, Any]:
    spec = SPECS[name]
    schema = transform_schema(spec.model)
    # Inherited fields come first; put the source last so the agent writes the fact, then where it's from.
    properties = schema["properties"]
    schema["properties"] = {
        **{key: value for key, value in properties.items() if key not in _SOURCE_FIELDS},
        **{key: properties[key] for key in _SOURCE_FIELDS if key in properties},
    }
    return {"name": name, "description": spec.description, "input_schema": schema, "strict": True}


# ---------------------------------------------------------------------------
# URLs
# ---------------------------------------------------------------------------


def domain_of(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host.removeprefix("www.")


def _normalize(url: str) -> str:
    parts = urlsplit(url.strip())
    path = parts.path.rstrip("/")
    query = f"?{parts.query}" if parts.query else ""
    return f"{domain_of(url)}{path}{query}"


def _urls_in(value: Any) -> set[str]:
    """Every `url` field inside a dumped block."""
    found: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "url" and isinstance(item, str):
                found.add(item)
            elif key not in _OPAQUE_KEYS:
                found |= _urls_in(item)
    elif isinstance(value, list):
        for item in value:
            found |= _urls_in(item)
    return found


# ---------------------------------------------------------------------------
# The toolbox: one per worker
# ---------------------------------------------------------------------------


class ToolBox:
    def __init__(self, brief: Brief, trace: Trace, stage: str) -> None:
        self.brief = brief
        self.facts: list[FactDraft] = []
        self.finished: FinishInput | None = None
        self._trace = trace
        self._stage = stage
        self._urls: set[str] = set()
        self._domains: set[str] = set()
        self._saved: set[tuple[str, str, str]] = set()

    def definitions(self) -> list[dict[str, Any]]:
        return [tool_definition(name) for name in self.brief.tools]

    def see(self, block: Any) -> None:
        """Remembers the pages in a search or fetch result, or cited in the agent's text."""
        kind = getattr(block, "type", "")
        if kind in _SOURCE_RESULTS:
            urls = _urls_in(block.model_dump())
        elif kind == "text":
            # Only citations: a URL the agent typed itself isn't a page it saw.
            urls = _urls_in(block.model_dump().get("citations") or [])
        else:
            return
        for url in urls:
            if urlsplit(url).scheme in ("http", "https"):
                self._urls.add(_normalize(url))
                self._domains.add(domain_of(url))

    def has_seen(self, url: str) -> bool:
        return _normalize(url) in self._urls or domain_of(url) in self._domains

    def run(self, block: Any) -> dict[str, Any]:
        """Runs one tool_use block and returns its tool_result."""
        text, is_error = self._run(block.name, block.input)
        return {"type": "tool_result", "tool_use_id": block.id, "content": text, "is_error": is_error}

    def _run(self, name: str, raw: Any) -> tuple[str, bool]:
        spec = SPECS.get(name)
        if spec is None or name not in self.brief.tools:
            return f"There's no tool called {name} here.", True
        try:
            value = spec.model.model_validate(raw)
        except pydantic.ValidationError as error:
            return _not_saved(error), True

        if spec.to_fact is None:
            self.finished = value  # type: ignore[assignment]
            return "Thanks, that's everything for this topic.", False
        if len(self.facts) >= MAX_FACTS_PER_WORKER:
            return "You've saved as many facts as this topic allows. Call finish now.", True
        if not self.has_seen(value.source_url):  # type: ignore[attr-defined]
            return (
                "Not saved: source_url isn't a page from your search or fetch results. "
                "Use the exact URL of the page the fact came from.",
                True,
            )
        try:
            fact = spec.to_fact(value, self.brief)
        except pydantic.ValidationError as error:
            return _not_saved(error), True

        key = (fact.category, fact.place_key or "", _NOT_A_WORD_RE.sub("", fact.title.lower()))
        if key in self._saved:
            return f"Already saved: {fact.title}. Move on to something new.", False
        self._saved.add(key)
        self.facts.append(fact)
        self._trace.step(self._stage, "found", found_text(fact), worker=self.brief.worker)
        return f"Saved ({len(self.facts)} so far): {fact.title}", False


def _not_saved(error: pydantic.ValidationError) -> str:
    problems = []
    for item in error.errors()[:5]:
        where = ".".join(str(part) for part in item["loc"]) or "input"
        problems.append(f"{where}: {item['msg']}")
    return "Not saved. Fix this and try again: " + "; ".join(problems)


def found_text(fact: FactDraft) -> str:
    """One line for the trace: "Chen Mapo Tofu (陈麻婆豆腐), about ¥60 per person"."""
    text = f"{fact.title} ({fact.hanzi})" if fact.hanzi and fact.hanzi != fact.title else fact.title
    data = fact.data
    if fact.category == "restaurant" and data.get("price_per_person_cny") is not None:
        text += f", about ¥{data['price_per_person_cny']} per person"
    elif fact.category == "menu_item" and data.get("price_cny") is not None:
        text += f", ¥{data['price_cny']}"
    elif fact.category == "transport" and (fare := _yuan(data.get("fare_cny_min"), data.get("fare_cny_max"))):
        text += f", {fare}"
    elif fact.category == "price":
        text += f", {_yuan(data.get('price_cny_min'), data.get('price_cny_max'))}"
    elif fact.category == "hot_spot" and data.get("ticket_cny") is not None:
        text += ", free" if data["ticket_cny"] == 0 else f", ¥{data['ticket_cny']}"
    return text
