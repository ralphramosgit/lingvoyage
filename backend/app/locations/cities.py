"""The cities the app supports. Packs and profiles point at a city by its slug, so slugs never change."""

from pydantic import BaseModel, Field


class MustSee(BaseModel):
    """A place the research has to cover, and where the city's sightseeing scene is set."""

    name: str
    hanzi: str
    why: str  # what it's famous for, as the research brief says it


class City(BaseModel):
    slug: str
    name: str
    hanzi: str
    pinyin: str
    province: str  # "" for the municipalities (Beijing, Shanghai, Chongqing)
    lat: float  # city center, for the map and "Use my location" in the app
    lng: float
    # Learners can pick it. Each new pack costs about $4 of research, so the others are "coming soon" (issue #66).
    available: bool
    must_see: MustSee | None = Field(default=None, exclude=True)  # for the research, not the app


def _city(
    slug: str,
    name: str,
    hanzi: str,
    pinyin: str,
    province: str,
    lat: float,
    lng: float,
    available: bool = False,
    must_see: MustSee | None = None,
) -> City:
    return City(
        slug=slug,
        name=name,
        hanzi=hanzi,
        pinyin=pinyin,
        province=province,
        lat=lat,
        lng=lng,
        available=available,
        must_see=must_see,
    )


HONGYADONG = MustSee(
    name="Hongyadong",
    hanzi="洪崖洞",
    why="the stilt houses stacked up the cliff over the Jialing River, famous for lighting up at night",
)

# Most visited first.
CITIES: list[City] = [
    _city("beijing", "Beijing", "北京", "Běijīng", "", 39.9042, 116.4074, available=True),
    _city("shanghai", "Shanghai", "上海", "Shànghǎi", "", 31.2304, 121.4737, available=True),
    _city("chengdu", "Chengdu", "成都", "Chéngdū", "Sichuan", 30.5728, 104.0668, available=True),
    _city("xian", "Xi'an", "西安", "Xī'ān", "Shaanxi", 34.3416, 108.9398),
    _city("guangzhou", "Guangzhou", "广州", "Guǎngzhōu", "Guangdong", 23.1291, 113.2644),
    _city("shenzhen", "Shenzhen", "深圳", "Shēnzhèn", "Guangdong", 22.5431, 114.0579),
    _city("hangzhou", "Hangzhou", "杭州", "Hángzhōu", "Zhejiang", 30.2741, 120.1551),
    _city("chongqing", "Chongqing", "重庆", "Chóngqìng", "", 29.5630, 106.5516, available=True, must_see=HONGYADONG),
    _city("guilin", "Guilin", "桂林", "Guìlín", "Guangxi", 25.2736, 110.2900),
    _city("suzhou", "Suzhou", "苏州", "Sūzhōu", "Jiangsu", 31.2990, 120.5853),
    _city("nanjing", "Nanjing", "南京", "Nánjīng", "Jiangsu", 32.0603, 118.7969),
    _city("kunming", "Kunming", "昆明", "Kūnmíng", "Yunnan", 24.8801, 102.8329),
]

_BY_SLUG = {city.slug: city for city in CITIES}
if len(_BY_SLUG) != len(CITIES):
    raise ValueError("Two cities in CITIES share a slug")


def find_city(slug: str) -> City | None:
    return _BY_SLUG.get(slug)


def available_names() -> str:
    """The cities learners can pick, for messages: "Beijing, Chengdu or Chongqing"."""
    names = [city.name for city in CITIES if city.available]
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} or {names[-1]}"
