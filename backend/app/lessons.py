"""Practice lessons the learner can take before an encounter.

Each lesson teaches one sentence pattern and a few words, then quizzes them: multiple-choice
questions and "build the sentence" word tiles. The encounter's character is told what the
lessons teach (see tutor.build_system_prompt), so the scene uses the same language.

Content is checked when this module loads (answers in range, tiles that spell the solution),
so a typo here fails the tests instead of showing up in the app.
"""

import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

BLANK = "＿＿"  # marks the gap in a fill-in-the-blank question
_NOT_A_WORD_RE = re.compile(r"[\s，。？！、,.?!…]")


class Phrase(BaseModel):
    hanzi: str
    pinyin: str
    english: str


class Option(BaseModel):
    """A multiple-choice answer: Chinese (hanzi and pinyin), or English for "what does it mean?" questions."""

    hanzi: str = ""
    pinyin: str = ""
    english: str = ""


class Tile(BaseModel):
    hanzi: str
    pinyin: str


class ChoiceExercise(BaseModel):
    kind: Literal["choice"] = "choice"
    prompt: str
    # Chinese the question is about, shown under the prompt with a play button. BLANK marks a gap.
    hanzi: str = ""
    pinyin: str = ""
    options: list[Option]
    answer: int  # index into options; the app shuffles them
    hint: str  # a nudge, not the answer
    solution: Phrase  # shown, with a play button, once the question is answered

    @model_validator(mode="after")
    def _check(self) -> "ChoiceExercise":
        if not 2 <= len(self.options) <= 4:
            raise ValueError(f"{self.prompt!r}: needs 2 to 4 options")
        if not 0 <= self.answer < len(self.options):
            raise ValueError(f"{self.prompt!r}: answer {self.answer} is not one of the options")
        labels = [option.hanzi or option.english for option in self.options]
        if not all(labels) or len(set(labels)) != len(labels):
            raise ValueError(f"{self.prompt!r}: every option needs its own hanzi or english")
        return self


class BuildExercise(BaseModel):
    """Tap word tiles into the right order to build the solution."""

    kind: Literal["build"] = "build"
    prompt: str
    tiles: list[Tile]  # the answer, in order; the app shuffles them in with extra_tiles
    extra_tiles: list[Tile] = Field(default_factory=list)  # tiles that don't belong
    hint: str
    solution: Phrase

    @model_validator(mode="after")
    def _check(self) -> "BuildExercise":
        if len(self.tiles) < 2:
            raise ValueError(f"{self.prompt!r}: needs at least 2 tiles")
        built = "".join(tile.hanzi for tile in self.tiles)
        if built != _NOT_A_WORD_RE.sub("", self.solution.hanzi):
            raise ValueError(f"{self.prompt!r}: tiles spell {built!r}, not {self.solution.hanzi!r}")
        if {tile.hanzi for tile in self.extra_tiles} & {tile.hanzi for tile in self.tiles}:
            raise ValueError(f"{self.prompt!r}: an extra tile repeats an answer tile")
        return self


Exercise = Annotated[ChoiceExercise | BuildExercise, Field(discriminator="kind")]


class Lesson(BaseModel):
    id: str
    title: str
    summary: str
    pattern: Phrase | None = None  # the sentence pattern taught, slots in [brackets]
    examples: list[Phrase]
    words: list[Phrase]
    tip: str = ""
    exercises: list[Exercise] = Field(min_length=1)


def _p(hanzi: str, pinyin: str, english: str) -> Phrase:
    return Phrase(hanzi=hanzi, pinyin=pinyin, english=english)


def _zh(hanzi: str, pinyin: str) -> Option:
    return Option(hanzi=hanzi, pinyin=pinyin)


def _en(english: str) -> Option:
    return Option(english=english)


def _t(hanzi: str, pinyin: str) -> Tile:
    return Tile(hanzi=hanzi, pinyin=pinyin)


# ---------------------------------------------------------------------------
# Airport (from the "Going to the airport" beginner sentence frames)
# ---------------------------------------------------------------------------

AIRPORT_LESSONS = [
    Lesson(
        id="where-is",
        title="Asking where something is",
        summary="Find your luggage, the bus or a DiDi.",
        pattern=_p("[place] + 在哪里？", "[place] + zài nǎlǐ?", "Where is [place]?"),
        examples=[
            _p("行李在哪里？", "Xíngli zài nǎlǐ?", "Where is my luggage?"),
            _p("巴士在哪里？", "Bāshì zài nǎlǐ?", "Where is the bus?"),
            _p("滴滴在哪里？", "Dīdī zài nǎlǐ?", "Where is the DiDi pickup?"),
        ],
        words=[
            _p("在", "zài", "at, is at"),
            _p("哪里", "nǎlǐ", "where"),
            _p("行李", "xíngli", "luggage"),
            _p("巴士", "bāshì", "bus"),
            _p("滴滴", "Dīdī", "DiDi, the ride app (like Uber)"),
            _p("酒店", "jiǔdiàn", "hotel"),
        ],
        tip="Say the thing you need, then add 在哪里？ That's a whole question.",
        exercises=[
            ChoiceExercise(
                prompt="What does this word mean?",
                hanzi="哪里",
                pinyin="nǎlǐ",
                options=[_en("Where"), _en("Here"), _en("What")],
                answer=0,
                hint="It's the word you use to ask about a place.",
                solution=_p("哪里", "nǎlǐ", "Where"),
            ),
            ChoiceExercise(
                prompt="What does this word mean?",
                hanzi="行李",
                pinyin="xíngli",
                options=[_en("Luggage"), _en("Bus"), _en("Hotel")],
                answer=0,
                hint="It's what you pick up after your flight lands.",
                solution=_p("行李", "xíngli", "Luggage"),
            ),
            ChoiceExercise(
                prompt="How do you ask “Where is the bus?”",
                options=[_zh("巴士在哪里？", "Bāshì zài nǎlǐ?"), _zh("行李在哪里？", "Xíngli zài nǎlǐ?"), _zh("酒店在哪里？", "Jiǔdiàn zài nǎlǐ?")],
                answer=0,
                hint="All three ask “where is…?”. Look for the word for bus: 巴士 (bāshì).",
                solution=_p("巴士在哪里？", "Bāshì zài nǎlǐ?", "Where is the bus?"),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “Where is the DiDi pickup?”",
                hanzi=f"滴滴在{BLANK}？",
                pinyin=f"Dīdī zài {BLANK}?",
                options=[_zh("哪里", "nǎlǐ"), _zh("巴士", "bāshì"), _zh("酒店", "jiǔdiàn")],
                answer=0,
                hint="You need the question word for “where”.",
                solution=_p("滴滴在哪里？", "Dīdī zài nǎlǐ?", "Where is the DiDi pickup?"),
            ),
            BuildExercise(
                prompt="Build this sentence: “Where is my luggage?”",
                tiles=[_t("行李", "xíngli"), _t("在", "zài"), _t("哪里", "nǎlǐ")],
                extra_tiles=[_t("巴士", "bāshì")],
                hint="Start with the thing you're looking for, then add 在哪里.",
                solution=_p("行李在哪里？", "Xíngli zài nǎlǐ?", "Where is my luggage?"),
            ),
        ],
    ),
    Lesson(
        id="want-to-go",
        title="Saying where you want to go",
        summary="Tell someone where you're headed.",
        pattern=_p("我要去 + [place]。", "Wǒ yào qù + [place].", "I want to go to [place]."),
        examples=[
            _p("我要去酒店。", "Wǒ yào qù jiǔdiàn.", "I want to go to the hotel."),
            _p("我要去厕所。", "Wǒ yào qù cèsuǒ.", "I want to go to the restroom."),
            _p("你要去哪里？", "Nǐ yào qù nǎlǐ?", "Where do you want to go?"),
        ],
        words=[
            _p("我", "wǒ", "I, me"),
            _p("你", "nǐ", "you"),
            _p("要", "yào", "want"),
            _p("去", "qù", "go"),
            _p("厕所", "cèsuǒ", "restroom"),
        ],
        tip="When someone asks 你要去哪里？, answer with the same words: swap 你 (you) for 我 (I), and 哪里 for the place.",
        exercises=[
            ChoiceExercise(
                prompt="What does this word mean?",
                hanzi="去",
                pinyin="qù",
                options=[_en("Go"), _en("Want"), _en("Where")],
                answer=0,
                hint="It's the action of heading somewhere.",
                solution=_p("去", "qù", "Go"),
            ),
            ChoiceExercise(
                prompt="Xiao Lin asks you this. What does it mean?",
                hanzi="你要去哪里？",
                pinyin="Nǐ yào qù nǎlǐ?",
                options=[_en("Where do you want to go?"), _en("Where is your luggage?"), _en("Do you want the bus?")],
                answer=0,
                hint="你 is “you”, 要去 is “want to go”, and 哪里 is “where”.",
                solution=_p("你要去哪里？", "Nǐ yào qù nǎlǐ?", "Where do you want to go?"),
            ),
            ChoiceExercise(
                prompt="You're going to your hotel. How do you answer 你要去哪里？",
                options=[_zh("我要去酒店。", "Wǒ yào qù jiǔdiàn."), _zh("你要去酒店。", "Nǐ yào qù jiǔdiàn."), _zh("酒店在哪里？", "Jiǔdiàn zài nǎlǐ?")],
                answer=0,
                hint="You're talking about yourself, so start with 我 (wǒ), “I”.",
                solution=_p("我要去酒店。", "Wǒ yào qù jiǔdiàn.", "I want to go to the hotel."),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “I want to go to the restroom.”",
                hanzi=f"我要去{BLANK}。",
                pinyin=f"Wǒ yào qù {BLANK}.",
                options=[_zh("厕所", "cèsuǒ"), _zh("行李", "xíngli"), _zh("巴士", "bāshì")],
                answer=0,
                hint="The restroom is 厕所 (cèsuǒ).",
                solution=_p("我要去厕所。", "Wǒ yào qù cèsuǒ.", "I want to go to the restroom."),
            ),
            BuildExercise(
                prompt="Build this sentence: “I want to go to the hotel.”",
                tiles=[_t("我", "wǒ"), _t("要", "yào"), _t("去", "qù"), _t("酒店", "jiǔdiàn")],
                extra_tiles=[_t("哪里", "nǎlǐ")],
                hint="I + want + go + the place.",
                solution=_p("我要去酒店。", "Wǒ yào qù jiǔdiàn.", "I want to go to the hotel."),
            ),
        ],
    ),
    Lesson(
        id="here-there",
        title="Here, there and thank you",
        summary="Understand the answer and say thanks.",
        pattern=_p("在 + [location]。", "Zài + [location].", "It's [location]."),
        examples=[
            _p("在这里。", "Zài zhèlǐ.", "It's here."),
            _p("在那里。", "Zài nàlǐ.", "It's over there."),
            _p("谢谢！", "Xièxie!", "Thank you!"),
            _p("不客气！", "Bú kèqi!", "You're welcome!"),
        ],
        words=[
            _p("这里", "zhèlǐ", "here"),
            _p("那里", "nàlǐ", "there"),
            _p("好", "hǎo", "OK, good"),
            _p("谢谢", "xièxie", "thank you"),
            _p("不客气", "bú kèqi", "you're welcome"),
        ],
        tip="哪里 (nǎlǐ, where?) and 那里 (nàlǐ, there) look alike. Listen for the tone: nǎ dips, nà falls.",
        exercises=[
            ChoiceExercise(
                prompt="Xiao Lin points and says this. What does it mean?",
                hanzi="在那里。",
                pinyin="Zài nàlǐ.",
                options=[_en("It's over there."), _en("It's here."), _en("Where is it?")],
                answer=0,
                hint="那里 (nàlǐ) is a place away from you.",
                solution=_p("在那里。", "Zài nàlǐ.", "It's over there."),
            ),
            ChoiceExercise(
                prompt="What does this word mean?",
                hanzi="这里",
                pinyin="zhèlǐ",
                options=[_en("Here"), _en("There"), _en("Where")],
                answer=0,
                hint="这 (zhè) means “this”, so 这里 is “this place”.",
                solution=_p("这里", "zhèlǐ", "Here"),
            ),
            ChoiceExercise(
                prompt="Someone just helped you find your bag. What do you say?",
                options=[_zh("谢谢！", "Xièxie!"), _zh("不客气！", "Bú kèqi!"), _zh("在这里。", "Zài zhèlǐ.")],
                answer=0,
                hint="You want to say “thank you”.",
                solution=_p("谢谢！", "Xièxie!", "Thank you!"),
            ),
            ChoiceExercise(
                prompt="You thank Xiao Lin, who answers with this. What does it mean?",
                hanzi="不客气！",
                pinyin="Bú kèqi!",
                options=[_en("You're welcome!"), _en("Thank you!"), _en("Okay.")],
                answer=0,
                hint="It's what people say back when you say 谢谢.",
                solution=_p("不客气！", "Bú kèqi!", "You're welcome!"),
            ),
            BuildExercise(
                prompt="Build this sentence: “It's over there.”",
                tiles=[_t("在", "zài"), _t("那里", "nàlǐ")],
                extra_tiles=[_t("哪里", "nǎlǐ"), _t("这里", "zhèlǐ")],
                hint="在 + the word for “there”. Careful: 哪里 asks “where?”.",
                solution=_p("在那里。", "Zài nàlǐ.", "It's over there."),
            ),
        ],
    ),
]


# ---------------------------------------------------------------------------
# Noodle shop
# ---------------------------------------------------------------------------

RESTAURANT_LESSONS = [
    Lesson(
        id="how-many",
        title="Saying how many people",
        summary="Answer the first question at the door.",
        pattern=_p("[number] + 位。", "[number] + wèi.", "[number] people."),
        examples=[
            _p("几位？", "Jǐ wèi?", "How many people?"),
            _p("一位。", "Yí wèi.", "One person."),
            _p("两位。", "Liǎng wèi.", "Two people."),
            _p("三位。", "Sān wèi.", "Three people."),
        ],
        words=[
            _p("几", "jǐ", "how many"),
            _p("位", "wèi", "(polite word for counting people)"),
            _p("一", "yī", "one"),
            _p("两", "liǎng", "two (when counting)"),
            _p("三", "sān", "three"),
        ],
        tip="Use 两 (liǎng), not 二 (èr), when you count things: 两位 is two people.",
        exercises=[
            ChoiceExercise(
                prompt="Auntie Wang greets you with this. What is she asking?",
                hanzi="几位？",
                pinyin="Jǐ wèi?",
                options=[_en("How many people?"), _en("What would you like?"), _en("Is it spicy?")],
                answer=0,
                hint="几 (jǐ) asks “how many”, and 位 (wèi) counts people.",
                solution=_p("几位？", "Jǐ wèi?", "How many people?"),
            ),
            ChoiceExercise(
                prompt="How do you say “Two people”?",
                options=[_zh("两位", "liǎng wèi"), _zh("三位", "sān wèi"), _zh("一位", "yí wèi")],
                answer=0,
                hint="Two, when you count, is 两 (liǎng).",
                solution=_p("两位。", "Liǎng wèi.", "Two people."),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “Three people.”",
                hanzi=f"{BLANK}位。",
                pinyin=f"{BLANK} wèi.",
                options=[_zh("三", "sān"), _zh("两", "liǎng"), _zh("几", "jǐ")],
                answer=0,
                hint="三 (sān) is three.",
                solution=_p("三位。", "Sān wèi.", "Three people."),
            ),
            ChoiceExercise(
                prompt="You're eating alone. What do you say?",
                options=[_zh("一位。", "Yí wèi."), _zh("两位。", "Liǎng wèi."), _zh("几位？", "Jǐ wèi?")],
                answer=0,
                hint="一 (yī) is one. Before 位 it's said yí.",
                solution=_p("一位。", "Yí wèi.", "One person."),
            ),
            BuildExercise(
                prompt="Build this sentence: “Hello! Two people.”",
                tiles=[_t("你好", "nǐ hǎo"), _t("两", "liǎng"), _t("位", "wèi")],
                extra_tiles=[_t("几", "jǐ")],
                hint="Say hello first, then the number, then 位.",
                solution=_p("你好！两位。", "Nǐ hǎo! Liǎng wèi.", "Hello! Two people."),
            ),
        ],
    ),
    Lesson(
        id="order",
        title="Ordering a dish",
        summary="Ask for a bowl of noodles or a plate of dumplings.",
        pattern=_p("我要 + [food]。", "Wǒ yào + [food].", "I'd like [food]."),
        examples=[
            _p("你要什么？", "Nǐ yào shénme?", "What would you like?"),
            _p("我要一碗牛肉面。", "Wǒ yào yì wǎn niúròu miàn.", "I'd like a bowl of beef noodles."),
            _p("我要一盘饺子。", "Wǒ yào yì pán jiǎozi.", "I'd like a plate of dumplings."),
        ],
        words=[
            _p("要", "yào", "want, would like"),
            _p("什么", "shénme", "what"),
            _p("一碗", "yì wǎn", "a bowl of"),
            _p("一盘", "yì pán", "a plate of"),
            _p("牛肉面", "niúròu miàn", "beef noodles"),
            _p("饺子", "jiǎozi", "dumplings"),
        ],
        tip="Noodles come in a bowl (碗 wǎn), and dumplings come on a plate (盘 pán).",
        exercises=[
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="牛肉面",
                pinyin="niúròu miàn",
                options=[_en("Beef noodles"), _en("Dumplings"), _en("Cola")],
                answer=0,
                hint="牛肉 (niúròu) is beef, and 面 (miàn) is noodles.",
                solution=_p("牛肉面", "niúròu miàn", "Beef noodles"),
            ),
            ChoiceExercise(
                prompt="Auntie Wang asks this. What is she asking?",
                hanzi="你要什么？",
                pinyin="Nǐ yào shénme?",
                options=[_en("What would you like?"), _en("How many people?"), _en("Where are you going?")],
                answer=0,
                hint="什么 (shénme) means “what”.",
                solution=_p("你要什么？", "Nǐ yào shénme?", "What would you like?"),
            ),
            ChoiceExercise(
                prompt="How do you say “I'd like a bowl of beef noodles”?",
                options=[
                    _zh("我要一碗牛肉面。", "Wǒ yào yì wǎn niúròu miàn."),
                    _zh("我要一盘饺子。", "Wǒ yào yì pán jiǎozi."),
                    _zh("你要什么？", "Nǐ yào shénme?"),
                ],
                answer=0,
                hint="Start with 我要 (wǒ yào), “I'd like”, and look for beef noodles: 牛肉面.",
                solution=_p("我要一碗牛肉面。", "Wǒ yào yì wǎn niúròu miàn.", "I'd like a bowl of beef noodles."),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “I'd like a plate of dumplings.”",
                hanzi=f"我要一{BLANK}饺子。",
                pinyin=f"Wǒ yào yì {BLANK} jiǎozi.",
                options=[_zh("盘", "pán"), _zh("碗", "wǎn"), _zh("位", "wèi")],
                answer=0,
                hint="Dumplings come on a plate.",
                solution=_p("我要一盘饺子。", "Wǒ yào yì pán jiǎozi.", "I'd like a plate of dumplings."),
            ),
            BuildExercise(
                prompt="Build this sentence: “I'd like a bowl of beef noodles.”",
                tiles=[_t("我", "wǒ"), _t("要", "yào"), _t("一碗", "yì wǎn"), _t("牛肉面", "niúròu miàn")],
                extra_tiles=[_t("一盘", "yì pán")],
                hint="I + would like + a bowl of + the dish.",
                solution=_p("我要一碗牛肉面。", "Wǒ yào yì wǎn niúròu miàn.", "I'd like a bowl of beef noodles."),
            ),
        ],
    ),
    Lesson(
        id="spice-and-bill",
        title="Drinks, spice and the bill",
        summary="Skip the chili, get a cola and pay.",
        pattern=_p("不要 + [thing]。", "Bú yào + [thing].", "No [thing], please."),
        examples=[
            _p("要辣吗？", "Yào là ma?", "Do you want it spicy?"),
            _p("不要辣。", "Bú yào là.", "Not spicy, please."),
            _p("我要一瓶可乐。", "Wǒ yào yì píng kělè.", "I'd like a bottle of cola."),
            _p("买单。", "Mǎidān.", "The bill, please."),
        ],
        words=[
            _p("辣", "là", "spicy"),
            _p("不要", "bú yào", "don't want, no thanks"),
            _p("一瓶", "yì píng", "a bottle of"),
            _p("可乐", "kělè", "cola"),
            _p("买单", "mǎidān", "the bill, please"),
            _p("多少钱", "duōshao qián", "how much (money)?"),
        ],
        tip="不 (bù) is said bú before a falling tone, like 要 (yào): bú yào.",
        exercises=[
            ChoiceExercise(
                prompt="Auntie Wang asks this, and you don't want it spicy. What do you say?",
                hanzi="要辣吗？",
                pinyin="Yào là ma?",
                options=[_zh("不要辣。", "Bú yào là."), _zh("要辣。", "Yào là."), _zh("买单。", "Mǎidān.")],
                answer=0,
                hint="不要 (bú yào) means “don't want”.",
                solution=_p("不要辣。", "Bú yào là.", "Not spicy, please."),
            ),
            ChoiceExercise(
                prompt="How do you ask for the bill?",
                options=[_zh("买单。", "Mǎidān."), _zh("不要辣。", "Bú yào là."), _zh("两位。", "Liǎng wèi.")],
                answer=0,
                hint="It sounds like “my dan”.",
                solution=_p("买单。", "Mǎidān.", "The bill, please."),
            ),
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="多少钱？",
                pinyin="Duōshao qián?",
                options=[_en("How much is it?"), _en("Where is it?"), _en("What would you like?")],
                answer=0,
                hint="多少 (duōshao) is “how much”, and 钱 (qián) is money.",
                solution=_p("多少钱？", "Duōshao qián?", "How much is it?"),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “I'd like a bottle of cola.”",
                hanzi=f"我要一瓶{BLANK}。",
                pinyin=f"Wǒ yào yì píng {BLANK}.",
                options=[_zh("可乐", "kělè"), _zh("饺子", "jiǎozi"), _zh("辣", "là")],
                answer=0,
                hint="Say it out loud: it sounds a lot like “cola”.",
                solution=_p("我要一瓶可乐。", "Wǒ yào yì píng kělè.", "I'd like a bottle of cola."),
            ),
            BuildExercise(
                prompt="Build this sentence: “Not spicy, please.”",
                tiles=[_t("不要", "bú yào"), _t("辣", "là")],
                extra_tiles=[_t("一瓶", "yì píng"), _t("买单", "mǎidān")],
                hint="“Don't want” + “spicy”.",
                solution=_p("不要辣。", "Bú yào là.", "Not spicy, please."),
            ),
        ],
    ),
]


# ---------------------------------------------------------------------------
# Train station
# ---------------------------------------------------------------------------

TRAIN_LESSONS = [
    Lesson(
        id="excuse-me",
        title="Excuse me, where is…?",
        summary="Ask politely where to go.",
        pattern=_p("请问，[place] 在哪里？", "Qǐngwèn, [place] zài nǎlǐ?", "Excuse me, where is [place]?"),
        examples=[
            _p("请问，洗手间在哪里？", "Qǐngwèn, xǐshǒujiān zài nǎlǐ?", "Excuse me, where's the restroom?"),
            _p("请问，在哪里上车？", "Qǐngwèn, zài nǎlǐ shàng chē?", "Excuse me, where do I board?"),
        ],
        words=[
            _p("请问", "qǐngwèn", "excuse me (may I ask)"),
            _p("在", "zài", "at, is at"),
            _p("哪里", "nǎlǐ", "where"),
            _p("洗手间", "xǐshǒujiān", "restroom"),
            _p("上车", "shàng chē", "get on (the train)"),
        ],
        tip="In northern China you'll also hear 哪儿 (nǎr). It means the same as 哪里.",
        exercises=[
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="请问",
                pinyin="qǐngwèn",
                options=[_en("Excuse me (may I ask)"), _en("Thank you"), _en("Goodbye")],
                answer=0,
                hint="You say it right before a question to be polite.",
                solution=_p("请问", "qǐngwèn", "Excuse me (may I ask)"),
            ),
            ChoiceExercise(
                prompt="How do you ask “Where's the restroom?”",
                options=[
                    _zh("洗手间在哪里？", "Xǐshǒujiān zài nǎlǐ?"),
                    _zh("在哪里上车？", "Zài nǎlǐ shàng chē?"),
                    _zh("请问，谢谢！", "Qǐngwèn, xièxie!"),
                ],
                answer=0,
                hint="洗手间 (xǐshǒujiān) is the restroom, and 在哪里 asks where.",
                solution=_p("洗手间在哪里？", "Xǐshǒujiān zài nǎlǐ?", "Where's the restroom?"),
            ),
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="上车",
                pinyin="shàng chē",
                options=[_en("Get on (the train)"), _en("Restroom"), _en("Leave")],
                answer=0,
                hint="上 (shàng) means up or on, and 车 (chē) is a vehicle.",
                solution=_p("上车", "shàng chē", "Get on (the train)"),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “Excuse me, where do I board?”",
                hanzi=f"请问，在{BLANK}上车？",
                pinyin=f"Qǐngwèn, zài {BLANK} shàng chē?",
                options=[_zh("哪里", "nǎlǐ"), _zh("几点", "jǐ diǎn"), _zh("洗手间", "xǐshǒujiān")],
                answer=0,
                hint="You need the question word for “where”.",
                solution=_p("请问，在哪里上车？", "Qǐngwèn, zài nǎlǐ shàng chē?", "Excuse me, where do I board?"),
            ),
            BuildExercise(
                prompt="Build this sentence: “Excuse me, where's the restroom?”",
                tiles=[_t("请问", "qǐngwèn"), _t("洗手间", "xǐshǒujiān"), _t("在", "zài"), _t("哪里", "nǎlǐ")],
                extra_tiles=[_t("上车", "shàng chē")],
                hint="Be polite first (请问), then the place, then 在哪里.",
                solution=_p("请问，洗手间在哪里？", "Qǐngwèn, xǐshǒujiān zài nǎlǐ?", "Excuse me, where's the restroom?"),
            ),
        ],
    ),
    Lesson(
        id="what-time",
        title="What time does it leave?",
        summary="Ask about your train and understand the time.",
        pattern=_p("[train] 几点出发？", "[train] jǐ diǎn chūfā?", "What time does [train] leave?"),
        examples=[
            _p("去杭州的火车几点出发？", "Qù Hángzhōu de huǒchē jǐ diǎn chūfā?", "What time does the train to Hangzhou leave?"),
            _p("下午三点半。", "Xiàwǔ sān diǎn bàn.", "3:30 in the afternoon."),
        ],
        words=[
            _p("去杭州的火车", "qù Hángzhōu de huǒchē", "the train to Hangzhou"),
            _p("几点", "jǐ diǎn", "what time"),
            _p("出发", "chūfā", "leave, set off"),
            _p("下午", "xiàwǔ", "afternoon, pm"),
            _p("三点半", "sān diǎn bàn", "half past three"),
        ],
        tip="Chinese puts the bigger thing first: 下午三点半 is “afternoon, three o'clock, half”.",
        exercises=[
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="几点",
                pinyin="jǐ diǎn",
                options=[_en("What time"), _en("How many people"), _en("Where")],
                answer=0,
                hint="几 (jǐ) asks “how many”, and 点 (diǎn) means o'clock.",
                solution=_p("几点", "jǐ diǎn", "What time"),
            ),
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="出发",
                pinyin="chūfā",
                options=[_en("Leave, set off"), _en("Arrive"), _en("Get on")],
                answer=0,
                hint="It's what a train does when it pulls out of the station.",
                solution=_p("出发", "chūfā", "Leave, set off"),
            ),
            ChoiceExercise(
                prompt="How do you ask “What time does the train to Hangzhou leave?”",
                options=[
                    _zh("去杭州的火车几点出发？", "Qù Hángzhōu de huǒchē jǐ diǎn chūfā?"),
                    _zh("去杭州的火车在哪里？", "Qù Hángzhōu de huǒchē zài nǎlǐ?"),
                    _zh("洗手间在哪里？", "Xǐshǒujiān zài nǎlǐ?"),
                ],
                answer=0,
                hint="You're asking about time, so look for 几点 (jǐ diǎn).",
                solution=_p(
                    "去杭州的火车几点出发？",
                    "Qù Hángzhōu de huǒchē jǐ diǎn chūfā?",
                    "What time does the train to Hangzhou leave?",
                ),
            ),
            ChoiceExercise(
                prompt="Li Ming tells you this. When does your train leave?",
                hanzi="下午三点半。",
                pinyin="Xiàwǔ sān diǎn bàn.",
                options=[_en("3:30 pm"), _en("3:00 pm"), _en("2:30 pm")],
                answer=0,
                hint="三 (sān) is three, 半 (bàn) is half, and 下午 (xiàwǔ) is afternoon.",
                solution=_p("下午三点半。", "Xiàwǔ sān diǎn bàn.", "3:30 in the afternoon."),
            ),
            BuildExercise(
                prompt="Build this sentence: “What time does the train leave?”",
                tiles=[_t("火车", "huǒchē"), _t("几点", "jǐ diǎn"), _t("出发", "chūfā")],
                extra_tiles=[_t("哪里", "nǎlǐ")],
                hint="The train + what time + leave.",
                solution=_p("火车几点出发？", "Huǒchē jǐ diǎn chūfā?", "What time does the train leave?"),
            ),
        ],
    ),
    Lesson(
        id="directions",
        title="Understanding the answer",
        summary="Floors, left and right, and saying goodbye.",
        pattern=_p("[place] 在 + [where]。", "[place] zài + [where].", "[place] is [where]."),
        examples=[
            _p("在二楼。", "Zài èr lóu.", "It's on the second floor."),
            _p("洗手间在左边。", "Xǐshǒujiān zài zuǒbian.", "The restroom is on the left."),
            _p("谢谢，再见！", "Xièxie, zàijiàn!", "Thank you, goodbye!"),
        ],
        words=[
            _p("二楼", "èr lóu", "second floor"),
            _p("左边", "zuǒbian", "on the left"),
            _p("检票口", "jiǎnpiàokǒu", "ticket gate"),
            _p("谢谢", "xièxie", "thank you"),
            _p("再见", "zàijiàn", "goodbye"),
        ],
        tip="Listen for the place word after 在. That's the part you need.",
        exercises=[
            ChoiceExercise(
                prompt="Li Ming tells you this. Where do you go?",
                hanzi="在二楼。",
                pinyin="Zài èr lóu.",
                options=[_en("The second floor"), _en("The left side"), _en("Outside")],
                answer=0,
                hint="二 (èr) is two, and 楼 (lóu) is a floor of a building.",
                solution=_p("在二楼。", "Zài èr lóu.", "It's on the second floor."),
            ),
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="左边",
                pinyin="zuǒbian",
                options=[_en("On the left"), _en("On the right"), _en("Upstairs")],
                answer=0,
                hint="左 (zuǒ) is left, and 边 (bian) is side.",
                solution=_p("左边", "zuǒbian", "On the left"),
            ),
            ChoiceExercise(
                prompt="Your ticket says B12检票口. What is a 检票口?",
                hanzi="检票口",
                pinyin="jiǎnpiàokǒu",
                options=[_en("Ticket gate"), _en("Restroom"), _en("Second floor")],
                answer=0,
                hint="检票 (jiǎnpiào) means checking tickets, and 口 (kǒu) is an opening.",
                solution=_p("检票口", "jiǎnpiàokǒu", "Ticket gate"),
            ),
            BuildExercise(
                prompt="Build this sentence: “The restroom is on the left.”",
                tiles=[_t("洗手间", "xǐshǒujiān"), _t("在", "zài"), _t("左边", "zuǒbian")],
                extra_tiles=[_t("二楼", "èr lóu")],
                hint="The place + 在 + where it is.",
                solution=_p("洗手间在左边。", "Xǐshǒujiān zài zuǒbian.", "The restroom is on the left."),
            ),
            ChoiceExercise(
                prompt="How do you say “Thank you, goodbye!”?",
                options=[
                    _zh("谢谢，再见！", "Xièxie, zàijiàn!"),
                    _zh("不客气！", "Bú kèqi!"),
                    _zh("请问，在哪里？", "Qǐngwèn, zài nǎlǐ?"),
                ],
                answer=0,
                hint="谢谢 (xièxie) is thank you, and 再见 (zàijiàn) is goodbye.",
                solution=_p("谢谢，再见！", "Xièxie, zàijiàn!", "Thank you, goodbye!"),
            ),
        ],
    ),
]


# ---------------------------------------------------------------------------
# Hotel
# ---------------------------------------------------------------------------

HOTEL_LESSONS = [
    Lesson(
        id="check-in",
        title="Checking in",
        summary="Say you have a reservation and give your name.",
        pattern=_p("我叫 + [name]。", "Wǒ jiào + [name].", "My name is [name]."),
        examples=[
            _p("我有预订。", "Wǒ yǒu yùdìng.", "I have a reservation."),
            _p("你叫什么名字？", "Nǐ jiào shénme míngzi?", "What's your name?"),
            _p("我叫 Anna。", "Wǒ jiào Anna.", "My name is Anna."),
        ],
        words=[
            _p("有", "yǒu", "have"),
            _p("预订", "yùdìng", "reservation"),
            _p("叫", "jiào", "to be called"),
            _p("什么", "shénme", "what"),
            _p("名字", "míngzi", "name"),
        ],
        tip="Your own name doesn't change: just say it after 我叫.",
        exercises=[
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="预订",
                pinyin="yùdìng",
                options=[_en("Reservation"), _en("Passport"), _en("Breakfast")],
                answer=0,
                hint="You make one before you arrive. 预 (yù) means “in advance”.",
                solution=_p("预订", "yùdìng", "Reservation"),
            ),
            ChoiceExercise(
                prompt="How do you say “I have a reservation”?",
                options=[_zh("我有预订。", "Wǒ yǒu yùdìng."), _zh("我叫预订。", "Wǒ jiào yùdìng."), _zh("我要早餐。", "Wǒ yào zǎocān.")],
                answer=0,
                hint="有 (yǒu) means “have”.",
                solution=_p("我有预订。", "Wǒ yǒu yùdìng.", "I have a reservation."),
            ),
            ChoiceExercise(
                prompt="Manager Chen asks this. What is the question?",
                hanzi="你叫什么名字？",
                pinyin="Nǐ jiào shénme míngzi?",
                options=[_en("What's your name?"), _en("Do you have a reservation?"), _en("What time is it?")],
                answer=0,
                hint="名字 (míngzi) means “name”.",
                solution=_p("你叫什么名字？", "Nǐ jiào shénme míngzi?", "What's your name?"),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “My name is Anna.”",
                hanzi=f"我{BLANK} Anna。",
                pinyin=f"Wǒ {BLANK} Anna.",
                options=[_zh("叫", "jiào"), _zh("有", "yǒu"), _zh("要", "yào")],
                answer=0,
                hint="You need “to be called”.",
                solution=_p("我叫 Anna。", "Wǒ jiào Anna.", "My name is Anna."),
            ),
            BuildExercise(
                prompt="Build this sentence: “Hello, I have a reservation.”",
                tiles=[_t("你好", "nǐ hǎo"), _t("我", "wǒ"), _t("有", "yǒu"), _t("预订", "yùdìng")],
                extra_tiles=[_t("叫", "jiào")],
                hint="Hello + I + have + reservation.",
                solution=_p("你好，我有预订。", "Nǐ hǎo, wǒ yǒu yùdìng.", "Hello, I have a reservation."),
            ),
        ],
    ),
    Lesson(
        id="passport-room",
        title="Your passport and room",
        summary="Hand over your passport and get your room.",
        pattern=_p("这是我的 + [thing]。", "Zhè shì wǒ de + [thing].", "This is my [thing]."),
        examples=[
            _p("这是我的护照。", "Zhè shì wǒ de hùzhào.", "Here is my passport."),
            _p("这是你的房卡。", "Zhè shì nǐ de fángkǎ.", "Here is your room card."),
            _p("你的房间是八零八。", "Nǐ de fángjiān shì bā líng bā.", "Your room is 808."),
        ],
        words=[
            _p("这是", "zhè shì", "this is, here is"),
            _p("我的", "wǒ de", "my"),
            _p("你的", "nǐ de", "your"),
            _p("护照", "hùzhào", "passport"),
            _p("房卡", "fángkǎ", "room card"),
            _p("房间", "fángjiān", "room"),
        ],
        tip="Room numbers are read digit by digit: 808 is 八零八 (bā líng bā).",
        exercises=[
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="护照",
                pinyin="hùzhào",
                options=[_en("Passport"), _en("Room card"), _en("Password")],
                answer=0,
                hint="You show it at the border.",
                solution=_p("护照", "hùzhào", "Passport"),
            ),
            ChoiceExercise(
                prompt="How do you say “Here is my passport”?",
                options=[
                    _zh("这是我的护照。", "Zhè shì wǒ de hùzhào."),
                    _zh("这是你的护照。", "Zhè shì nǐ de hùzhào."),
                    _zh("这是我的房卡。", "Zhè shì wǒ de fángkǎ."),
                ],
                answer=0,
                hint="我的 (wǒ de) is “my”, and 护照 (hùzhào) is passport.",
                solution=_p("这是我的护照。", "Zhè shì wǒ de hùzhào.", "Here is my passport."),
            ),
            ChoiceExercise(
                prompt="Manager Chen tells you this. What did you learn?",
                hanzi="你的房间是八零八。",
                pinyin="Nǐ de fángjiān shì bā líng bā.",
                options=[_en("Your room is 808."), _en("Your passport, please."), _en("Breakfast is at 8.")],
                answer=0,
                hint="房间 (fángjiān) is room, and 八 (bā) is eight.",
                solution=_p("你的房间是八零八。", "Nǐ de fángjiān shì bā líng bā.", "Your room is 808."),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “This is your room card.”",
                hanzi=f"这是你的{BLANK}。",
                pinyin=f"Zhè shì nǐ de {BLANK}.",
                options=[_zh("房卡", "fángkǎ"), _zh("护照", "hùzhào"), _zh("预订", "yùdìng")],
                answer=0,
                hint="房 (fáng) is a room, and 卡 (kǎ) is a card.",
                solution=_p("这是你的房卡。", "Zhè shì nǐ de fángkǎ.", "This is your room card."),
            ),
            BuildExercise(
                prompt="Build this sentence: “Here is my passport.”",
                tiles=[_t("这", "zhè"), _t("是", "shì"), _t("我的", "wǒ de"), _t("护照", "hùzhào")],
                extra_tiles=[_t("你的", "nǐ de")],
                hint="This + is + my + passport.",
                solution=_p("这是我的护照。", "Zhè shì wǒ de hùzhào.", "Here is my passport."),
            ),
        ],
    ),
    Lesson(
        id="breakfast-wifi",
        title="Breakfast and wifi",
        summary="Ask what time breakfast is and get the password.",
        pattern=_p("[thing] 几点？", "[thing] jǐ diǎn?", "What time is [thing]?"),
        examples=[
            _p("早餐几点？", "Zǎocān jǐ diǎn?", "What time is breakfast?"),
            _p("七点到十点。", "Qī diǎn dào shí diǎn.", "From 7 to 10."),
            _p("WiFi 密码是多少？", "WiFi mìmǎ shì duōshao?", "What's the wifi password?"),
        ],
        words=[
            _p("早餐", "zǎocān", "breakfast"),
            _p("几点", "jǐ diǎn", "what time"),
            _p("到", "dào", "to, until"),
            _p("密码", "mìmǎ", "password"),
            _p("多少", "duōshao", "how much, what number"),
        ],
        tip="To ask for a number, like a password or a price, use 是多少？ (shì duōshao?).",
        exercises=[
            ChoiceExercise(
                prompt="What does this mean?",
                hanzi="早餐",
                pinyin="zǎocān",
                options=[_en("Breakfast"), _en("Room"), _en("Wifi")],
                answer=0,
                hint="早 (zǎo) means early or morning, and 餐 (cān) is a meal.",
                solution=_p("早餐", "zǎocān", "Breakfast"),
            ),
            ChoiceExercise(
                prompt="How do you ask “What time is breakfast?”",
                options=[
                    _zh("早餐几点？", "Zǎocān jǐ diǎn?"),
                    _zh("早餐在哪里？", "Zǎocān zài nǎlǐ?"),
                    _zh("WiFi 密码是多少？", "WiFi mìmǎ shì duōshao?"),
                ],
                answer=0,
                hint="几点 (jǐ diǎn) asks “what time”.",
                solution=_p("早餐几点？", "Zǎocān jǐ diǎn?", "What time is breakfast?"),
            ),
            ChoiceExercise(
                prompt="Manager Chen answers with this. When is breakfast?",
                hanzi="七点到十点。",
                pinyin="Qī diǎn dào shí diǎn.",
                options=[_en("7:00 to 10:00"), _en("7:00 to 8:00"), _en("10:00 to 11:00")],
                answer=0,
                hint="七 (qī) is seven, and 十 (shí) is ten.",
                solution=_p("七点到十点。", "Qī diǎn dào shí diǎn.", "From 7 to 10."),
            ),
            ChoiceExercise(
                prompt="Fill in the blank: “What's the wifi password?”",
                hanzi=f"WiFi 密码是{BLANK}？",
                pinyin=f"WiFi mìmǎ shì {BLANK}?",
                options=[_zh("多少", "duōshao"), _zh("几点", "jǐ diǎn"), _zh("哪里", "nǎlǐ")],
                answer=0,
                hint="A password is a number, so ask “what number”.",
                solution=_p("WiFi 密码是多少？", "WiFi mìmǎ shì duōshao?", "What's the wifi password?"),
            ),
            BuildExercise(
                prompt="Build this sentence: “What's the wifi password?”",
                tiles=[_t("WiFi", "WiFi"), _t("密码", "mìmǎ"), _t("是", "shì"), _t("多少", "duōshao")],
                extra_tiles=[_t("几点", "jǐ diǎn")],
                hint="Wifi + password + is + what number.",
                solution=_p("WiFi 密码是多少？", "WiFi mìmǎ shì duōshao?", "What's the wifi password?"),
            ),
        ],
    ),
]
