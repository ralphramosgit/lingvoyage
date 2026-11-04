"""Encounter content. The single source of truth for scenarios, goals, key phrases and lessons."""

import re
import zlib
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.lessons import (
    AIRPORT_LESSONS,
    HOTEL_LESSONS,
    RESTAURANT_LESSONS,
    SHOPPING_LESSONS,
    TAXI_LESSONS,
    TRAIN_LESSONS,
    Lesson,
)

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
            "The traveler names the hotel. You: 熊猫酒店在市中心。你可以坐巴士，也可以坐滴滴。 Then ask: 你还想知道什么？",
            "The traveler asks where the bus or the DiDi is. You: 巴士在五号门外面。 or 滴滴在二号门外面。 "
            "Then ask: 还需要什么？",
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
            "The traveler says how many people. You: 请坐！我们有牛肉面和饺子。你要吃什么？",
            "The traveler orders a dish. You: 好！要辣的还是不辣的？",
            "The traveler answers about the spice. You: 好。我们有可乐和茶。你喝什么？",
            "The traveler orders a drink, or says no. You bring the food: 来了！还要什么？",
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
            "The traveler says they're going to Hangzhou. You: 去杭州，好！ Then ask: 你想知道什么？",
            "The traveler politely asks what time the train to Hangzhou leaves. You: 去杭州的火车下午三点半出发。 "
            "Then ask: 你还想知道什么？",
            "The traveler asks where to board. You: 在二楼，B12检票口。 Then ask: 还有什么问题？",
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
            "You open: 你好！欢迎！有什么可以帮你？",
            "The traveler says they have a reservation. You: 好。你叫什么名字？",
            "The traveler gives their name. You: 好。你的护照呢？",
            "The traveler hands over their passport. You: 谢谢！这是你的房卡，房间是八零八，在八楼。 "
            "Then ask: 还有什么问题？",
            "The traveler asks what time breakfast is. You: 早餐七点到十点，在二楼。 Then ask: 你还想知道什么？",
            "The traveler asks for the wifi password. You: 密码是 chengdu2026。 Then ask: 还需要什么？",
            "The traveler says thank you. You: 不客气！再见！",
        ],
        lessons=HOTEL_LESSONS,
    ),
    ScenarioDefinition(
        id="taxi",
        language="zh-CN",
        title="Taking a taxi",
        subtitle="Tell the driver where to go, then pay",
        city="Shanghai",
        setting="the taxi stand outside a hotel in Jing'an (静安)",
        icon="CarTaxiFront",
        difficulty="Beginner",
        minutes=3,
        character=Character(
            name_hanzi="张师傅",
            name_pinyin="Zhāng shīfu",
            name_english="Master Zhang",
            role="Taxi driver",
            avatar_char="张",
            gender="male",
            age="older",
        ),
        goals=[
            Goal(id="destination", label="Say where you want to go"),
            Goal(id="how_long", label="Ask how long it takes"),
            Goal(id="stop_here", label="Ask the driver to stop"),
            Goal(id="fare", label="Ask how much the fare is"),
        ],
        key_phrases=[
            KeyPhrase(hanzi="师傅，我要去外滩。", pinyin="Shīfu, wǒ yào qù Wàitān.", english="Driver, I'd like to go to the Bund."),
            KeyPhrase(hanzi="要多长时间？", pinyin="Yào duō cháng shíjiān?", english="How long does it take?"),
            KeyPhrase(hanzi="请在这里停。", pinyin="Qǐng zài zhèlǐ tíng.", english="Please stop here."),
            KeyPhrase(hanzi="多少钱？", pinyin="Duōshao qián?", english="How much is it?"),
            KeyPhrase(hanzi="可以用微信吗？", pinyin="Kěyǐ yòng Wēixìn ma?", english="Can I pay with WeChat?"),
        ],
        scene_details=(
            "The traveler has just got into the back seat of your taxi outside their hotel in Jing'an (静安). "
            "They want to go to the Bund (外滩), Shanghai's riverside walk; if they name another place, go along with it. "
            "The roads are busy (路上车很多), so the ride takes about 20 minutes (大概二十分钟). "
            "When you arrive, the meter (计价器) shows 30 yuan (三十块). "
            "Passengers pay by scanning the QR code (二维码) on the back of the front seat with WeChat (微信) or Alipay "
            "(支付宝), or with cash (现金). Passengers call you 师傅. Say 哪里 for “where”, not 哪儿."
        ),
        scene_outline=[
            "You open: 你好！去哪里？",
            "The traveler says where they want to go. You: 好的，去外滩！路上车很多。 Then invite their question: 还有什么问题？",
            "The traveler asks how long it takes. You: 大概二十分钟。 Then the ride goes by and you arrive: "
            "外滩到了！你要在哪里停？",
            "The traveler asks you to stop here or up ahead. You: 好，就在这里。 Then invite their question: 你还想知道什么？",
            "If the traveler asks where the QR code is, you: 二维码在前面的座位后面。",
            "The traveler asks how much it is. You: 三十块。 (what the meter shows) Then ask: 微信还是现金？",
            "The traveler says how they'll pay. You: 好，扫这个二维码。谢谢！ Then ask: 还需要什么？",
            "The traveler says thank you or goodbye. You: 不客气！再见！",
        ],
        lessons=TAXI_LESSONS,
    ),
    ScenarioDefinition(
        id="shopping",
        language="zh-CN",
        title="Shopping at a market",
        subtitle="Pick a color, ask the price and bargain",
        city="Beijing",
        setting="a T-shirt and silk scarf stall in the Silk Market (秀水街)",
        icon="Store",
        difficulty="Beginner",
        minutes=3,
        character=Character(
            name_hanzi="小周",
            name_pinyin="Xiǎo Zhōu",
            name_english="Xiao Zhou",
            role="Market stall seller",
            avatar_char="周",
            gender="female",
            age="young",
        ),
        goals=[
            Goal(id="pick_color", label="Pick a color"),
            Goal(id="ask_price", label="Ask how much it is"),
            Goal(id="bargain", label="Ask for a lower price"),
            Goal(id="pay", label="Say how you'll pay"),
        ],
        key_phrases=[
            KeyPhrase(hanzi="我要红色的。", pinyin="Wǒ yào hóngsè de.", english="I'd like the red one."),
            KeyPhrase(hanzi="这个多少钱？", pinyin="Zhège duōshao qián?", english="How much is this?"),
            KeyPhrase(hanzi="太贵了！", pinyin="Tài guì le!", english="That's too expensive!"),
            KeyPhrase(hanzi="便宜一点吧。", pinyin="Piányi yìdiǎn ba.", english="A little cheaper, please."),
            KeyPhrase(hanzi="我用微信。", pinyin="Wǒ yòng Wēixìn.", english="I'll pay with WeChat."),
        ],
        scene_details=(
            "The Silk Market is a building full of small stalls, and every price is made to be bargained. "
            "You sell panda T-shirts (熊猫T恤) in white (白色) and red (红色), and silk scarves (丝巾) in blue (蓝色) and red. "
            "Your first price: a T-shirt is 150 yuan (一百五十块), a scarf is 120 yuan (一百二十块). "
            "When the traveler asks for a lower price, come down once: 100 yuan (一百块) for a T-shirt, 80 yuan (八十块) "
            "for a scarf. If they push again, take their price if it's at least 80 for a T-shirt or 60 for a scarf, and "
            "meet them halfway if it's lower. You hand them your calculator (计算器) to type a price. "
            "You take WeChat (微信), Alipay (支付宝) and cash (现金); the QR code (二维码) is on your counter."
        ),
        scene_outline=[
            "You open: 你好！看看吧！我们有熊猫T恤和丝巾。你要看哪个？",
            "The traveler says which one they'd like to see. You name its two colors: 好！熊猫T恤有白色的和红色的。 "
            "(a scarf: 丝巾有蓝色的和红色的。) Then ask: 你要什么颜色？",
            "The traveler picks a color. You: 好，红色的，给你！ (with the color they picked) Then invite their "
            "question: 你还想知道什么？",
            "The traveler asks how much it is. You: 一百五十块。 (a scarf: 一百二十块。) Then hand them your calculator "
            "and ask: 你说多少？",
            "The traveler says it's too expensive, asks for a lower price or names one. You come down once: "
            "好吧，一百块。 (a scarf: 八十块。) If they ask again, follow the scene details. Then ask: 微信还是现金？",
            "The traveler says how they'll pay. You: 好，扫这里。谢谢！ Then ask: 还需要什么？",
            "The traveler says thank you, or that they need nothing else. You: 不客气！慢走！",
        ],
        lessons=SHOPPING_LESSONS,
    ),
]

_BY_ID = {scenario.id: scenario for scenario in SCENARIOS}


def get_scenario(scenario_id: str) -> ScenarioDefinition | None:
    return _BY_ID.get(scenario_id)
