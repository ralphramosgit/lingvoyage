/**
 * Which side of a map pin its name goes on. Chengdu and Chongqing sit close, so their names point away
 * from each other; Shanghai's goes out over the sea.
 */
export type LabelSide = 'below' | 'left' | 'right';

type CityLook = {
  /** What it's known for, in the city's sheet on the map. */
  note: string;
  label: LabelSide;
};

const LOOKS: Record<string, CityLook> = {
  beijing: { note: 'The Forbidden City, hutong alleys and Peking duck.', label: 'below' },
  chengdu: { note: 'Giant pandas, teahouses and fiery Sichuan food.', label: 'left' },
  chongqing: { note: 'Hotpot, a city built on hills, and Hongyadong lit up at night.', label: 'right' },
  shanghai: { note: 'The Bund, the skyline and soup dumplings.', label: 'right' },
  xian: { note: 'The Terracotta Army and the old city wall.', label: 'below' },
  guangzhou: { note: 'Dim sum, the Canton Tower and the Pearl River.', label: 'below' },
  shenzhen: { note: 'Skyscrapers, tech and the sea, next to Hong Kong.', label: 'below' },
  hangzhou: { note: 'West Lake, pagodas and Longjing tea.', label: 'below' },
  guilin: { note: 'Karst peaks along the Li River.', label: 'below' },
  suzhou: { note: 'Classical gardens and canals.', label: 'below' },
  nanjing: { note: 'Ming city walls and plum blossom.', label: 'below' },
  kunming: { note: 'The City of Eternal Spring, in flower all year.', label: 'below' },
};

export function cityLook(slug: string): CityLook {
  return LOOKS[slug] ?? { note: '', label: 'below' };
}
