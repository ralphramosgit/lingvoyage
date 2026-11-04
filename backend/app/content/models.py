"""What a pack adds to the Lessons and Quiz tabs (issue #36): local notes, practice lessons, quizzes.

The course itself lives in the app (mobile/src/content/lessons/) and stays the same everywhere. A pack
only adds to it: an "In Chengdu" section on some units, a local practice lesson on a few of them, and
a section of local quizzes. Questions use the backend's two types, choice and build, which the app's
lesson and quiz players already play.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.lessons import Exercise, Lesson, Phrase
from app.scenarios import Source

# The course's units, id → title. Kept in sync by hand with mobile/src/content/lessons/units.ts, like
# mobile/src/types/api.ts: unit ids never change once shipped (progress is saved by them).
COURSE_UNITS: dict[str, str] = {
    "sounds": "How Chinese works",
    "hello": "Hello and thank you",
    "first-sentences": "Your first sentences",
    "quick-answers": "Quick answers",
    "about-you": "About you",
    "numbers": "Numbers",
    "money": "Money",
    "time": "Time and dates",
    "airport": "Arriving at the airport",
    "hotel": "Checking in at the hotel",
    "food": "Ordering food",
    "directions": "Asking directions",
    "getting-around": "Getting around",
    "shopping": "Shopping",
    "help": "Help and emergencies",
    "manners": "Manners and etiquette",
    "table": "At the table",
    "luck": "Luck, gifts and festivals",
    "beijing": "Beijing",
    "shanghai": "Shanghai",
    "chengdu": "Chengdu",
    "chongqing": "Chongqing",
}

QuizIcon = Literal["TrainFront", "UtensilsCrossed", "Landmark"]


class LocalNote(BaseModel):
    title: str = Field(min_length=1, max_length=80)  # "Metro Line 18 to the airport"
    body: str = Field(min_length=1, max_length=300)  # English
    terms: list[Phrase] = Field(default_factory=list, max_length=4)  # Chinese words from the note: 十八号线
    fact_ids: list[str] = Field(min_length=1)  # where it came from


class LocalUnitNotes(BaseModel):
    """The "In Chengdu" section of one unit."""

    unit_id: str
    notes: list[LocalNote] = Field(min_length=2, max_length=4)
    lesson: Lesson | None = None  # id local-<city>-<unit_id>; doesn't count toward finishing the unit
    sources: list[Source] = Field(default_factory=list)
    checked_at: str | None = None  # the day the facts were found (YYYY-MM-DD)

    @field_validator("unit_id")
    @classmethod
    def _known_unit(cls, value: str) -> str:
        if value not in COURSE_UNITS:
            raise ValueError(f"{value!r} isn't a unit in the course")
        return value


class LocalQuiz(BaseModel):
    id: str  # local-<city>-transport, -food or -culture
    title: str  # "Getting around Chengdu"
    summary: str
    icon: QuizIcon
    exercises: list[Exercise] = Field(min_length=6, max_length=10)
    fact_ids: list[str] = Field(default_factory=list)  # the facts its questions use
    sources: list[Source] = Field(default_factory=list)
    checked_at: str | None = None
