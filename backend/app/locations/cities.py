"""The cities the app supports. Packs and profiles point at a city by its slug, so slugs never change."""

from pydantic import BaseModel


class City(BaseModel):
    slug: str
    name: str
    hanzi: str
    pinyin: str
    province: str  # "" for the municipalities (Beijing, Shanghai, Chongqing)
    lat: float  # city center, for "Use my location" in the app
    lng: float


def _city(slug: str, name: str, hanzi: str, pinyin: str, province: str, lat: float, lng: float) -> City:
    return City(slug=slug, name=name, hanzi=hanzi, pinyin=pinyin, province=province, lat=lat, lng=lng)


# Most visited first: the app's picker shows them in this order.
CITIES: list[City] = [
    _city("beijing", "Beijing", "北京", "Běijīng", "", 39.9042, 116.4074),
    _city("shanghai", "Shanghai", "上海", "Shànghǎi", "", 31.2304, 121.4737),
    _city("chengdu", "Chengdu", "成都", "Chéngdū", "Sichuan", 30.5728, 104.0668),
    _city("xian", "Xi'an", "西安", "Xī'ān", "Shaanxi", 34.3416, 108.9398),
    _city("guangzhou", "Guangzhou", "广州", "Guǎngzhōu", "Guangdong", 23.1291, 113.2644),
    _city("shenzhen", "Shenzhen", "深圳", "Shēnzhèn", "Guangdong", 22.5431, 114.0579),
    _city("hangzhou", "Hangzhou", "杭州", "Hángzhōu", "Zhejiang", 30.2741, 120.1551),
    _city("chongqing", "Chongqing", "重庆", "Chóngqìng", "", 29.5630, 106.5516),
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
