"""Encounter content. The single source of truth for scenarios, goals, key phrases and lessons."""

import re
import zlib
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.lessons import AIRPORT_LESSONS, HOTEL_LESSONS, RESTAURANT_LESSONS, TRAIN_LESSONS, Lesson

Gender = Literal["female", "male"]
Age = Literal["young", "older"]

# Name and role cues, for characters written before they had a gender and age (older city packs).
_FEMALE = re.compile(
    r"auntie|\baunt\b|granny|grandma|madam|\bms\b|\bmrs\b|\bmiss\b|lady|sister|waitress|hostess|"
    r"阿姨|大妈|奶奶|婆婆|姐|女士|小姐|妹",
    re.IGNORECASE,
)
_MALE = re.compile(r"uncle|grandpa|\bmr\b|brother|大爷|大叔|叔|爷爷|伯|先生|哥|师傅", re.IGNORECASE)
_OLDER = re.compile(r"auntie|\baunt\b|granny|grandma|grandpa|uncle|阿姨|大妈|奶奶|婆婆|大爷|大叔|爷爷|伯|老", re.IGNORECASE)
_OLDER_ROLE = re.compile(r"owner|boss|manager|老板|经理", re.IGNORECASE)


class Character(BaseModel):
    name_hanzi: str
    name_pinyin: str
    name_english: str
    role: str
    avatar_char: str
    # Pick the character's voice (config.voice_id_for) and how the app draws them, so the two always match.
    gender: Gender
    age: Age

    @model_validator(mode="before")
    @classmethod
    def _guess_gender_and_age(cls, data: Any) -> Any:
        """Fills in a missing gender or age from the name and role ("Auntie Wang" is an older woman)."""
        if not isinstance(data, dict) or ("gender" in data and "age" in data):
            return data
        name = f"{data.get('name_english', '')} {data.get('name_hanzi', '')}"
        role = str(data.get("role", ""))
        if _FEMALE.search(f"{name} {role}"):
            gender = "female"
        elif _MALE.search(name):
            gender = "male"
        else:
            gender = "female" if zlib.crc32(name.encode("utf-8")) % 2 == 0 else "male"
        age = "older" if _OLDER.search(name) or _OLDER_ROLE.search(role) else "young"
        return {"gender": gender, "age": age, **data}


class Goal(BaseModel):
    id: str
    label: str


class KeyPhrase(BaseModel):
    hanzi: str
    pinyin: str
    english: str


class Source(BaseModel):
    url: str
    title: str


class LocalRef(BaseModel):
    """Where a local encounter came from: its city pack, place and facts (app/content/encounters.py)."""

    pack_id: str
    place_key: str
    fact_ids: list[str]


class Scenario(BaseModel):
    """Public fields, as sent to the app."""

    id: str
    language: str
    title: str
    subtitle: str
    city: str
    setting: str
    icon: str
    difficulty: str
    minutes: int
    character: Character
    goals: list[Goal]
    key_phrases: list[KeyPhrase]
    lessons: list[Lesson]  # optional practice before the encounter
    # Local encounters only: the pages their real details came from, and the day they were checked.
    sources: list[Source] = Field(default_factory=list)
    checked_at: str | None = None


class ScenarioDefinition(Scenario):
    """Server-only fields: used for the AI prompt, never sent to the app."""

    scene_details: str
    # How the scene should go, beat by beat, using the language the lessons teach.
    scene_outline: list[str]
    local: LocalRef | None = None  # local encounters only

    def public(self) -> Scenario:
        return Scenario.model_validate(
            self.model_dump(exclude={"scene_details", "scene_outline", "local"})
        )

    @property
    def goal_ids(self) -> list[str]:
        return [goal.id for goal in self.goals]


SCENARIOS: list[ScenarioDefinition] = [
    ScenarioDefinition(
        id="airport",
        language="zh-CN",
        title="Arriving at the airport",
        subtitle="Find your bags and a ride to the hotel",
        city="Chengdu",
        setting="the arrivals hall of Chengdu Tianfu International Airport",
        icon="PlaneLanding",
        difficulty="Beginner",
        minutes=3,
        character=Character(
            name_hanzi="小林",
            name_pinyin="Xiǎo Lín",
            name_english="Xiao Lin",
            role="Airport staff",
            avatar_char="林",
            gender="female",
            age="young",
        ),
        goals=[
            Goal(id="find_luggage", label="Ask where your luggage is"),
            Goal(id="destination", label="Say where you want to go"),
            Goal(id="find_ride", label="Ask where the bus or DiDi is"),
            Goal(id="thanks", label="Say thank you"),
        ],
        key_phrases=[
            KeyPhrase(hanzi="行李在哪里？", pinyin="Xíngli zài nǎlǐ?", english="Where is my luggage?"),
            KeyPhrase(hanzi="我要去酒店。", pinyin="Wǒ yào qù jiǔdiàn.", english="I want to go to the hotel."),
            KeyPhrase(hanzi="巴士在哪里？", pinyin="Bāshì zài nǎlǐ?", english="Where is the bus?"),
            KeyPhrase(hanzi="熊猫酒店。", pinyin="Xióngmāo Jiǔdiàn.", english="The Panda Hotel."),
            KeyPhrase(hanzi="谢谢！", pinyin="Xièxie!", english="Thank you!"),
        ],
        scene_details=(
            "The learner has just landed and is in the arrivals hall near baggage claim. "
            "Their luggage (行李) is at baggage carousel 3 (三号转盘), over there (在那里). "
            "Their hotel is the Panda Hotel (熊猫酒店) in the city center (市中心); if they name another hotel, go along with it. "
            "The airport bus (巴士) to the city center leaves from outside door 5 (五号门外面) every 20 minutes. "
            "The DiDi (滴滴) pickup point is outside door 2 (二号门外面). "
            "The restroom (厕所) is next to door 2 (二号门旁边)."
        ),
        scene_outline=[
            "You open: 你好！欢迎来成都！你找什么？",
            "The traveler asks where their luggage is (or says 行李). You: 你的行李在三号转盘，在那里。 Then ask: 你要去哪里？",
            "The traveler says they want to go to their hotel. You: 好！哪个酒店？",
            "The traveler names the hotel. You: 熊猫酒店，好的！你坐巴士还是滴滴？",
            "The traveler asks where the bus or the DiDi is (or picks one). You: 巴士在五号门外面。 or "
            "滴滴在二号门外面。 Then ask: 还需要什么吗？",
            "If the traveler asks where the restroom is, you: 厕所在二号门旁边。",
            "The traveler says thank you. You: 不客气！再见！",
        ],
        lessons=AIRPORT_LESSONS,
    ),
    ScenarioDefinition(
        id="restaurant",
        language="zh-CN",
        title="Ordering at a noodle shop",
        subtitle="Order a meal like a local",
        city="Beijing",
        setting="a small family noodle shop in a hutong",
        icon="UtensilsCrossed",
        difficulty="Beginner",
        minutes=3,
        character=Character(
            name_hanzi="王阿姨",
            name_pinyin="Wáng Āyí",
            name_english="Auntie Wang",
            role="Noodle shop owner",
            avatar_char="王",
            gender="female",
            age="older",
        ),
        goals=[
            Goal(id="party_size", label="Say how many people"),
            Goal(id="order_dish", label="Order a dish"),
            Goal(id="special_request", label="Ask for no spice or order a drink"),
            Goal(id="pay", label="Ask for the bill"),
        ],
        key_phrases=[
            KeyPhrase(hanzi="你好", pinyin="nǐ hǎo", english="Hello"),
            KeyPhrase(hanzi="两位", pinyin="liǎng wèi", english="Two people"),
            KeyPhrase(
                hanzi="我要一碗牛肉面。",
                pinyin="Wǒ yào yì wǎn niúròu miàn.",
                english="I'd like a bowl of beef noodles.",
            ),
            KeyPhrase(hanzi="不要辣。", pinyin="Bú yào là.", english="Not spicy, please."),
            KeyPhrase(hanzi="买单。", pinyin="Mǎidān.", english="The bill, please."),
        ],
        scene_details=(
            "It is lunchtime and the shop is cozy and busy. "
            "Menu: 牛肉面 beef noodles 25 yuan, 炸酱面 zhajiang noodles 22 yuan, "
            "饺子 dumplings 20 yuan a plate, 可乐 cola 5 yuan, 茶 tea is free. "
            "Customers pay with WeChat (微信) on their phone or with cash (现金)."
        ),
        scene_outline=[
            "You open: 你好！几位？",
            "The traveler says how many people. You: 请坐！你要吃什么？我们有牛肉面和饺子。",
            "The traveler orders a dish. You: 好！要辣吗？",
            "The traveler answers about the spice. You: 好。喝什么？我们有可乐和茶。",
            "The traveler orders a drink, or says no. You bring the food: 来了！好吃吗？",
            "The traveler asks for the bill or the price. You add up only what they ordered at the menu prices "
            "and say it in 块 (one bowl of beef noodles is 二十五块, beef noodles and a cola is 三十块). "
            "Then ask how they'll pay: 微信还是现金？",
            "The traveler says how they'll pay. You: 好，谢谢！再见！",
        ],
        lessons=RESTAURANT_LESSONS,
    ),
    ScenarioDefinition(
        id="train",
        language="zh-CN",
        title="Asking for train directions",
        subtitle="Find your train at a busy station",
        city="Shanghai",
        setting="the information desk at Shanghai Hongqiao Railway Station",
        icon="TrainFront",
        difficulty="Beginner",
        minutes=3,
        character=Character(
            name_hanzi="李明",
            name_pinyin="Lǐ Míng",
            name_english="Li Ming",
            role="Information desk staff",
            avatar_char="李",
            gender="male",
            age="young",
        ),
        goals=[
            Goal(id="ask_politely", label="Ask politely for help"),
            Goal(id="departure_time", label="Ask when the train to Hangzhou leaves"),
            Goal(id="where_board", label="Ask where to board"),
            Goal(id="thank_bye", label="Say thank you and goodbye"),
        ],
        key_phrases=[
            KeyPhrase(hanzi="请问", pinyin="qǐngwèn", english="Excuse me (may I ask)"),
            KeyPhrase(
                hanzi="去杭州的火车几点出发？",
                pinyin="Qù Hángzhōu de huǒchē jǐ diǎn chūfā?",
                english="What time does the train to Hangzhou leave?",
            ),
            KeyPhrase(hanzi="在哪里上车？", pinyin="Zài nǎlǐ shàng chē?", english="Where do I board?"),
            KeyPhrase(hanzi="洗手间在哪里？", pinyin="Xǐshǒujiān zài nǎlǐ?", english="Where's the restroom?"),
            KeyPhrase(hanzi="谢谢，再见！", pinyin="Xièxie, zàijiàn!", english="Thank you, goodbye!"),
        ],
        scene_details=(
            "The learner has a ticket for the next high-speed train to Hangzhou, "
            "leaving at 3:30 pm (下午三点半) from gate B12 (B12检票口) on the second floor (二楼). "
            "The restrooms are on the second floor, to the left of gate B12 (B12左边). "
            "Say 哪里 for “where”, not 哪儿."
        ),
        scene_outline=[
            "You open: 你好！你要去哪里？",
            "The traveler says Hangzhou, or politely asks what time the train to Hangzhou leaves. "
            "You: 去杭州的火车下午三点半出发。 Then ask: 你有票吗？",
            "The traveler says they have a ticket. You: 好！你要找检票口吗？",
            "The traveler asks where to board. You: 在二楼，B12检票口。 Then ask: 还有问题吗？",
            "If the traveler asks where the restroom is, you: 洗手间在二楼，B12左边。",
            "The traveler says thank you and goodbye. You: 不客气！一路平安！",
        ],
        lessons=TRAIN_LESSONS,
    ),
    ScenarioDefinition(
        id="hotel",
        language="zh-CN",
        title="Checking in at a hotel",
        subtitle="Get your room key and the wifi",
        city="Chengdu",
        setting="the front desk of a mid-range hotel",
        icon="BedDouble",
        difficulty="Beginner",
        minutes=3,
        character=Character(
            name_hanzi="陈经理",
            name_pinyin="Chén jīnglǐ",
            name_english="Manager Chen",
            role="Front desk manager",
            avatar_char="陈",
            gender="male",
            age="older",
        ),
        goals=[
            Goal(id="reservation", label="Say you have a reservation"),
            Goal(id="name_passport", label="Give your name and passport"),
            Goal(id="breakfast", label="Ask what time breakfast is"),
            Goal(id="wifi", label="Ask for the wifi password"),
        ],
        key_phrases=[
            KeyPhrase(hanzi="我有预订。", pinyin="Wǒ yǒu yùdìng.", english="I have a reservation."),
            KeyPhrase(hanzi="我叫……", pinyin="Wǒ jiào...", english="My name is..."),
            KeyPhrase(hanzi="这是我的护照。", pinyin="Zhè shì wǒ de hùzhào.", english="Here is my passport."),
            KeyPhrase(hanzi="早餐几点？", pinyin="Zǎocān jǐ diǎn?", english="What time is breakfast?"),
            KeyPhrase(
                hanzi="WiFi 密码是多少？",
                pinyin="WiFi mìmǎ shì duōshao?",
                english="What's the wifi password?",
            ),
        ],
        scene_details=(
            "The learner has a reservation for 2 nights under their own name. "
            "Their room is 808 (八零八) on the 8th floor (八楼). "
            "Breakfast is served from 7:00 to 10:00 on the 2nd floor (二楼). "
            "The wifi password is chengdu2026."
        ),
        scene_outline=[
            "You open: 你好！欢迎！你有预订吗？",
            "The traveler says they have a reservation. You: 好。你叫什么名字？",
            "The traveler gives their name. You: 好。请给我你的护照，好吗？",
            "The traveler hands over their passport. You: 谢谢！这是你的房卡，房间是八零八，在八楼。 "
            "Then ask: 你要吃早餐吗？",
            "The traveler asks what time breakfast is (or says yes). You: 早餐七点到十点，在二楼。 Then ask: 你要用WiFi吗？",
            "The traveler asks for the wifi password (or says yes). You: 密码是 chengdu2026。 Then ask: 还需要什么吗？",
            "The traveler says thank you. You: 不客气！再见！",
        ],
        lessons=HOTEL_LESSONS,
    ),
]

_BY_ID = {scenario.id: scenario for scenario in SCENARIOS}


def get_scenario(scenario_id: str) -> ScenarioDefinition | None:
    return _BY_ID.get(scenario_id)
