# City packs: the agentic workflow

How Lingvoyage researches a city on the web with AI agents, and turns what they find into Mandarin lessons, quizzes and role-play scenes at real places. Tracked as the epic [#31](https://github.com/ralphramosgit/lingvoyage/issues/31) (issues #32 to #41, plus #44 for areas). Every number on this page was measured on the running system.

---

## 1. What it does

A learner sets where they're going on **Profile** (for example Chengdu). If nobody has picked Chengdu before, an **agent pipeline** runs on AWS:
1. Four research agents search the web at the same time: transport, culture, places to visit and food.
2. Smaller agents read the menus of the best restaurants.
3. A checker throws out anything doubtful.
4. Two content agents write from what's left: **scenes** at real places, **notes and practice lessons** on the course's units, and **quizzes**.

Every fact keeps the page it came from.

In the app the learner gets:
- **"Made for Chengdu"** scenes, such as ordering 千层肚 (thousand-layer tripe) at a real hot pot restaurant.
- **"In Chengdu"** notes on units.
- A **Chengdu** quiz tab.

In those scenes the character answers off-script questions from the facts (**RAG**): ask for the price of a dish and you get the real menu's price.

A city is built once and shared by everyone who picks it. It takes about **5 minutes and $4 of research**, plus about **$1.60 to write the content**, and is refreshed after 30 days.

```mermaid
flowchart LR
    subgraph app["Lingvoyage app (Expo)"]
        profile["Profile: Going to Chengdu"]
        encounters["Encounters: Made for Chengdu"]
        course["Lessons and Quiz: In Chengdu"]
        activity["Agent activity screen"]
    end
    subgraph api["API Lambda: lingvoyage-api"]
        ensure["POST /packs/{city}"]
        status["GET /packs/{city}/status"]
        get["GET /packs/{city}"]
        turn["POST /conversation/turn"]
    end
    subgraph worker["Worker Lambda: lingvoyage-research (up to 15 min)"]
        plan["1 Plan (code)"] --> research["2 Research: 4 agents at once (Opus 5.5 + web search and fetch)"]
        research --> menus["3 Menu deep dive (Opus 5.5)"] --> verify["4 Verify (code + Haiku judge)"]
        verify --> generate["5 Generate: scenes, notes, quizzes (Sonnet 5.5)"] --> publish["6 Publish"]
    end
    db[("Supabase: location_packs, location_facts, location_content")]
    character["Claude Sonnet 5.5: the character"]

    profile --> ensure -->|"async invoke, only when the city has no pack"| plan
    research & menus & verify & generate -->|"trace, facts, content"| db
    activity -->|"every 3 s while a run is going"| status --> db
    encounters & course --> get --> db
    encounters -->|"chat turn"| turn -->|"retrieve up to 8 facts (RAG)"| db
    turn -->|"facts in the prompt"| character
```

---

## 2. The pipeline, stage by stage

The pipeline is [`backend/app/research/pipeline.py`](../../backend/app/research/pipeline.py), and it runs in the worker Lambda ([`worker.py`](../../backend/app/research/worker.py)). Each stage writes readable steps into the pack's trace, which the app's activity screen shows live.

| Stage | Input → output | Model | Tools and caps | If it fails |
|---|---|---|---|---|
| **1 Plan** | A city → 4 briefs: `culture`, `transport`, `hot_spots`, `food` ([`briefs.py`](../../backend/app/research/briefs.py)) | none (code) | none | n/a |
| **2 Research** | 4 briefs → facts with sources | `claude-opus-5-5`, effort `medium` | `web_search`, `web_fetch` (Anthropic-run), plus our `record_*` tools. **4 agents in parallel.** Each: 12 requests, 8 searches (wraps up at 8, stopped at 16), 6 page reads, 150 s, 40 facts | One agent failing doesn't stop the others. If none finds anything, the pack fails with `research_failed` |
| **3 Menu deep dive** | The 4 best-documented restaurants → their dishes and prices | `claude-opus-5-5` | One small agent per restaurant: 8 requests, 4 searches, 4 reads, 120 s | A restaurant without a menu online keeps its dishes at low confidence, without prices |
| **4 Verify** | All facts → the checked facts ([`verify.py`](../../backend/app/research/verify.py)) | `claude-haiku-5-5` (judge) | Code: drop duplicates, impossible prices (e.g. metro over ¥30) and dishes whose restaurant wasn't found. Then the judge: keep, drop or lower confidence | If the judge call fails, the code-checked facts are kept |
| **5 Generate** | Saved facts → scenes ([`encounters.py`](../../backend/app/content/encounters.py)), notes, lessons and quizzes ([`course.py`](../../backend/app/content/course.py)) | `claude-sonnet-5-5`, effort `medium` | Structured output and checks; up to 3 tries per piece. Scenes and course are written **at the same time**, 3 pieces at a time each | A piece that still fails is skipped and noted in the trace; the pack is published anyway |
| **6 Publish** | → the pack is `ready` and becomes the city's live pack | none | none | n/a |

### One research agent

Each agent is our own loop ([`workers.py`](../../backend/app/research/workers.py)) around one streamed Claude request at a time. We wrote the loop ourselves rather than using the SDK's tool runner, because it needs per-turn control:
- counting searches across turns (`max_uses` only applies per request);
- remembering which pages the agent has seen, for the source check;
- writing the live trace.

```mermaid
sequenceDiagram
    participant W as Our loop (workers.py)
    participant C as Claude Opus 5.5
    participant T as Anthropic web tools
    W->>C: brief + tools: web_search, web_fetch, record_*, finish
    C->>T: web_search "Chengdu metro fares airport line 18"
    T-->>C: results (URLs, titles)
    C->>T: web_fetch a metro guide page
    T-->>C: the page, filtered down to what's relevant
    C->>W: record_transport {Line 18, ¥2–¥10, source_url}
    W->>W: check the schema, and that source_url was in the results
    W-->>C: "Saved (3 so far)" or "Not saved: <reason>"
    Note over W,C: repeats until finish, or a cap (12 requests, 8 searches, 150 s)
    C->>W: finish {summary, gaps}
```

Facts are saved after the verify stage, so a run that crashes halfway leaves nothing half-checked behind.

---

## 3. The agent patterns, and where they're used

| Pattern | Where | Code |
|---|---|---|
| **Orchestrator–workers** | The pipeline hands one brief to each research agent, then one restaurant to each menu agent | [`pipeline.py`](../../backend/app/research/pipeline.py), [`briefs.py`](../../backend/app/research/briefs.py) |
| **Parallelization** | 4 research agents at once; the menu agents at once; scenes and course written at the same time | [`workers.py`](../../backend/app/research/workers.py) `run_workers`, `pipeline._generate` |
| **Server tools + client tools** | Anthropic runs `web_search` and `web_fetch`; our code runs the `record_*` tools that save facts | [`workers.py`](../../backend/app/research/workers.py), [`tools.py`](../../backend/app/research/tools.py) |
| **Evaluator–optimizer** | Every scene, note and quiz: Claude writes a draft, code checks it, and the problems go back to be fixed, up to 3 tries | [`drafts.py`](../../backend/app/content/drafts.py) `write_checked` |
| **LLM-as-judge** | A cheap model reviews all the facts for contradictions, ads and anything unsafe | [`verify.py`](../../backend/app/research/verify.py) `judge_facts` |
| **RAG** | Before a chat turn in a local scene, the facts matching what the learner said go into the character's prompt | [`retrieve.py`](../../backend/app/locations/retrieve.py), [`tutor.py`](../../backend/app/tutor.py) |
| **Structured outputs** | Drafts are Pydantic models, parsed with `client.messages.parse`, then turned into the app's own models | [`encounters.py`](../../backend/app/content/encounters.py), [`course.py`](../../backend/app/content/course.py) |
| **Prompt caching** | The system prompts (rules, word list, examples) are identical for every call, so they're cached | `cache_control` in [`claude.py`](../../backend/app/research/claude.py), [`drafts.py`](../../backend/app/content/drafts.py) |

---

## 4. Tools

**Anthropic's server tools** (they run on Anthropic's side): `web_search_20260209` (with `user_location` set to the city) and `web_fetch_20260209`. Both filter results down to the relevant parts before they reach the model.

**Our record tools** ([`tools.py`](../../backend/app/research/tools.py)):
- Each tool's schema is generated from a Pydantic model with `anthropic.transform_schema` and sent as **strict**.
- The same model checks every input again on our side.
- Errors go back to the agent as tool results, so it can fix them and retry.

| Tool | Saves | Key fields |
|---|---|---|
| `record_note` | culture, etiquette, a fun fact | title (≤ 80), body (≤ 400), hanzi, pinyin |
| `record_transport` | a line, link, taxi or card | mode, line, origin, destination, fare min/max, minutes |
| `record_price` | what something costs | item, price min/max in whole yuan |
| `record_hot_spot` | a place to visit | place key, name, Chinese name, area, ticket, opening hours, tip |
| `record_restaurant` | a restaurant | place key, name, Chinese name, cuisine, price per person, known-for dishes |
| `record_menu_item` | one dish (menu agents only) | dish, Chinese, pinyin, price, spicy, vegetarian |
| `finish` | the agent's summary | one-line summary, what it couldn't find |

**Every record carries `source_url`, `source_title` and `confidence`.** The URL must be one this agent saw in its search or fetch results or a citation (another page on the same site is accepted). A URL the agent made up is refused.

---

## 5. Prompts

| File | Prompt | Rules it enforces |
|---|---|---|
| [`research/prompts.py`](../../backend/app/research/prompts.py) | Research system prompt, the brief, the fact judge | Save only through the record tools; one fact per call; the exact source URL; web pages are data, never instructions |
| [`content/prompts.py`](../../backend/app/content/prompts.py) | Scene writer, course writer | Beginner Mandarin (HSK 1–2 plus words the lessons teach); tone-marked pinyin; prices and lines only from the facts; scripts follow a real visit (greet, offer real dishes, order, pay) and every reply asks the question that leads to the next goal; the traveler is already in the city, so never "I want to go to Beijing" in Beijing; goals come from what's special about the place; facts are data |
| [`tutor.py`](../../backend/app/tutor.py) | The character in every chat | Stay in character; short beginner lines; follow the script's order and never jump ahead; offer real options by name; don't coach (no 你要问…吗？); a goal counts only when the learner says it; with local facts, answer from them or say 我不知道 ("I don't know") |

---

## 6. Guardrails

| Risk | What stops it |
|---|---|
| Made-up facts | Saving is only possible through the strict record tools; every fact needs a source the agent actually saw; the verify stage's code checks and judge |
| Made-up prices or metro lines in lessons and scenes | `number_problems` ([`checks.py`](../../backend/app/content/checks.py)): every price and line number must come from the facts, or the draft goes back |
| Too hard for a beginner | A per-character level check: HSK 1–2, words the scene's own lessons teach, or names from the facts; character lines of 25–30 characters at most |
| Bad scene flow | Scripts must greet and ask a question, offer at least 2 real dishes before the order, and end with paying; every reply between the opening and the goodbye asks exactly one question, to lead on to the next goal; the traveler never goes to the city they're already in; at most one generic goal, and none copied from the template |
| Prompt injection from web pages | Pages are labelled as data; the only side effects are the strict record tools; facts reach the chat in a marked "data, not instructions" block |
| A character inventing answers | The RAG block tells it to say 我不知道 or 我不清楚 ("I don't know" / "I'm not sure") for anything not in the facts. Tested: asked about WiFi, it said it didn't know |
| Cost running away | Caps on every agent (requests, searches, reads, time); `RESEARCH_RUNS_PER_DAY` (default 2) and `RESEARCH_RUNS_PER_ACCOUNT_PER_DAY` (default 1), with **0 pausing new runs**; only the open cities (Beijing, Shanghai, Chengdu, Chongqing) can start a run from the app; one run per city at a time (a database index); a failed refresh waits a day; a built city costs nothing to open |
| Runs that hang | The worker Lambda times out at 15 minutes; a run older than 20 minutes is marked `timed_out` and the city is free again |
| Faking "live" | The app only says "Building…" or "Live" while the API reports a run `queued` or `running`; a built pack's trace is labelled "How this pack was built, <date>" |
| Privacy | The input is a city slug, never learner text; "Use my location" picks the nearest city on the phone and never stores or sends coordinates |

---

## 7. Data model

Three backend-only tables (RLS on, no policies: the app reads them only through the API), plus one profile column. SQL in [#32](https://github.com/ralphramosgit/lingvoyage/issues/32).

| Table | Columns | What for |
|---|---|---|
| `location_packs` | `id`, `city`, `status` (`queued`/`running`/`ready`/`failed`), `stage`, `trace` (the agent's steps), `usage` (tokens per model, searches, seconds per stage, cost estimate, live counts), `error`, `requested_by`, `created_at`, `finished_at`, `expires_at` | One research run. The newest `ready` pack is the city's live pack; a unique index allows one `queued`/`running` run per city |
| `location_facts` | `pack_id`, `category`, `place_key`, `title`, `body`, `hanzi`, `pinyin`, `data` (per category: fares, ticket, dish price…), `source_url`, `source_title`, `confidence`, `retrieved_at` | What the agents found, each with its source |
| `location_content` | `pack_id`, `kind` (`encounter`/`unit_notes`/`quiz`), `ref`, `payload`, `fact_ids` | What the content agents wrote, and the facts it came from |
| `profiles.destination_city` | a city slug | The learner's destination (the app writes it on Profile and in onboarding) |

---

## 8. Numbers

**Research** (two full runs, #33). Prices are list prices; the Console's usage page has the billed amounts.

| | Chengdu | Beijing |
|---|---|---|
| Total time | **5.0 min** | **4.8 min** |
| Research / deep dive / verify / publish | 186 s / 101 s / 14 s / 1 s | 170 s / 97 s / 17 s / 1 s |
| Cost | **$3.73** | **$3.90** |
| Web searches / pages read | 48 / 32 | 52 / 25 |
| Opus requests / output tokens | 29 / 64K | 20 / 72K |
| Opus input: cache reads / cache writes / uncached | 2.15M / 306K / 246 | 1.99M / 309K / 228 |
| Facts kept | 111 of 111 | 120 of 121 |
| Sources (sites) | 42 (32) | 61 (34) |

Where Chengdu's money went: cache writes $1.53, Opus output (mostly thinking) $1.29, searches $0.48, cache reads $0.43, the judge under $0.01.

**Content** (Sonnet 5.5):

| Run | Pieces | Requests | Tokens (in / out / cache read / cache write) | Cost |
|---|---|---|---|---|
| Beijing, everything | 18 of 19 written (6 scenes, 10 units, 2 quizzes) | 32 | 107K / 125K / 427K / 30K | **$1.62** |
| Chengdu, 6 scenes rewritten | 6 of 6 | 10 | n/a | $0.84 |

Most pieces pass on the first or second try; one quiz per city has needed more than 3 so far. A single scene costs $0.08–0.30.

**Chat (RAG):**
- Retrieval adds about **1.5–3 ms** per turn once a city's facts are in memory. The first load from Supabase is about 150 ms, once per 10 minutes per warm Lambda (the target was under 50 ms).
- A chat turn is one Sonnet call (two when its line breaks a rule and it's asked again), about a cent.

**Per new city, all in:** about $5.50 and 7–8 minutes the first time (research measured at 5 minutes; writing measured separately at about 2.5 minutes, since scenes and course run at the same time), then free for every learner for 30 days.

---

## 9. Decisions

| Decision | Instead of | Why |
|---|---|---|
| **Claude API with our own loop** | The SDK's tool runner, Managed Agents, the Agent SDK, an MCP server | It runs in our own Lambda with our own tools, with no beta hosting platform. Our loop gives per-turn control (search budgets across turns, the seen-pages source check, the live trace). Managed Agents fits scheduled refreshes later. The Agent SDK brings file and shell tools we don't need. MCP adds nothing when only our backend calls these tools |
| **Supabase tables** | Per-account S3 storage (the old plan, #16) | Packs are shared per city, not per account; one database, and facts are easy to query for RAG |
| **A second Lambda, async invoke** | EC2, Step Functions | A run takes 5–8 minutes; Lambda allows 15, costs about half a cent a run and needs no server. Step Functions is the next step only if runs outgrow one Lambda |
| **Keyword RAG, no embeddings** | pgvector | A city is a few hundred facts; scoring them in memory takes about 2 ms. `retrieve()` is one function, so embeddings can replace it without touching the tutor |
| **Opus 5.5 for research** | Sonnet 5.5 | The research agents reason over messy pages and decide what to save. Sonnet writes content and plays the characters, Haiku checks facts |
| **Agents cite fact numbers** | Copying fact ids | Facts are numbered in the prompt and code maps the numbers to ids: more reliable than asking a model to copy UUIDs |
| **Add to the course, don't rewrite it** | Local versions of every lesson | The 17 units stay the same for everyone, so progress, checkpoints and search keep working; local notes, lessons and quizzes sit on top |
| **Default or city scenes, the learner's choice** | Replacing the default scenes | A toggle on Encounters ("Made for Chengdu" / "Default scenes") |

---

## 10. Run it yourself

Run these in `backend/`, with the virtual environment active and `backend/.env` filled in ([setup guides](../setup/00-START-HERE.md); `SUPABASE_SECRET_KEY` is needed too).

```bash
python -m pytest                                              # 256 tests, no API calls
python -m app.research.cli chengdu --quick --dry-run          # one small agent, nothing saved: well under $1
python -m app.research.cli chengdu --dry-run                  # the full research, printed, nothing saved: about $4
python -m app.content.cli chengdu --list                      # what's written and what's left: free
python -m app.content.cli chengdu --only scene:mawangzi --dry-run --json scene.json   # one scene: about $0.15
python -m app.locations.retrieve local-chengdu-mawangzi "有没有素菜？"   # what RAG retrieves for a question: free
```

**The whole flow locally:**
1. Start `uvicorn app.main:app --reload` and point `mobile/.env`'s `EXPO_PUBLIC_API_URL` at it.
2. Run `npx expo start` in `mobile/` and open the app in Expo Go.
3. On Profile, set Going to → Chengdu.
4. Without Expo: `python scripts/try_packs.py chengdu` shows the pack's status and summary, and `python scripts/try_encounter.py local-chengdu-mawangzi` chats with a scene in the terminal.

**Reading a run in Supabase** (SQL Editor):

```sql
select city, status, stage, created_at, finished_at,
       usage->'seconds' as seconds, usage->>'cost_usd_estimate' as cost,
       usage->>'web_search_requests' as searches, jsonb_array_length(trace) as steps
from location_packs order by created_at desc;

select category, count(*) from location_facts where pack_id = '<pack id>' group by category;
```

---

## 11. Demo script (3 minutes)

1. **(0:00) The problem.** Open Encounters on **Default scenes**: a made-up noodle shop, the same for every learner.
2. **(0:20) Set a city.** Profile → Going to → Chengdu. Back on Encounters, the toggle switches to **Made for Chengdu**: 6 scenes at real places.
3. **(0:40) How it was built.** Tap the pack row ("111 facts from 42 sources") to open the activity screen:
   - the 6 stages, and "Researching · 4 agents";
   - the steps: real searches, the pages read, each fact found;
   - "How this pack was built, Oct 31". Say it: this was a real run, replayed, and new runs show here live.
4. **(1:20) Play a real place.** Open **Hot pot at Shu Jiu Xiang**. Point at "Real details from the web · Sources". Start: the waiter greets you and asks how many; say 两位 (two people); it offers 千层肚, 九香牛肉, 鸭肠 (real dishes from the menu).
5. **(1:50) RAG.** Ask something off script: 有没有素菜？ (any vegetarian dishes?) or 地铁多少钱？ (how much is the metro?). It answers from the researched facts. Ask 这里有WiFi吗？ (is there WiFi here?): it says it doesn't know rather than making something up.
6. **(2:20) The course.** Lessons → Getting around → **In Chengdu**: real metro lines, with audio. Quiz → **Chengdu**.
7. **(2:40) Cost and guardrails.** One city costs about $4 of research and $1.60 of writing, once, shared by every learner. Every fact has a source; numbers in lessons must come from facts; new runs can be paused with one setting.

To show a run **live**, set `RESEARCH_RUNS_PER_DAY=1` on `lingvoyage-api` beforehand and pick an open city that isn't built yet (about $5.50, 7–8 minutes). Set it back to `0` afterwards. Only the cities marked `available` in `backend/app/locations/cities.py` can be picked; the rest are "coming soon" on the map.

---

## 12. What's next

- **Area packs and the map** ([#44](https://github.com/ralphramosgit/lingvoyage/issues/44)): pick a spot on an OpenStreetMap map (walking or a short drive) and a small Sonnet agent researches the 3–5 places right there.
- **The transport quiz:** it has failed its checks in both cities. Find which check it trips.
- **Scheduled refresh** of expiring packs (an EventBridge schedule, or Managed Agents scheduled deployments), with content writing on the Batch API at half price.
- **Embeddings** (pgvector) for retrieval if packs grow much bigger.
- **A structured places API** (for example Amap) as an extra research tool for addresses, hours and per-person prices.
- **"Ask about Chengdu":** a chat that answers from the pack with sources, falling back to a live web search.
