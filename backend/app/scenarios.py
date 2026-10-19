"""Encounter content. The single source of truth for scenarios, goals, key phrases and lessons."""

from pydantic import BaseModel

from app.lessons import AIRPORT_LESSONS, HOTEL_LESSONS, RESTAURANT_LESSONS, TRAIN_LESSONS, Lesson


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
    lessons: list[Lesson]  # optional practice before the encounter


class ScenarioDefinition(Scenario):
    """Server-only fields: used for the AI prompt and voice choice, never sent to the app."""

    scene_details: str
    # How the scene should go, beat by beat, using the language the lessons teach.
    scene_outline: list[str]
    voice_env: str | None = None  # None: the default voice

    def public(self) -> Scenario:
        return Scenario.model_validate(self.model_dump(exclude={"scene_details", "scene_outline", "voice_env"}))

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
            KeyPhrase(hanzi="在那里。", pinyin="Zài nàlǐ.", english="It's over there."),
            KeyPhrase(hanzi="谢谢！", pinyin="Xièxie!", english="Thank you!"),
        ],
        scene_details=(
            "The learner has just landed and is standing near baggage claim. "
            "Their luggage (行李) is on the belt over there (在那里). "
            "The airport bus (巴士) to the city leaves from outside, over there (在那里); "
            "the DiDi (滴滴) pickup point is right here (在这里) by door 2. "
            "The learner is going to their hotel (酒店) in the city."
        ),
        scene_outline=[
            "Greet the learner: 你好！",
            "When they ask where their luggage is (行李在哪里？), answer: 在那里。",
            "When they thank you, say 不客气！ and ask where they're going: 你要去哪里？",
            "When they say where they want to go (我要去酒店。), answer: 好。",
            "When they ask where the bus or DiDi is (巴士在哪里？ / 滴滴在哪里？), answer: 在那里。 or 在这里。",
            "When they thank you again, say goodbye: 不客气！再见！",
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
        scene_outline=[
            "Greet the learner and ask how many people: 你好！几位？",
            "When they say how many (两位。), seat them and ask what they'd like: 请坐。你要什么？",
            "When they order (我要一碗牛肉面。), ask about spice or a drink: 要辣吗？ or 喝什么？",
            "When they answer (不要辣。 / 我要一瓶可乐。), say 好。 and bring the food.",
            "When they ask for the bill (买单。 / 多少钱？), say the total in 块, e.g. 三十块。",
            "Thank them and say goodbye: 谢谢！再见！",
        ],
        lessons=RESTAURANT_LESSONS,
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
            KeyPhrase(hanzi="在哪里上车？", pinyin="Zài nǎlǐ shàng chē?", english="Where do I board?"),
            KeyPhrase(hanzi="洗手间在哪里？", pinyin="Xǐshǒujiān zài nǎlǐ?", english="Where's the restroom?"),
            KeyPhrase(hanzi="谢谢，再见！", pinyin="Xièxie, zàijiàn!", english="Thank you, goodbye!"),
        ],
        scene_details=(
            "The learner has a ticket for the next high-speed train to Hangzhou, "
            "leaving at 3:30 pm (下午三点半) from gate B12 (B12检票口) on the second floor (二楼). "
            "The restrooms are to the left (左边). Say 哪里 for “where”, not 哪儿."
        ),
        scene_outline=[
            "Greet the learner: 你好！",
            "When they ask about the train to Hangzhou (去杭州的火车几点出发？), answer: 下午三点半出发。",
            "When they ask where to board (在哪里上车？), answer: 在二楼，B12检票口。",
            "If they ask where the restroom is (洗手间在哪里？), answer: 在左边。",
            "When they say thank you and goodbye (谢谢，再见！), answer: 不客气！再见！",
        ],
        lessons=TRAIN_LESSONS,
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
            "Their room is 808 (八零八) on the 8th floor (八楼). "
            "Breakfast is served from 7:00 to 10:00 on the 2nd floor (二楼). "
            "The wifi password is chengdu2026."
        ),
        scene_outline=[
            "Greet the learner and ask if they have a reservation: 你好！你有预订吗？",
            "When they say they do (我有预订。), ask their name: 你叫什么名字？",
            "When they give their name (我叫……), ask for their passport: 护照，谢谢。",
            "When they hand it over (这是我的护照。), give them the key: 这是你的房卡。你的房间是八零八。",
            "When they ask about breakfast (早餐几点？), answer: 七点到十点，在二楼。",
            "When they ask for the wifi password (WiFi 密码是多少？), answer: 密码是 chengdu2026。",
            "When they thank you, say goodbye: 不客气！再见！",
        ],
        lessons=HOTEL_LESSONS,
        voice_env="ELEVENLABS_VOICE_ID_HOTEL",
    ),
]

_BY_ID = {scenario.id: scenario for scenario in SCENARIOS}


def get_scenario(scenario_id: str) -> ScenarioDefinition | None:
    return _BY_ID.get(scenario_id)
