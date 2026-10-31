"""Stage 1: what each research worker looks for. Plain code, no model."""

from collections.abc import Callable, Iterable
from dataclasses import dataclass

from app.locations.cities import City
from app.locations.models import FactDraft


@dataclass(frozen=True)
class Brief:
    worker: str  # shown in the trace: "food", "menu:chen-mapo-tofu"
    topic: str
    goal: str
    target: str
    tools: tuple[str, ...]  # our record_* tools (see tools.py); web search and fetch are always on
    # web_search's max_uses applies per request, so the worker loop also counts searches across the
    # conversation: at max_searches it asks the agent to wrap up, at twice that it stops.
    max_searches: int = 8
    max_fetches: int = 6
    max_iterations: int = 12
    time_limit_seconds: float = 150.0
    place_key: str | None = None  # menu deep dive only: the restaurant
    place_name: str | None = None


def _culture(city: City) -> Brief:
    return Brief(
        worker="culture",
        topic="culture",
        goal=(
            f"What a visitor to {city.name} should know about how things are done here: etiquette and social "
            "norms (greetings, queuing, tipping, paying by phone, what to wear at temples), local customs and "
            "daily life, the local dialect and how widely Mandarin is spoken, and a few memorable fun facts "
            "about the city."
        ),
        target="12 to 20 facts",
        tools=("record_note", "finish"),
    )


def _transport(city: City) -> Brief:
    return Brief(
        worker="transport",
        topic="transport",
        goal=(
            f"How a visitor gets around {city.name}: the metro lines they're most likely to use (line numbers and "
            "where they go), how to get from the airport and the main railway stations into the city (line, fare, "
            "time), the taxi start fare and how DiDi works for visitors, transport cards and paying with Alipay or "
            "WeChat Pay, and anything that surprises first-timers."
        ),
        target="12 to 20 facts",
        tools=("record_transport", "record_price", "finish"),
    )


def _hot_spots(city: City) -> Brief:
    return Brief(
        worker="hot_spots",
        topic="hot_spots",
        goal=(
            f"6 to 10 places visitors actually go in {city.name}: sights, old streets, parks, temples, museums. "
            "For each: its Chinese name, the area it's in, the ticket price (0 if free), opening hours and one "
            "useful tip."
        ),
        target="6 to 10 places",
        tools=("record_hot_spot", "finish"),
    )


def _food(city: City) -> Brief:
    return Brief(
        worker="food",
        topic="food",
        goal=(
            f"Eating in {city.name}: the local dishes a visitor should try; 6 to 8 restaurants a visitor can "
            "actually walk into (Chinese name, area, price per person, what they're known for); and everyday "
            "prices (a bottle of water, a coffee, street food, a bowl of noodles)."
        ),
        target="6 to 8 restaurants, plus local dishes and everyday prices",
        tools=("record_restaurant", "record_note", "record_price", "finish"),
    )


_TOPIC_BRIEFS: dict[str, Callable[[City], Brief]] = {
    "culture": _culture,
    "transport": _transport,
    "hot_spots": _hot_spots,
    "food": _food,
}
TOPICS = tuple(_TOPIC_BRIEFS)


def plan_briefs(city: City, topics: Iterable[str] | None = None) -> list[Brief]:
    wanted = list(topics) if topics else list(TOPICS)
    unknown = [topic for topic in wanted if topic not in _TOPIC_BRIEFS]
    if unknown:
        raise ValueError(f"Unknown topic(s): {', '.join(unknown)}. Use {', '.join(TOPICS)}.")
    return [_TOPIC_BRIEFS[topic](city) for topic in wanted]


def menu_brief(city: City, restaurant: FactDraft) -> Brief:
    """Stage 3: one small worker whose only job is this restaurant's menu."""
    name = restaurant.data.get("name") or restaurant.title
    hanzi = restaurant.data.get("name_hanzi") or ""
    called = f"{name} ({hanzi})" if hanzi else name
    return Brief(
        worker=f"menu:{restaurant.place_key}",
        topic="menu",
        goal=(
            f"The menu at {called} in {city.name}: 6 to 12 dishes with their Chinese names, pinyin and prices in "
            "yuan, which are spicy and which are vegetarian. Look for the restaurant's own menu, recent reviews "
            "and articles that list dishes with prices. If you can't find prices, record the dishes it's known for "
            "without prices and say so when you finish."
        ),
        target="6 to 12 dishes",
        tools=("record_menu_item", "finish"),
        max_searches=4,
        max_fetches=4,
        max_iterations=8,
        time_limit_seconds=120.0,
        place_key=restaurant.place_key,
        place_name=name,
    )
