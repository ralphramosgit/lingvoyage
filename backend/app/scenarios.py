"""Encounter content. The single source of truth for scenarios, goals and key phrases."""

from pydantic import BaseModel


class Character(BaseModel):
    name_hanzi: str
    name_pinyin: str
    name_english: str
    role: str
    avatar_char: str


class Goal(BaseModel):
    id: str
    label: str


class KeyPhrase(BaseModel):
    hanzi: str
    pinyin: str
    english: str


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


class ScenarioDefinition(Scenario):
    """Server-only fields: used for the AI prompt and voice choice, never sent to the app."""

    scene_details: str
    voice_env: str

    def public(self) -> Scenario:
        return Scenario.model_validate(self.model_dump(exclude={"scene_details", "voice_env"}))

    @property
    def goal_ids(self) -> list[str]:
        return [goal.id for goal in self.goals]


SCENARIOS: list[ScenarioDefinition] = [
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
            "Customers can pay by phone (WeChat Pay or Alipay) or with cash."
        ),
        voice_env="ELEVENLABS_VOICE_ID_RESTAURANT",
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
            KeyPhrase(hanzi="在哪儿上车？", pinyin="Zài nǎr shàng chē?", english="Where do I board?"),
            KeyPhrase(hanzi="洗手间在哪儿？", pinyin="Xǐshǒujiān zài nǎr?", english="Where's the restroom?"),
            KeyPhrase(hanzi="谢谢，再见！", pinyin="Xièxie, zàijiàn!", english="Thank you, goodbye!"),
        ],
        scene_details=(
            "The learner has a ticket for the next high-speed train to Hangzhou, "
            "leaving at 3:30 pm (下午三点半) from gate B12 (B12检票口) on the second floor (二楼). "
            "The restrooms are to the left (左边)."
        ),
        voice_env="ELEVENLABS_VOICE_ID_TRAIN",
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
            "Their room is 808 on the 8th floor (八楼). "
            "Breakfast is served from 7:00 to 10:00 on the 2nd floor (二楼). "
            "The wifi password is chengdu2026."
        ),
        voice_env="ELEVENLABS_VOICE_ID_HOTEL",
    ),
]

_BY_ID = {scenario.id: scenario for scenario in SCENARIOS}


def get_scenario(scenario_id: str) -> ScenarioDefinition | None:
    return _BY_ID.get(scenario_id)
