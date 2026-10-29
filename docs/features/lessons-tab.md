# Lessons tab: feature requirements

The full plan for the Lessons tab: what it teaches, how its screens work, how progress is saved, and the order to build it in. It's tracked on GitHub as the epic [#19](https://github.com/ralphramosgit/lingvoyage/issues/19), with sub-issues #12 and #20 to #23 ([section 11](#11-build-order)).

> **Frontend only.** Like #12, everything here lives in `mobile/`: lesson content is typed TypeScript data, and audio uses the existing `SpeakerButton`. The only exception is the last phase (progress saved to the account), which needs Ralph.

---

## 1. What the Lessons tab is

**A short course in beginner Mandarin for travelers.** It starts with the basics of the language (tones, greetings, first sentences, numbers, money, time), then works through a trip in order: the airport, the hotel, food, directions, getting around, shopping and emergencies.

| Tab | What it's for |
|---|---|
| **Lessons** | **The course: guided units with quizzes, in a suggested order** |
| Encounters | Talking out loud with an AI character in a travel scene |
| Essentials | Reference to look things up: tables, cheat sheets, vocabulary. No quizzes |
| Practice lessons on an encounter screen (today) | A quick warm-up for one scene, right before talking |

**Who it's for:** an English speaker who has never studied Chinese and has a trip coming up. They study in short sessions on their phone: a few minutes on the bus, a lesson before bed.

**What they can do by the end:** get through the common moments of a trip in simple Mandarin, and handle the moments they can't (by asking someone to slow down, or saying they don't understand).

**Size:** 14 units, about 50 lessons of 3 to 5 minutes each. That's about 4 to 5 hours in total, which someone can realistically finish in the few weeks before a trip.

### What learners should be able to do

- **Start from zero.** "I've never heard Chinese before" opens a first lesson that explains how the language works.
- **Jump to what they need.** "I leave on Friday and I'm worried about ordering food" opens Ordering food straight away.
- **Pick up where they left off.** The tab shows the next lesson to do at the top.
- **Use it for real.** After a trip unit, they go straight into the matching encounter and use what they just learned.

---

## 2. How it's organized

```
Course
├── Part 1: Start here: the basics     (units 1–7)
│     └── Unit ── Lesson, Lesson, Lesson ... ── Checkpoint
└── Part 2: On your trip               (units 8–14)
      └── Unit ── Lesson, Lesson, Lesson ... ── Checkpoint ── Encounter
```

- **Unit:** one topic (Numbers, Ordering food). 3 to 5 lessons, then a checkpoint.
- **Lesson:** one sentence pattern and up to 8 words. Learn, then 5 to 8 questions, then a wrap-up. This is the lesson player that already exists.
- **Checkpoint:** a review at the end of a unit that mixes questions from all of its lessons.

### Design principles

1. **Basics first, but nothing is locked.** Part 1 is the suggested start, and the tab recommends it, but every unit and lesson can be opened at any time. A traveler with a trip on Friday shouldn't be forced through the tones first.
2. **One idea per lesson.** One pattern, a handful of words. If a lesson needs two patterns, it's two lessons.
3. **Things come back.** Trip units reuse the basics on purpose: `在哪里？` is taught in Your first sentences, then shows up again at the airport, the hotel and the metro. Each trip unit lists which basics it builds on.
4. **Every trip unit ends at an encounter**, where one exists. The lesson is practice; the encounter is the real thing.
5. **Encouraging, never punishing.** No lives, no failing a lesson. A wrong answer gets a hint and another try, like the current practice lessons.

---

## 3. The course

All Chinese below is the content plan, not final copy. Every item still gets a dictionary check (see [Content rules](#8-content-rules)) when its unit is written.

### Part 1: Start here: the basics

#### Unit 1. How Chinese works

You'll be able to: read pinyin, hear the four tones, and know which sounds aren't like English.

| # | Lesson | What it teaches | Key words and phrases |
|---|---|---|---|
| 1 | Chinese in two minutes | Characters, pinyin, tones. The good news: verbs never change, no plurals, word order like English | 中文 Zhōngwén, 汉字 Hànzì, 拼音 pīnyīn |
| 2 | The four tones | Four tones and the neutral tone: the same syllable makes different words | 妈 mā, 麻 má, 马 mǎ, 骂 mà, 吗 ma |
| 3 | Tones that change | Two 3rd tones in a row (written nǐ hǎo, said ní hǎo). 不 becomes bú before a 4th tone. 一 becomes yí or yì | 你好 nǐ hǎo, 不要 bú yào, 一个 yí gè, 一点 yìdiǎn |
| 4 | Sounds English doesn't have | zh ch sh r · j q x · z c s · ü | 中 zhōng, 茶 chá, 是 shì, 热 rè, 去 qù, 谢 xiè, 菜 cài, 女 nǚ |

This unit works with today's question types (play buttons next to each option), but it's much better with **listening questions** ([section 5](#5-lessons-and-question-types)). Write it with choice questions now and add listening ones when they exist.

#### Unit 2. Hello and thank you

You'll be able to: greet people, say thank you and sorry, and cope when you don't understand.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | Hello and goodbye | | 你好 nǐ hǎo, 您好 nín hǎo (polite), 早上好 zǎoshang hǎo, 再见 zàijiàn |
| 2 | Thank you and sorry | | 谢谢 xièxie, 不客气 bú kèqi, 对不起 duìbuqǐ, 没关系 méi guānxi, 不好意思 bù hǎoyìsi |
| 3 | When you don't understand | `请[do something]。` Please … | 我听不懂。Wǒ tīng bu dǒng. · 请再说一遍。Qǐng zài shuō yí biàn. · 请说慢一点。Qǐng shuō màn yìdiǎn. · 你会说英语吗？Nǐ huì shuō Yīngyǔ ma? |

#### Unit 3. Your first sentences

The grammar a traveler actually needs, one pattern per lesson.

You'll be able to: ask what something is, ask yes-or-no questions, say what you want, and ask whether they have something.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | What is this? | `[A]是[B]。` A is B. | 这 zhè, 那 nà, 是 shì, 什么 shénme · 这是什么？Zhè shì shénme? |
| 2 | Yes-or-no questions | `[sentence]吗？` | 吗 ma, 是 shì / 不是 bú shì, 对 duì, 好 hǎo |
| 3 | I want, I don't want | `我(不)要[thing]。` | 要 yào, 不要 bú yào, 这个 zhège, 水 shuǐ, 茶 chá |
| 4 | Do you have…? | `有[thing]吗？` | 有 yǒu, 没有 méiyǒu · 有英文菜单吗？Yǒu Yīngwén càidān ma? |

#### Unit 4. About you

You'll be able to: say your name, where you're from and why you're in China.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | Your name | `我叫[name]。` · 你叫什么名字？Nǐ jiào shénme míngzi? | 我 wǒ, 你 nǐ, 叫 jiào, 名字 míngzi |
| 2 | Where you're from | `我是[country]人。` · 你是哪国人？Nǐ shì nǎ guó rén? | 美国 Měiguó, 英国 Yīngguó, 加拿大 Jiānádà, 澳大利亚 Àodàlìyà, 中国 Zhōngguó |
| 3 | Why you're here | 我来中国旅游。Wǒ lái Zhōngguó lǚyóu. | 来 lái, 旅游 lǚyóu, 第一次 dì yī cì, 会 huì, 一点 yìdiǎn · 我会说一点中文。Wǒ huì shuō yìdiǎn Zhōngwén. |

#### Unit 5. Numbers

You'll be able to: count to 99, say how many, and give a room or phone number.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | Numbers 0–10 | `我要[number]个。` I'd like [number] of them. | 零 líng, 一 yī … 十 shí |
| 2 | Numbers 11–99 | Tens, then ones: 十一 shíyī, 二十 èrshí, 九十九 jiǔshíjiǔ | |
| 3 | How many? | `[number]个[thing]` · 两 liǎng, not 二 èr, for "two of something" | 两个 liǎng gè, 几个？jǐ gè? |
| 4 | Room, phone and flight numbers | Say the digits one by one, and 1 is 幺 yāo | 房间 fángjiān, 电话 diànhuà, 号 hào · 八幺六 bā yāo liù |

Uses the sample lesson from #12 as lesson 1.

#### Unit 6. Money

You'll be able to: ask prices, understand the answer, ask for a lower price and say how you'll pay.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | How much is it? | `[thing]多少钱？` | 钱 qián, 多少 duōshao, 块 kuài · 这个多少钱？Zhège duōshao qián? |
| 2 | Understanding prices | `[number]块。` Hundreds and thousands. 元 yuán on signs, 块 kuài out loud | 二十五块 èrshíwǔ kuài, 一百 yìbǎi, 两百 liǎngbǎi, 一千 yìqiān |
| 3 | Too expensive! | `太[adjective]了！` · 便宜一点，可以吗？Piányi yìdiǎn, kěyǐ ma? | 贵 guì, 便宜 piányi, 太贵了 tài guì le, 可以 kěyǐ |
| 4 | Paying | `可以用[way to pay]吗？` | 微信 Wēixìn, 支付宝 Zhīfùbǎo, 现金 xiànjīn, 刷卡 shuā kǎ, 扫码 sǎo mǎ |

Uses the sample lesson from #12 as lesson 1. Tip for lesson 4: most places in China expect you to pay by scanning a QR code with WeChat Pay or Alipay, so set one up before you go. Tipping isn't expected.

#### Unit 7. Time and dates

You'll be able to: ask and tell the time, and talk about days and dates for bookings.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | What time is it? | 现在几点？Xiànzài jǐ diǎn? · `[number]点(半)。` | 现在 xiànzài, 点 diǎn, 半 bàn, 两点 liǎng diǎn |
| 2 | Morning to night | `[part of day][number]点` | 早上 zǎoshang, 中午 zhōngwǔ, 下午 xiàwǔ, 晚上 wǎnshang · 早上八点 zǎoshang bā diǎn |
| 3 | Today and tomorrow | 今天星期几？Jīntiān xīngqī jǐ? | 今天 jīntiān, 明天 míngtiān, 昨天 zuótiān, 星期一 xīngqī yī … 星期天 xīngqītiān |
| 4 | Dates | `[month]月[day]号` · 几月几号？Jǐ yuè jǐ hào? | 月 yuè, 号 hào · 十月二十八号 shí yuè èrshíbā hào |

### Part 2: On your trip

#### Unit 8. Arriving at the airport

Encounter: `airport` · Builds on: Your first sentences, About you, Numbers

You'll be able to: get through passport control, find your bags and the exit, and get a ride to your hotel.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | Passport control | 我来旅游。· `我住[number]天。` I'm staying [number] days. | 护照 hùzhào, 住 zhù, 天 tiān, 酒店 jiǔdiàn |
| 2 | Finding things | `[place]在哪里？` | 行李 xíngli, 出口 chūkǒu, 洗手间 xǐshǒujiān, 在 zài, 哪里 nǎlǐ |
| 3 | Cash and a SIM card | `哪里可以[do something]？` Where can I …? | 换钱 huàn qián, 电话卡 diànhuàkǎ, 可以 kěyǐ |
| 4 | A ride to the hotel | `我要去[place]。` | 出租车 chūzūchē, 滴滴 Dīdī, 地铁 dìtiě, 巴士 bāshì |

#### Unit 9. Checking in at the hotel

Encounter: `hotel` · Builds on: About you, Numbers, Time and dates

You'll be able to: check in, find your room, ask about breakfast and wifi, report a problem and check out.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | I have a reservation | 我有预订。Wǒ yǒu yùdìng. · `我叫[name]。` | 预订 yùdìng, 入住 rùzhù |
| 2 | Passport and room | 这是我的护照。· `你的房间在[number]楼。` | 我的 wǒ de, 房间 fángjiān, 楼 lóu, 房卡 fángkǎ |
| 3 | Breakfast and wifi | 早餐几点？Zǎocān jǐ diǎn? · wifi密码是什么？ | 早餐 zǎocān, 密码 mìmǎ |
| 4 | Problems and checking out | `[thing]坏了。` · 几点退房？Jǐ diǎn tuì fáng? | 空调 kōngtiáo, 坏了 huài le, 热水 rè shuǐ, 退房 tuì fáng |

#### Unit 10. Ordering food

Encounter: `restaurant` · Builds on: Your first sentences, Numbers, Money

You'll be able to: get a table, order, ask for no spice, order drinks, and pay.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | A table for two | 几位？Jǐ wèi? · `[number]位。` | 位 wèi, 两位 liǎng wèi |
| 2 | Ordering a dish | `我要[number]碗[dish]。` | 菜单 càidān, 碗 wǎn, 牛肉面 niúròu miàn, 米饭 mǐfàn · 一碗 yì wǎn |
| 3 | Spice and what you don't eat | 不要辣。Bú yào là. · `我不吃[food]。` | 辣 là, 微辣 wēi là, 肉 ròu · 我对花生过敏。Wǒ duì huāshēng guòmǐn. |
| 4 | Drinks | `我要[drink]。` | 水 shuǐ, 茶 chá, 啤酒 píjiǔ, 冰的 bīng de, 热的 rè de |
| 5 | The bill and take-away | 买单！Mǎidān! · 可以打包吗？Kěyǐ dǎbāo ma? | 买单 mǎidān, 打包 dǎbāo |

#### Unit 11. Asking directions

Encounter: `train` · Builds on: Your first sentences, Numbers

You'll be able to: ask the way, understand left, right and straight on, and find floors, exits and platforms.

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | Excuse me, where is…? | `请问，[place]在哪里？` | 请问 qǐngwèn, 地铁站 dìtiě zhàn |
| 2 | Left, right, straight on | `往[left/right]拐` · 一直走 yìzhí zǒu | 左 zuǒ, 右 yòu, 拐 guǎi, 前面 qiánmiàn |
| 3 | Near or far? | 远吗？Yuǎn ma? · `走路[number]分钟。` | 远 yuǎn, 近 jìn, 走路 zǒu lù, 分钟 fēnzhōng |
| 4 | Floors, exits and platforms | `[number]楼` · `[letter]口` · `[number]号站台` | 楼 lóu, 出口 chūkǒu, 站台 zhàntái, 检票口 jiǎnpiàokǒu |

#### Unit 12. Getting around

Encounter: none yet ("Taking a taxi" is coming soon on Encounters; add `encounterId` when it ships) · Builds on: Numbers, Money, Asking directions

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | Taxi and DiDi | 师傅，去这里。Shīfu, qù zhèlǐ. (Show the address.) · 在这里停。 | 师傅 shīfu, 这里 zhèlǐ, 停 tíng, 到了 dào le |
| 2 | The metro | `坐[number]号线。` Take line [number]. | 坐 zuò, 号线 hào xiàn, 换乘 huànchéng |
| 3 | Train tickets | `我要一张去[city]的票。` | 张 zhāng, 票 piào, 高铁 gāotiě, 出发 chūfā |

#### Unit 13. Shopping

Encounter: none yet ("Shopping at a market" is coming soon) · Builds on: Your first sentences, Money

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | Do you have…? | `有[thing]吗？` · 有大一点的吗？Yǒu dà yìdiǎn de ma? | 大 dà, 小 xiǎo, 一点 yìdiǎn |
| 2 | Colors and sizes | `[color]的` | 颜色 yánsè, 红色 hóngsè, 黑色 hēisè, 白色 báisè |
| 3 | Just looking, or I'll take it | 我看看。Wǒ kànkan. · 我要这个。· 不要了，谢谢。 | 看看 kànkan · 可以试试吗？Kěyǐ shìshi ma? |

#### Unit 14. Help and emergencies

Encounter: none · Builds on: Your first sentences, Numbers

| # | Lesson | Pattern | Key words and phrases |
|---|---|---|---|
| 1 | I need help | 帮帮我！Bāngbang wǒ! · 我迷路了。Wǒ mílù le. | 帮 bāng, 迷路 mílù, 救命 jiùmìng |
| 2 | Feeling sick | 我不舒服。Wǒ bù shūfu. · `我[body part]疼。` | 头 tóu, 肚子 dùzi, 疼 téng, 药店 yàodiàn, 医院 yīyuàn |
| 3 | Lost things | `我的[thing]丢了。` | 手机 shǒujī, 护照 hùzhào, 丢了 diū le, 警察 jǐngchá |

Tip for lesson 3: in mainland China, 110 is the police and 120 is an ambulance.

---

## 4. Screens

### 4.1 The Lessons tab (course home)

```
Lessons
Step-by-step lessons for your trip.

┌─ CONTINUE ───────────────────────────┐
│ Numbers · Lesson 2 of 4              │
│ Numbers 11–99              [Start →] │
└──────────────────────────────────────┘

START HERE: THE BASICS
[icon] How Chinese works          4 of 4 ✓
[icon] Hello and thank you        1 of 3   ›
[icon] Your first sentences       Not started ›
...
ON YOUR TRIP
[icon] Arriving at the airport    🎙 Encounter  ›
[icon] Checking in at the hotel   🎙 Encounter  ›
...
[lock] Coming soon: <unit without lessons>
```

- **Continue card** at the top: the next lesson to do (rules in [section 6](#6-progress)). Tapping it opens that lesson's player directly. On first open it says "Start here" and points at Unit 1, lesson 1. Hidden once everything is done, replaced by a "Course complete" card that links to Encounters.
- **Two sections**, Part 1 and Part 2, each with a short heading.
- **One card per unit:** icon, title, one-line summary, progress ("1 of 3", or a tick when done), and an "Encounter" pill when the unit has an encounter.
- **Units with no lessons yet** show as locked "Coming soon" cards, like `LockedScenarioCard` on Encounters. They can't be opened.
- Opens instantly: the content is in the app, so there's no loading spinner and no network call.

### 4.2 The unit screen

```
‹  Numbers
   Count, say how many, and give a room or phone number.

   YOU'LL BE ABLE TO
   · Count from 0 to 99
   · Say "two of them" the right way
   · Give your room number at the hotel

   LESSONS
   1  Numbers 0–10                    ✓
   2  Numbers 11–99                   ›
   3  How many?                       ›
   4  Room, phone and flight numbers  ›
   ★  Checkpoint: review the unit     ›

   [🎙 Now try it for real: Arriving at the airport]   (trip units only)
   [📖 Numbers table in Essentials]                    (when linked)
```

- Header: unit title, summary, and 2 to 4 "You'll be able to" lines (the unit's `canDo`).
- **Lesson list** using `LessonRow`: number, title, summary, and a tick when done. Any lesson can be opened.
- **Checkpoint** row after the lessons. It can always be opened, with "Best after the lessons" as its subtitle until all lessons are done.
- **Encounter card** for units with an `encounterId`: opens that encounter's screen (`/encounter/[id]`), where the learner can start talking.
- **Essentials link** when the unit has one (for example Numbers links to the numbers table). Hidden until the Essentials page exists.
- Trip units show "Builds on: Numbers, Money" as links to those units.

### 4.3 The lesson player

Reuse the player from the encounter practice lessons, as #12 describes: **Learn → Practice → Done**.

- **Learn** (`LessonIntro`): the pattern, examples, words and a tip, every item with a speaker button. Header shows "Lesson 2 of 4".
- **Practice** (`ExerciseStep`): one question at a time, with a progress bar. A wrong answer shows a hint and allows another try. Respects the **Show pinyin** setting, as it does now.
- **Done** (`LessonComplete`): the cheer and summary, then **Next lesson** (the next unfinished lesson in the unit), or **Checkpoint** when the unit's lessons are all done. **Now try it for real** shows only when the unit has an `encounterId`.
- **Exit** (X) goes back to the unit screen. Leaving partway saves nothing: the lesson starts over next time. Lessons are short enough that this is fine.
- The "Start encounter" shortcut in the header shows only for units with an encounter.

### 4.4 The checkpoint

- 8 to 10 questions drawn from the unit's lessons, mixed in order. Picked at random each time so a second go isn't identical, with at least one question from each lesson.
- Same player and same rules as a lesson: hints, retries, no failing. It skips the Learn step.
- The Done screen shows the first-try score. When the checkpoint and all lessons are done, the unit counts as done and the Done screen says so ("Unit complete!").

### 4.5 States

| Thing | States |
|---|---|
| Lesson | Not done · Done (tick) |
| Checkpoint | Not done · Done (tick, with best first-try score) |
| Unit | Coming soon (locked) · Not started · In progress ("2 of 4") · Done (all lessons and the checkpoint) |

---

## 5. Lessons and question types

### What makes a lesson

| Part | Rule |
|---|---|
| Length | 3 to 5 minutes |
| Pattern | One, with slots in `[brackets]`, or none for word-only lessons like Hello and goodbye |
| Words | Up to 8 new ones |
| Examples | 2 to 4 full sentences using the pattern |
| Tip | One short tip, for a culture note or a "watch out" |
| Questions | 5 to 8. At least 2 multiple choice and at least 1 word-tile build. At least 1 reuses a word from an earlier unit |

### Question types

| Type | Status | What the learner does | Best for |
|---|---|---|---|
| Choice: what does it mean? | **Exists** | Sees Chinese, picks the English | New words |
| Choice: which one is it? | **Exists** | Sees English, picks the Chinese | Words and phrases |
| Choice: fill the gap | **Exists** (`BLANK`) | Picks the missing word in a sentence | Patterns |
| Build the sentence | **Exists** | Taps word tiles into order | Whole sentences |
| **Listen** | New | Taps play, hears Chinese with no text on screen, picks the meaning or the characters. The text appears after answering | Tones, numbers, prices, times |
| **Match pairs** | New | Matches 4 or 5 Chinese items to their English | Word review, checkpoints |
| Speak | Later | Says the phrase out loud and the app checks it | Needs the backend (speech-to-text costs money per try) |

Listening matters most for Unit 1 (tones) and Units 5 to 7 (numbers, prices, times), where hearing the answer is the actual skill. The audio still plays only on a tap, never automatically (see [Non-functional](#10-non-functional-requirements)).

Adding Listen and Match pairs changes `ExerciseStep`, which the encounter practice lessons also use. That ticket needs Ralph's review, and the encounter lessons must keep working exactly as before.

---

## 6. Progress

### What counts as done

- **Lesson:** answering every question (getting it right eventually counts). This is what the practice lessons do now.
- **Checkpoint:** the same.
- **Unit:** every lesson plus the checkpoint.
- Doing a lesson again is always allowed. It keeps the best first-try score.

### Where it's saved

On the phone with AsyncStorage, under **its own key**, separate from the encounter practice lessons (`lingvoyage.lessons.v1` stays as it is). Store an object rather than a list, so scores and checkpoints fit without a new key later:

```ts
// AsyncStorage key: 'lingvoyage.units.v1'
type StoredUnitProgress = {
  lessons: Record<string, LessonResult>;     // key: 'unitId/lessonId'
  checkpoints: Record<string, LessonResult>; // key: 'unitId'
  lastUnitId?: string;                       // the unit opened most recently
};

type LessonResult = {
  finishedAt: string; // ISO date
  firstTry: number;   // best score so far
  total: number;
};
```

Follow the pattern in `src/lib/lessonProgress.ts`: an in-memory copy, `useSyncExternalStore`, and wait for the stored copy to load before writing, so a write never drops older progress.

### The Continue card

1. The first unfinished lesson in `lastUnitId`, if there is one.
2. Otherwise, the first unfinished lesson in course order (Unit 1 onward).
3. Otherwise, the first unfinished checkpoint.
4. Otherwise, everything is done: show "Course complete".

### Lesson ids never change

Progress is saved by `unitId/lessonId`. **Once a unit ships, its ids are permanent**: rename a title freely, but never an id. Progress for an id that no longer exists is ignored, not shown as an error.

---

## 7. Links to Encounters and Essentials

| From | To | When |
|---|---|---|
| Unit screen and lesson Done screen | The matching encounter | Unit has an `encounterId` (`airport`, `hotel`, `restaurant`, `train` today) |
| Unit screen | An Essentials page (for example the numbers table, the tones chart) | Unit has an `essentials` link and that page exists |
| Encounter screen (later) | The matching unit ("Want more practice? Ordering food") | Optional follow-up. It touches the encounter screen, so it needs Ralph's review |

**Lessons vs Essentials:** Essentials is the reference (the tone chart, the numbers table), Lessons is the guided practice with quizzes. They can teach the same thing, and should link to each other rather than repeat long explanations.

**Lessons vs encounter practice lessons:** the encounter warm-ups stay as they are (a quick 3-lesson prep for one scene, served by the backend). The trip units in this tab go deeper and live in the app. They can start from the warm-up content, but they're written as their own lessons.

---

## 8. Content rules

From #12, plus a few additions:

- **HSK 1 and 2 words**, Simplified characters, pinyin with tone marks, words separated by spaces (`nǐ hǎo`, not `ni3 hao3`).
- **Travel words beyond HSK 2** (护照, 过敏, 站台) are fine where a traveler needs them, up to 3 per lesson.
- **Tone changes for 一 and 不 written as said**, like the rest of the app (`bú yào`, `yì wǎn`). Two 3rd tones in a row are written as normal (`nǐ hǎo`), and Unit 1 lesson 3 explains that they're said differently.
- **Every Chinese item** shows hanzi, pinyin and English, and has a speaker button.
- **Plain English.** No grammar terms without an example. "Measure word" becomes "a small word between a number and a thing, like 'a cup of' in English".
- **Check every item against a dictionary** (MDBG or Pleco). A wrong tone mark teaches the wrong word. If a native speaker can read through a unit before it ships, even better.
- **The dev check from #12 runs on every unit:** in `__DEV__`, answer indexes in range, 2 to 4 different options, word tiles that spell the solution. A typo throws an error straight away.

### Done checklist for a content ticket (one unit)

- [ ] Every lesson in this doc's table for the unit, or a note in the PR on what changed and why
- [ ] Each lesson follows [What makes a lesson](#what-makes-a-lesson)
- [ ] The unit's `canDo` lines, and its checkpoint (once checkpoints exist)
- [ ] Every item checked in MDBG or Pleco
- [ ] The dev check passes, `npm run typecheck` and `npm run lint` pass
- [ ] Every lesson played through once on a phone, every speaker button tapped

---

## 9. Data model

Content lives in `mobile/src/content/lessons/`, one file per unit, as #12 suggests. The `Lesson` and `Exercise` types come from `src/types/api.ts` unchanged. Anything new is added in the content folder's own `types.ts`, not in `api.ts`.

```ts
// src/content/lessons/types.ts
import type { Lesson } from '@/types/api';

export type PartId = 'basics' | 'trip';

export type Unit = {
  id: string;                // 'numbers', 'money', 'airport', ... Permanent once shipped
  part: PartId;
  title: string;
  summary: string;
  icon: string;              // a lucide icon name, like the scenario icons
  canDo: string[];           // "You'll be able to" lines, 2 to 4
  buildsOn?: string[];       // unit ids, shown as links on trip units
  encounterId?: string;      // the matching encounter, e.g. 'airport'
  essentials?: string;       // an Essentials route, e.g. '/essentials/tables/numbers'
  lessons: Lesson[];         // [] = coming soon
};

export const PARTS: { id: PartId; title: string; summary: string }[] = [
  { id: 'basics', title: 'Start here: the basics', summary: 'How Chinese works, and the words you need everywhere.' },
  { id: 'trip', title: 'On your trip', summary: 'From the airport to the dinner table.' },
];
```

- **Order** is the order of `units.ts`. Lessons are in the order of each unit's `lessons` array.
- **The checkpoint** is built from the unit's lessons when it opens, so it needs no content of its own. A unit can add hand-written checkpoint questions later if the random mix isn't good enough.
- **New question types** (Listen, Match pairs) are a change to the `Exercise` type and `ExerciseStep`, made in their own ticket ([section 11](#11-build-order)).

---

## 10. Non-functional requirements

- **Works offline.** Lesson content is part of the app, so lessons open and run without internet. Audio needs internet the first time each phrase plays, and shows a friendly message when it can't load (`SpeakerButton`'s `onError`).
- **Audio costs credits.** The first play of each phrase is a paid text-to-speech call; replays are free. Only play when someone taps, never preload a list. Listen questions play on a tap too.
- **Accessibility.** Headers marked as headers, every button and row labeled, progress bars with values, touch targets at least `layout.minTouchTarget`. Right and wrong are shown with an icon as well as a color.
- **Small phones.** Looks right on an iPhone SE. Long English wraps instead of being cut off.
- **Expo Go.** No new libraries expected. If one is needed, ask first: it must work in Expo Go and be added with `npx expo install`.
- **Theme.** Colors, spacing and radii from `src/theme/theme.ts`, no hard-coded values.

---

## 11. Build order

Feature tickets and content tickets can run at the same time, since content is just data files.

| Phase | Ticket(s) | What | Who / needs |
|---|---|---|---|
| 1 | **#12** | Skeleton: all 14 units under the two Part headings, unit screen, lesson player, progress on the phone (the object from [section 6](#6-progress)), Numbers lesson 1 and Money lesson 1 | Frontend |
| 2 | **#20** | Course features: Continue card, `canDo` lines, checkpoints, Builds on, encounter and Essentials links | Frontend |
| 3 | **#21** (one PR per unit) | Part 1 content: Units 1 to 7. Suggested order, most needed first: Hello and thank you, Your first sentences, Numbers, Money, then the rest | Frontend, content |
| 4 | **#22** (one PR per unit) | Part 2 content: Units 8 to 11 first (they have encounters), then 12 to 14 | Frontend, content |
| 5 | **#23** | New question types: Listen and Match pairs. Add listening questions to Units 1, 5, 6 and 7 | Frontend, touches shared lesson components, so Ralph reviews |
| 6 | Later (in the epic, #19) | Progress saved to the account (a Supabase table), lesson stats on Profile, speaking practice in lessons | Ralph (backend and database) |

---

## 12. Decisions for Ralph

Each has a recommendation; the rest of the doc assumes it.

1. **Locked or open?** Recommended: **open**, with a suggested order and the Continue card. Travelers have a date and specific worries. Locking everything behind Unit 1 makes the app feel slow to someone leaving on Friday.
2. **Unit order.** #12 lists Numbers and Money as units 1 and 2. Recommended: the order in this doc (basics like greetings and first sentences before numbers). The skeleton can still use Numbers and Money as its sample units; only the order in `units.ts` changes.
3. **Is the checkpoint needed for a unit to be "done"?** Recommended: **yes**. It's the only place a unit's lessons get mixed together, and it's short.
4. **Trip units vs encounter warm-ups.** Recommended: write the trip units in the app as their own deeper lessons, starting from the warm-up content, and leave the warm-ups unchanged. The cost is some overlap between the two.

---

## Out of scope, and ideas for later

- **Streaks and reminders.** Possible later, but daily-habit features matter less for a trip with an end date.
- **A trip plan.** "You leave in 12 days: here are the 8 lessons for your stops". This fits with the trip itinerary epic (#13) once it exists.
- **Writing characters.** Travelers need to recognize and say, not write.
- **Other languages.** Everything here is Mandarin. When a second language is added, units become per language (for example `content/lessons/zh/`).
