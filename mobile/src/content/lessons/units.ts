import { ABOUT_YOU } from './aboutYou';
import { AIRPORT } from './airport';
import { DIRECTIONS } from './directions';
import { FIRST_SENTENCES } from './firstSentences';
import { FOOD } from './food';
import { GETTING_AROUND } from './gettingAround';
import { HELLO } from './hello';
import { HELP } from './help';
import { HOTEL } from './hotel';
import { LUCK } from './luck';
import { MANNERS } from './manners';
import { MONEY } from './money';
import { NUMBERS } from './numbers';
import { SHOPPING } from './shopping';
import { SOUNDS } from './sounds';
import { TABLE } from './table';
import { TIME } from './time';
import type { Part, Unit } from './types';
import { validateUnits } from './validate';

export const PARTS: Part[] = [
  { id: 'basics', title: 'Start here: the basics', summary: 'How Chinese works, and the words you need everywhere.' },
  { id: 'trip', title: 'On your trip', summary: "From the airport to the dinner table, in the order you'll need it." },
  { id: 'culture', title: 'Culture and etiquette', summary: 'The unwritten rules: manners, meals, luck and festivals.' },
];

/** The course, in its suggested order. A unit with no lessons shows as "coming soon". */
export const UNITS: Unit[] = [
  SOUNDS,
  HELLO,
  FIRST_SENTENCES,
  ABOUT_YOU,
  NUMBERS,
  MONEY,
  TIME,
  AIRPORT,
  HOTEL,
  FOOD,
  DIRECTIONS,
  GETTING_AROUND,
  SHOPPING,
  HELP,
  MANNERS,
  TABLE,
  LUCK,
];

if (__DEV__) validateUnits(UNITS);

export function findUnit(id: string | undefined): Unit | undefined {
  return UNITS.find((unit) => unit.id === id);
}
