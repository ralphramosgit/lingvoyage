"""Shapes for local packs: what the research agent finds, and what the content agents make from it.

They mirror the tables location_packs, location_facts and location_content (SQL in issue #32).
A fact's `data` is checked against the model for its category before it's saved, so a bad
record from the agent is rejected here instead of reaching the app.
"""

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FactCategory = Literal["culture", "etiquette", "fun_fact", "transport", "hot_spot", "restaurant", "menu_item", "price"]
Confidence = Literal["high", "medium", "low"]
PackStatus = Literal["queued", "running", "ready", "failed"]
PackStage = Literal["plan", "research", "deep_dive", "verify", "generate", "publish"]
ContentKind = Literal["encounter", "unit_notes", "quiz"]

# Groups facts about one place, e.g. "chen-mapo-tofu".
PLACE_KEY_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
MAX_CNY = 100_000

Cny = Annotated[int, Field(ge=0, le=MAX_CNY)]
Name = Annotated[str, Field(min_length=1, max_length=80)]


def _check_range(low: int | None, high: int | None, label: str) -> None:
    if low is not None and high is not None and low > high:
        raise ValueError(f"{label}: the minimum ({low}) is above the maximum ({high})")


# ---------------------------------------------------------------------------
# `data` per fact category
# ---------------------------------------------------------------------------


class _Data(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TransportData(_Data):
    mode: Literal["metro", "airport_link", "bus", "taxi", "didi", "train", "bike"]
    line: str | None = Field(default=None, max_length=40)  # "18"
    origin: str | None = Field(default=None, max_length=80)  # "Tianfu Airport"
    destination: str | None = Field(default=None, max_length=80)
    fare_cny_min: Cny | None = None
    fare_cny_max: Cny | None = None
    minutes: int | None = Field(default=None, ge=0, le=24 * 60)

    @model_validator(mode="after")
    def _fares(self) -> "TransportData":
        _check_range(self.fare_cny_min, self.fare_cny_max, "fare")
        return self


class HotSpotData(_Data):
    name: Name
    name_hanzi: str = Field(default="", max_length=40)  # "" if it has no established Chinese name
    area: str | None = Field(default=None, max_length=80)
    ticket_cny: Cny | None = None
    opening_hours: str | None = Field(default=None, max_length=80)
    tips: str | None = Field(default=None, max_length=200)


class RestaurantData(_Data):
    name: Name
    name_hanzi: str = Field(default="", max_length=40)
    cuisine: str = Field(min_length=1, max_length=60)
    area: str | None = Field(default=None, max_length=80)
    price_per_person_cny: Cny | None = None
    known_for: list[Annotated[str, Field(min_length=1, max_length=40)]] = Field(default_factory=list, max_length=10)


class MenuItemData(_Data):
    dish: Name
    dish_hanzi: str = Field(min_length=1, max_length=30)  # a dish without Chinese is no use to a learner
    dish_pinyin: str = Field(min_length=1, max_length=80)
    price_cny: Cny | None = None
    spicy: bool | None = None
    vegetarian: bool | None = None


class PriceData(_Data):
    item: Name  # "bottle of water"
    price_cny_min: Cny
    price_cny_max: Cny

    @model_validator(mode="after")
    def _prices(self) -> "PriceData":
        _check_range(self.price_cny_min, self.price_cny_max, "price")
        return self


class NoData(_Data):
    """culture, etiquette and fun_fact: the title and body say it all."""


DATA_MODELS: dict[str, type[_Data]] = {
    "culture": NoData,
    "etiquette": NoData,
    "fun_fact": NoData,
    "transport": TransportData,
    "hot_spot": HotSpotData,
    "restaurant": RestaurantData,
    "menu_item": MenuItemData,
    "price": PriceData,
}


# ---------------------------------------------------------------------------
# Rows
# ---------------------------------------------------------------------------


class FactDraft(BaseModel):
    """A fact as the research agent records it, before it's saved."""

    model_config = ConfigDict(str_strip_whitespace=True)

    category: FactCategory
    place_key: str | None = Field(default=None, max_length=60, pattern=PLACE_KEY_PATTERN)
    title: str = Field(min_length=1, max_length=80)  # English
    body: str = Field(min_length=1, max_length=400)  # English, 1–3 sentences
    hanzi: str = Field(default="", max_length=80)
    pinyin: str = Field(default="", max_length=160)
    data: dict[str, Any] = Field(default_factory=dict)
    source_url: str = Field(min_length=1, max_length=2000)
    source_title: str = Field(default="", max_length=200)
    confidence: Confidence = "medium"

    @field_validator("source_url")
    @classmethod
    def _http_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("must be an http or https URL")
        return value

    @model_validator(mode="after")
    def _check_data(self) -> "FactDraft":
        self.data = DATA_MODELS[self.category].model_validate(self.data).model_dump(exclude_none=True)
        if self.category == "menu_item" and not self.place_key:
            raise ValueError("a menu_item needs the place_key of its restaurant")
        return self


class Fact(FactDraft):
    """A saved fact (a location_facts row)."""

    id: str
    pack_id: str
    retrieved_at: datetime


class Pack(BaseModel):
    """A location_packs row: one research run and, once it's ready, the city's pack."""

    id: str
    city: str
    status: PackStatus
    stage: PackStage | None = None
    trace: list[dict[str, Any]] = Field(default_factory=list)
    usage: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None  # a short code like "research_failed", never a stack trace
    requested_by: str | None = None
    created_at: datetime
    finished_at: datetime | None = None
    expires_at: datetime | None = None

    def is_stale(self, now: datetime | None = None) -> bool:
        """A ready pack past its expiry. It's still served while a refresh builds the next one."""
        if self.status != "ready" or self.expires_at is None:
            return False
        return self.expires_at <= (now or datetime.now(UTC))


class ContentItem(BaseModel):
    """A location_content row: an encounter, a unit's local notes or a quiz, made from the facts."""

    pack_id: str
    kind: ContentKind
    ref: str = Field(min_length=1, max_length=120)  # scenario id, unit id or quiz id
    payload: dict[str, Any]
    fact_ids: list[str] = Field(default_factory=list)
