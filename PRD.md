# PRD — GiftProof

> Product Requirements Document. Defines **WHAT** we build and **WHY**. The HOW (all code) lives in `ARCHITECTURE.md`; the WHEN/ORDER lives in `PLAN.md`. The non-negotiable law lives in `INVARIANTS.md`. The Thesis lives only in `warroom/WINNER-BRIEF.md` — this doc references it, never restates-with-modification.

---

## Section 1: Project Overview

**Project:** GiftProof — *the gift agent that reads a stranger's taste.*

**Hackathon:** Qloo Agentic Hackathon ("Agents, but with taste."). Single sponsor track. **Deadline:** Oct 30, 2026 11:45 PM EDT (= Oct 31, 04:45 WAT). Internal cutoff: packaged by Oct 30 20:00 WAT.

**Problem statement.** Buying a gift for someone whose taste you cannot guess — a parent, in-law, colleague, a new partner — is a near-universal, recurring, emotionally acute problem with no good solution. Keyword search and a generic LLM both collapse to the *giver's* taste bubble or a safe cliché. **One shocking number:** US consumers spend ~$1T/yr on gifts, and surveys routinely find a third or more of recipients are disappointed. The "I have no idea what they'd like" gap is enormous and unserved.

**Solution summary.** The giver types ONE sentence about the recipient using only public taste ("my sister loves *Succession*, Aesop, and A24"). GiftProof's backend resolves those tastes to real Qloo entity IDs, then calls Qloo `/v2/insights` **cross-domain** — seeding signals of one kind (a show, a brand, a studio) and asking Qloo to rank entities of a *giftable* kind by **shared-audience affinity**. `feature.explainability` returns which seed entities drove each pick. An entity→gift resolver maps the Qloo-chosen entity to a buyable digital e-gift / gift-card / reservation, and the giver completes the purchase. The whole thing is wrapped in a split **"Qloo says / we chose"** provenance receipt that **recomputes live** when the giver swaps a seed — the hero moment the judge watches mutate.

**Why this wins (mapped to judging criteria — all five weighted 20%):**
- **Usefulness (8.5):** universal recurring pain; ends in a completed purchase, not a suggestion.
- **Technical execution (7.5):** 4 Qloo surfaces genuinely load-borne (insights cross-domain + explainability core; search + tags supporting); quota-frugal (cache + 2-in-flight semaphore + debounce).
- **Provenance & user clarity (9.0):** the split "Qloo says / we chose" receipt IS the literal decisive rubric line — *"Qloo results as evidence in a clear product flow rather than an isolated API response."*
- **Responsible data handling (8.0):** aggregate taste entities only; **no PII to Qloo**; digital e-gift/reservation = no shipping address.
- **Reproducibility (7.2):** Next.js/Node, backend-only credential, durable always-on Oracle host; from-scratch setup.

**Thesis framing** (Thesis field 1, WINNING ARGUMENT — see WINNER-BRIEF `## Thesis`): GiftProof is the only finalist where Qloo's cross-domain correlation does irreplaceable work the giver cannot do themselves — bridge a taste gap — ending in a completed purchase, with provenance that answers the exact rubric line. The headline is the **taste-correlation-that-bridges-a-gap**, never the checkout (that would be a drift tripwire).

---

## Section 2: System Architecture Overview

```
                            ┌──────────────────────────────────────────────┐
  Giver (browser)           │                GiftProof (Next.js)             │
  ┌───────────────┐         │                                                │
  │ one sentence  │──POST──▶│  /api/gift  (App Router route handler)         │
  │ about recip.  │         │     │                                          │
  └───────────────┘         │     ▼                                          │
         ▲                  │  ┌───────────────┐   extract entities + tastes │
         │ ranked gifts +   │  │ Extractor     │──▶ (LLM: Claude — NOT ranking)│
         │ split receipt    │  │ (llm/extract) │                              │
         │                  │  └───────┬───────┘                              │
         │                  │          ▼                                      │
         │                  │  ┌───────────────┐  name→entity ID  ┌─────────┐ │
         │                  │  │ Resolver      │─────────────────▶│ Qloo    │ │
         │                  │  │ (qloo/resolve)│  /search /v2/tags │ API     │ │
         │                  │  └───────┬───────┘                  │ (hack.  │ │
         │                  │          ▼ signals[]                │ tenant) │ │
         │                  │  ┌───────────────┐  cross-domain    │         │ │
         │                  │  │ Ranker (CORE) │─ /v2/insights ──▶│ X-Api-  │ │
         │                  │  │ qloo/insights │  +explainability │ Key     │ │
         │                  │  └───────┬───────┘◀─ ranked+affinity└────┬────┘ │
         │                  │          ▼                               │      │
         │                  │  ┌───────────────┐        ┌──────────────▼────┐ │
         │                  │  │ Gift Resolver │        │ Cache (LRU) +      │ │
         │                  │  │ (entity→SKU)  │        │ Semaphore(2) +     │ │
         │                  │  │ catalog 500+  │        │ param-validator    │ │
         │                  │  └───────┬───────┘        └───────────────────┘ │
         │                  │          ▼                                      │
         │                  │  ┌───────────────┐   narrate receipt copy      │
         │                  │  │ Narrator      │──▶ (LLM: Claude — NOT ranking)│
         │                  │  │ (llm/narrate) │                              │
         │                  │  └───────┬───────┘                              │
         └──────────────────┤          ▼  { picks[], provenance[], raw }     │
                            │  ┌───────────────┐                             │
                            │  │ Action layer  │  Option-A buy-link hand-off │
                            │  │ (action/*)    │  Option-B Tremendous sandbox│
                            │  └───────────────┘                             │
                            └──────────────────────────────────────────────┘
           Host: Oracle Always-Free VM · nginx+TLS · pm2 · Qloo key in VM env ONLY
```

**Component table:**

| Name | Type | Purpose | Key Dependencies |
|---|---|---|---|
| Web UI | Next.js App Router pages/components | Sentence input, ranked gift cards, affinity bars, split receipt, seed-swap chips, buy CTA | React 19, Tailwind v4, `/api/*` |
| `/api/gift` | Route handler (backend) | Orchestrates extract → resolve → rank → gift-resolve → narrate → respond | all core libs below |
| `/api/swap` | Route handler (backend) | Re-run ranking + provenance for a single swapped seed (the live-recompute hero) | Ranker, Gift Resolver, Narrator, Cache |
| `/api/health` | Route handler | Keep-warm + liveness (returns build sha + Qloo reachability w/o key leak) | Qloo client (HEAD) |
| Extractor | lib (`llm/extract`) | Sentence → candidate taste names + domains (LLM, extraction ONLY) | Claude API |
| Resolver | lib (`qloo/resolve`) | Names → Qloo entity IDs (`/search`) and tag URNs (`/v2/tags`); coverage report | Qloo client |
| Ranker (CORE) | lib (`qloo/insights`) | Cross-domain `/v2/insights` + `feature.explainability`; the gift ranking | Qloo client, Validator |
| Gift Resolver | lib (`gift/resolve`) | Qloo entity → buyable digital gift (catalog 500+ + labeled semantic fallback) | catalog data, tag match |
| Narrator | lib (`llm/narrate`) | Turns Qloo's rank/contribution output into human receipt copy (narration ONLY) | Claude API |
| Provenance builder | lib (`qloo/provenance`) | Assembles the split "Qloo says / we chose" structure from raw Qloo output (rank-band, never fabricated %) | Ranker output |
| Qloo client | lib (`qloo/client`) | Single HTTP gateway: `X-Api-Key`, GET query params, validator, cache, semaphore | Cache, Semaphore, Validator |
| Cache | lib (`infra/cache`) | In-process LRU keyed on normalized signal set | — |
| Semaphore | lib (`infra/semaphore`) | 2-in-flight limiter for all Qloo calls | — |
| Validator | lib (`qloo/validate`) | Rejects/asserts params + asserts non-empty affinity-bearing results (silent-ignore defense) | — |
| Action layer | lib (`action/*`) | Option-A buy-link hand-off (baseline); Option-B Tremendous sandbox issue (optional) | provider adapter |

**Data flow:** Each request is a single forward pass: `sentence → extract → resolve(Qloo) → rank(Qloo) → gift-resolve → provenance(Qloo raw) → narrate → render`. No per-user persistence (stateless). The only state is a derived in-process LRU cache (safe to lose).

---

## Section 3: User Flows

**Flow 1 — Hero: gift for a taste you don't share (happy path).**
1. Giver lands on `/` → sees the value line + a pre-seeded sample journey already rendered (no empty state).
2. Giver types one sentence into `/app`: *"My sister is obsessed with Succession, Aesop skincare, and A24 films."*
3. Submit → Extractor pulls `{Succession (tv_show), Aesop (brand), A24 (brand/company)}`.
4. Resolver resolves each to a Qloo entity ID via `/search`; unresolved → `/v2/tags` fallback; coverage shown honestly ("3 of 3 tastes resolved to Qloo entities").
5. Ranker calls `/v2/insights` cross-domain: `filter.type=urn:entity:brand` (and other giftable domains) seeded with the resolved signals + `feature.explainability=true`.
6. Gift Resolver maps the top Qloo entities to buyable digital gifts from the catalog.
7. UI renders **ranked gift cards** with **affinity bars / rank bands** and a split **"Qloo says / we chose"** receipt.
8. Giver reads the provenance: "Qloo ranked *Diptyque e-gift card* #2 of brand gifts for this audience — fans of A24 and Aesop over-index on it. **We chose** it because it's a digital gift card (deliverable, no address)."

**Flow 2 — Hero moment: swap a seed, watch it recompute (the on-air "oh").**
1. Each resolved taste is a removable/addable **seed chip**.
2. Giver removes "A24" and adds "Phoebe Bridgers" → `/api/swap` fires (debounced 350ms).
3. The ranking + the split receipt **recompute live** — new picks, new affinity bars, new provenance copy — visibly mutating in place.

**Flow 3 — Complete the gift (the closing beat, LIGHT).**
1. Giver clicks **"Get this gift"** on a card.
2. Option-A (baseline, always): opens a real buy-link hand-off to the digital-gift rail in a new tab; GiftProof records the hand-off.
3. Option-B (optional upgrade, only if Tremendous sandbox keys confirm day-one): issues a REAL sandbox e-gift and shows the real order/confirmation ID from the provider response (never a mocked "Order placed" toast).

**Flow 4 — Error / edge (hostile input), summary.**
- Empty/one-word/gibberish sentence → labeled: "I couldn't find a public taste to work from — try naming a show, artist, brand, or place."
- Taste resolves to 0 Qloo entities → tag fallback; if still empty → labeled graceful fallback ("Qloo returned no affinity-bearing results for this taste set; try a different or additional taste"), NEVER a fabricated ranking.
- Qloo 429 (quota) → semaphore + cache absorb; on hard 429 → labeled retry-after, cached last-good shown if available.
- Qloo down → labeled "taste engine unreachable," no fabricated picks.

**Flow 4a — Three canonical seed journeys (the pre-computed, demo-safe set).**
The landing `/` and the demo rest on three canonical journeys, each precomputed once against the REAL Qloo API and cached to `data/seed-journeys.json` (earned state, PRD §7.5). Each is a complete, recomputable example the operator can fall back to if the live key is briefly unavailable.
1. **Sister / Succession.** Sentence: "My sister is obsessed with Succession, Aesop, and A24." Seeds resolve to a tv_show entity + two brand entities. Gift domain default `urn:entity:brand`. Expected hero pick: a design-forward digital gift card whose receipt names A24 and Aesop as top contributors.
2. **Dad / jazz + woodworking.** Sentence: "My dad loves Thelonious Monk and woodworking." Seeds resolve to an artist entity + a hobby tag (woodworking via `/v2/tags`). Mixed entity+tag signal, exercising the tag path in the happy flow. Expected picks span book/brand gifts (a craft-supply e-gift, a jazz-adjacent book card).
3. **Coworker / climbing + specialty coffee.** Sentence: "My coworker is into climbing and specialty coffee." Seeds resolve to two interest/brand signals. Expected picks lean place/brand (a specialty-coffee e-gift, an outdoor-brand card), demonstrating cross-domain reach beyond the sister journey.
Each journey's real Qloo response, resolved entity IDs, and call count are captured so every claim about them is recomputable (`scripts/seed-demo.ts`, `scripts/verify-claims.ts`).

**Flow 4b — Per-screen UI state contract (the three states every surface has).**
Every data-bearing surface renders exactly one of three states off the `GiftResponse`, so the UI is a pure function of the response and never improvises:
1. **Loading.** A skeleton grid + a "reading the taste graph" line while `/api/gift` or `/api/swap` is in flight; the prior grid stays visible under the skeleton during a swap so the recompute feels continuous, not a flash-to-empty.
2. **Resolved.** `degraded === null` and `picks.length > 0`: the ranked cards, affinity bars or rank bands, the coverage line, the seed chips, and the per-card split receipt. The primary CTA "Get this gift" is enabled.
3. **Degraded.** `degraded` is a token, or a card has `gift === null`: the matching labeled state from §6.1, never a card grid presented as Qloo-powered when it is not. The seed chips stay interactive so the giver can recover by swapping.
The component tree reads `data.degraded` first; only on `null` does it map `data.picks` to cards (`src/app/app/page.tsx`). This single branch is what makes every edge path above renderable without special-case UI code.

The following sub-flows (Flow 5 through Flow 10) specify each edge path step by step, with the exact UI state the giver sees and the typed state token the backend returns. Every token below is defined in `ARCHITECTURE.md` Section 3 (`TOKENS`) and is the ONLY thing the UI renders on that path. No path ever renders a fabricated ranking, a fabricated score, or a fake success; a degraded response always carries a `degraded` token (or a card-level `gift: null` → `NO_GIFT_MATCH`) and the UI reads that token to pick a labeled state. This is the enforcement surface for INVARIANTS NN-1, NN-3, NN-4, and NN-5.

**Flow 5 — Quota 429 fired mid-swap (the live-recompute hero under load).**
*Scenario:* The judge rapidly removes and re-adds seed chips during the hero moment, firing several `/api/swap` calls in quick succession, and the Qloo per-second limit (`x-second-ratelimit-limit: 5`) is breached on the burst.
1. Giver removes "A24" and immediately adds "Phoebe Bridgers," then removes "Aesop" within the same second.
2. The UI debounces each chip change by 350ms (`src/app/app/page.tsx` `swap()`), so the terminal seed set — not every intermediate set — is what actually dispatches. Intermediate dispatches are cancelled by `clearTimeout`.
3. The dispatched `/api/swap` call enters the Qloo client (`lib/qloo/client.ts`). The LRU cache (`lib/infra/cache.ts`) is checked first on the NORMALIZED signal set; if the judge swaps back to a set seen earlier in the session, the call returns from cache and never touches Qloo quota at all.
4. On a true cache miss, the call enters the 2-in-flight `Semaphore` (`lib/infra/semaphore.ts`). At most two Qloo requests are ever in flight; a third waits in the semaphore queue rather than firing in parallel. This is the primary 429 defense (research-brief §Community Pain #2: "at most two Qloo requests in flight, enforced by a small semaphore").
5. If Qloo still returns HTTP 429 despite the semaphore, `qlooGet()` FIRST attempts a stale-cache serve: it calls `cacheGetStale` for that exact call key (a second, non-expiring last-good map, capped) and, if a value is present, returns the STALE real picks transparently (labeled stale) rather than throwing. Only when there is no stale value for the key does it throw `QLOO_UNREACHABLE: 429 quota`, which the orchestrator (`lib/orchestrate.ts` `rankFromSignals`) catches and returns `{ ...base, degraded: "QLOO_UNREACHABLE" }`.
6. UI state: if a stale value was served, the grid shows those last-good real picks labeled "cached live Qloo response"; if nothing was cached, the current card grid stays frozen in its last-good rendered state (it is NOT cleared), and a non-blocking inline banner appears above the grid: "Taste engine is busy for a moment. Showing the last live result; try the swap again in a second." The swap chips stay interactive in both cases.
7. Typed state token: **`QLOO_UNREACHABLE`** (only when no stale value existed). No fabricated recompute is ever shown. The stale-cache serve is still genuine Qloo output (never a fabrication), just not fresh; it is always labeled so it is never passed off as a live call.

**Flow 6 — Qloo partial coverage (some tastes resolve, some miss).**
*Scenario:* The giver names three tastes; two resolve to Qloo entities, one is a real thing Qloo has never heard of or that `/search` returns nothing for.
1. Giver types: "My dad loves Thelonious Monk, woodworking, and the Ko-fi creator MapleShopTV."
2. Extractor (`lib/llm/extract.ts`) emits three candidate tastes: `{Thelonious Monk (artist), woodworking (unknown), MapleShopTV (unknown)}`.
3. Resolver (`lib/qloo/resolve.ts`) resolves "Thelonious Monk" to an artist entity via `/search`; resolves "woodworking" via `/v2/tags` fallback to a hobby/interest tag URN; finds nothing for "MapleShopTV" in either `/search` or `/v2/tags`.
4. Coverage report is assembled honestly: `{ resolved: 2, total: 3, misses: ["MapleShopTV"] }`.
5. Ranking proceeds on the two resolved signals — the pipeline is NOT blocked by one miss. `rankGifts()` runs with `signal.interests.entities=<monk-id>` and `signal.interests.tags=<woodworking-urn>`.
6. UI state: the card grid renders normally from the two live signals, and a small honest coverage line appears above the grid: "2 of 3 tastes resolved to Qloo. MapleShopTV was not found in Qloo's taste graph, so it did not shape these picks." The unresolved taste is shown struck through in the seed-chip row, with a one-tap "remove" to clean it.
7. Typed state token: none at the response level (`degraded: null`), because Qloo DID return affinity-bearing results from the resolved subset. Coverage honesty is carried in the `Coverage` object, not a degrade token. This path proves the product never silently pads a miss into a fake resolution.

**Flow 7 — LLM extraction failure fallback (the pipeline still reaches Qloo).**
*Scenario:* The Claude API is slow, rate-limited, returns malformed JSON, or times out during extraction. The product must still reach Qloo, because Qloo — not the LLM — is on the critical path (INVARIANTS NN-1).
1. Giver types: "my sister loves Succession, Aesop, and A24."
2. Extractor calls Claude; the call throws (network, 429, or an unparseable body).
3. The `catch` block in `extractTastes()` runs the deterministic fallback: a naive noun-phrase splitter that splits the sentence on commas, " and ", and " & " and trims each fragment. It yields `[{name:"my sister loves Succession"},{name:"Aesop"},{name:"A24"}]` with `domainGuess: "unknown"` for each.
4. The Resolver still runs. "Aesop" and "A24" resolve cleanly via `/search`. The noisy first fragment "my sister loves Succession" is passed through `stripPII`, and because the deterministic fallback also strips RECIPIENT NAMES (not just emails) — dropping fragments that lead with "my ", "her ", "his ", "their ", "for my", and bare capitalized person-name tokens — that whole fragment is DROPPED as a recipient descriptor (it becomes a `PII_BLOCKED` → Coverage miss, never an outbound signal). So NN-2 holds even when the LLM extractor is down; "Succession" itself only reaches Qloo if it arrives as its own clean fragment. No fabrication either way.
5. The ranking proceeds on whatever resolved. Qloo stays the ranker; the LLM's absence degrades extraction QUALITY (noisier candidate names), never the critical path.
6. UI state: the grid renders normally. No error banner is shown to the giver, because the product recovered. Internally the response notes the fallback for `/proof` and logs, but the giver sees a working result built on real Qloo output.
7. Typed state token: none at the response level unless Qloo itself then returns nothing (in which case Flow 8 applies). The LLM failure is absorbed, never surfaced as a hard error, because the LLM is a non-load-bearing convenience here.

**Flow 8 — Ambiguous taste resolving to multiple entities (disambiguation).**
*Scenario:* A taste name maps to several plausible Qloo entities (e.g. "Dune" = the 1965 novel, the 2021 film, the 1984 film; "Joy" = many entities).
1. Giver types: "my brother loves Dune and synthwave."
2. Extractor emits `{Dune (unknown — could be book or movie), synthwave (unknown)}`.
3. Resolver calls `/search?query=Dune`. Qloo returns multiple results. The Resolver takes the FIRST result (`resp.results?.[0]`) as the resolved signal — this is the documented, deterministic resolution rule (`lib/qloo/resolve.ts`), and it records the resolved entity's human label ("Dune (2021 film)") so the receipt and the seed chip show EXACTLY which entity Qloo is using.
4. "synthwave" resolves via `/v2/tags` to a music-genre tag URN.
5. The seed chip for the ambiguous taste is labeled with the resolved entity's real name and type, so the giver can SEE which "Dune" was used and can swap it if it is the wrong one (the swap is itself the hero mechanic — disambiguation is a one-tap correction, not a dead end).
6. UI state: the grid renders normally. The ambiguous seed chip reads "Dune · 2021 film" with a small type badge; a tooltip or helper line states "Qloo matched this to the 2021 film. Not the one you meant? Swap it." No modal picker is forced on the giver — the swap mechanic IS the disambiguation affordance.
7. Typed state token: none at the response level; the resolution is real and labeled. The honesty bar is met by SHOWING the resolved entity, never by silently guessing and hiding it.

**Flow 9 — A taste that only resolves as a tag, not an entity (tag-signal ranking).**
*Scenario:* A freeform taste ("lo-fi hip hop," "cottagecore," "minimalist design") has no single Qloo ENTITY but is a real Qloo TAG.
1. Giver types: "my roommate is really into cottagecore and lo-fi beats."
2. Extractor emits `{cottagecore (unknown), lo-fi beats (unknown)}`.
3. Resolver calls `/search` for each and gets no usable entity ID, then falls back to `/v2/tags`. "cottagecore" resolves to an aesthetic/tag URN; "lo-fi beats" resolves to `urn:tag:genre:music:lo_fi_hip_hop` (a documented tag family, research-brief §Satellite primitives).
4. Both signals are tags, so `rankGifts()` sends them as `signal.interests.tags=<urn>,<urn>` with NO `signal.interests.entities` param at all (the `if (entities.length)` guard omits the entity param cleanly — omitting an empty param is correct, and the Validator allow-list still passes because every sent param is on-list).
5. Qloo ranks giftable entities by shared-audience affinity to those tags. This is still genuine cross-domain Qloo work — tag-seeded cross-domain ranking is a first-class insights mode.
6. UI state: the grid renders normally. The seed chips show a "tag" badge rather than an "entity" badge, and the coverage line reads "2 of 2 tastes resolved to Qloo taste tags." The provenance receipt's "Qloo says" block names the tag contributors from `feature.explainability` exactly as it would for entity contributors.
7. Typed state token: **`RANK_BAND_ONLY`** applies at the CARD level when Qloo returns rank-order without a clean per-entity affinity score for tag-seeded results (field teams report this is more common for tag signals). The card renders a rank band ("high rank band," "#2 of brands for this audience") and NEVER a fabricated percentage. The receipt is fully honest about band-vs-score.

**Flow 9a — Explainability absent for a pick (the receipt still holds).** A related edge: Qloo ranks a pick but returns NO per-recommendation contributors in `feature.explainability` (field teams report this, especially for tag-only seeds). The receipt does NOT break and does NOT fabricate a driver. It still renders the rank statement ("Qloo ranked this #2 of brands for this audience") and the "we chose" half; the "top contributors" line shows a single labeled sentinel — "contributors not returned for this pick" — instead of an empty list or an invented "driven by X." Typed state token: **`EXPLAINABILITY_ABSENT`** at the card level. This keeps the provenance honest under the real field uncertainty: a missing contributor list is stated plainly, never papered over.

**Flow 10 — Option-B sandbox failure falling back to Option-A (action resilience).**
*Scenario:* Option-B (Tremendous sandbox) was wired because keys confirmed day-one, but at action time the sandbox returns a non-2xx (sandbox down, funding source invalid, key expired).
1. Giver clicks "Get this gift" on a card. The client calls `/api/action` with `{ sku, mode: "sandbox" }` (because Option-B was enabled for this deployment).
2. `issueSandboxGift()` (`lib/action/tremendous.ts`) POSTs to the sandbox `/orders`. The sandbox returns HTTP 500 (or any non-ok), so the function throws `ACTION_UNAVAILABLE: sandbox HTTP 500`.
3. The `/api/action` route handler catches the throw. Rather than surfacing a dead end, the client retries the SAME sku in `mode: "handoff"` — Option-A is the guaranteed baseline and is always available because every catalog entry carries a real `buyUrl` (INVARIANTS NN-4, D-2).
4. `handoff(sku)` returns `{ mode: "handoff", buyUrl }` — a real, reachable external digital-gift URL.
5. UI state: the button's label and behavior fall back cleanly. If the sandbox issue was attempted and failed, a small line reads "Sandbox gift issue was unavailable just now. Opening the real buy link instead." The buy link opens in a new tab. The giver ALWAYS has a real completion path.
6. Typed state token at the sandbox attempt: **`ACTION_UNAVAILABLE`** (caught internally, not shown as a terminal error). The resolved outcome is the Option-A hand-off, which is a real action, never a mocked "Order placed" toast.
7. If BOTH Option-B fails AND a catalog entry somehow lacks a `buyUrl` (should never happen; the catalog is validated at load), `handoff()` throws `ACTION_UNAVAILABLE` and the UI shows the terminal labeled state: "This gift's purchase link is unavailable. Try another card." No fake success is ever shown.

**Flow 11 — Developer-safety path: a bad param never reaches Qloo (`INVALID_PARAM`).**
*Scenario:* a code change (or a future gift-domain feature) accidentally adds a param not on the allow-list, or a malformed `filter.type`. This is a developer-facing guard, not a user input path, but it is the structural backstop for the silent-ignore footgun (INVARIANTS NN-5).
1. `rankGifts()` assembles the params and calls `assertInsightsParams()` BEFORE any network call.
2. If any key is off the `ALLOWED_INSIGHTS_PARAMS` list, or `filter.type` is missing or not a known URN, the assert throws `INVALID_PARAM: <key>`.
3. The throw happens in-process; no request is ever sent to Qloo with a param that would be silently dropped. The orchestrator surfaces it as a `QLOO_UNREACHABLE`-class degrade to the UI (a labeled state), and the error is logged with the offending key for the developer.
4. Typed state token: **`INVALID_PARAM`** at the Validator; it is caught in CI by `validate.test.ts` (a deliberately off-list param must throw). This path exists so a regression that would make the demo look Qloo-powered while dropping a param fails LOUD at test time, not silently on stage.

---

## Section 4: Technical Specifications

### 4.1 Extractor (`llm/extract`)
- **Purpose:** turn a free sentence into candidate taste names + a guessed domain each. Extraction ONLY — it never ranks or scores gifts.
- **Interface:** `extractTastes(sentence: string): Promise<CandidateTaste[]>`.
- **Data:** `CandidateTaste = { name: string; domainGuess: QlooEntityType | "unknown"; raw: string }`.
- **Dependencies:** Claude API. On LLM failure → naive noun-phrase splitter fallback (so the pipeline still reaches Qloo).

### 4.2 Resolver (`qloo/resolve`)
- **Purpose:** names → Qloo entity IDs (`/search`) and, for unresolved freeform tastes, tag URNs (`/v2/tags`). Produces an honest coverage report.
- **Interface:** `resolveSignals(cands: CandidateTaste[]): Promise<{ signals: QlooSignal[]; coverage: Coverage }>`.
- **Data:** `QlooSignal = { kind: "entity"|"tag"; value: string; label: string; source: "search"|"tags" }`; `Coverage = { resolved: number; total: number; misses: string[] }`.

### 4.3 Ranker (`qloo/insights`) — CORE, load-bearing
- **Purpose:** the gift ranking. Cross-domain `/v2/insights` with `feature.explainability=true`. This is the irreplaceable Qloo work.
- **Interface:** `rankGifts(signals: QlooSignal[], domain: QlooEntityType, opts?: RankOpts): Promise<RankedResult>`.
- **Query model (deep integration):** `filter.type` = giftable output domain; `signal.interests.entities` + `signal.interests.tags` from resolved signals (per-signal weights); `filter.popularity.min` to avoid obscure picks; `filter.price_level` for place gifts; `bias.content_based` tuned; `diversify.by=subtype` so picks aren't all the same kind; `feature.explainability=true`; `take=12`.
- **Data:** `RankedResult = { picks: QlooPick[]; raw: unknown }`; `QlooPick = { entityId; name; type; affinity?: number; rankBand: "high"|"medium"|"low"; explain: ExplainContribution[] }`.
- **Perf:** must complete inside the semaphore budget; cached by normalized signal set.

### 4.4 Gift Resolver (`gift/resolve`) — disclosed entity→SKU layer
- **Purpose:** map a Qloo-chosen entity to a buyable digital gift. Explicit and disclosed — Qloo stays visibly the chooser of WHAT the gift is about; this layer only finds a buyable *form* of it.
- **Interface:** `resolveGift(pick: QlooPick): GiftMatch | null`.
- **Data:** catalog of 500+ digital-gift entries (`{ sku; title; provider; domainTags; entityHints; buyUrl }`); match by entity hint → tag overlap → labeled semantic fallback.
- **Disclosure:** every card states whether the gift is an exact-entity match or a semantic match to the Qloo pick.

### 4.5 Provenance builder (`qloo/provenance`)
- **Purpose:** assemble the split "Qloo says / we chose" structure from the RAW Qloo output. Rank-band / documented contribution scores only — never a fabricated per-entity %.
- **Interface:** `buildProvenance(pick: QlooPick, coverage: Coverage): Provenance`.
- **Data:** `Provenance = { qlooSays: { rankStatement: string; topContributors: string[]; affinityBand: string; raw: unknown }; weChose: { reason: string; matchType: "exact"|"semantic" } }`.

### 4.6 Narrator (`llm/narrate`)
- **Purpose:** turn the provenance structure into human receipt copy. Narration ONLY — it is handed Qloo's real rank/contribution data and may not invent numbers or reorder picks.
- **Interface:** `narrate(prov: Provenance): Promise<string>`. On LLM failure → deterministic template string from the same data.

### 4.7 Qloo client (`qloo/client`)
- **Purpose:** single HTTP gateway. `X-Api-Key` header (backend-only env), GET query params, base `https://hackathon.api.qloo.com`. Wraps every call in: Validator → Cache → Semaphore(2). Asserts non-empty affinity-bearing results before returning.

### 4.8 Per-field spec: the `/v2/insights` query (CORE call)

This table specifies EVERY parameter the Ranker sends on the load-bearing `/v2/insights` call (`lib/qloo/insights.ts`), its exact value, why we send it, and what breaks if it is omitted. Every param name here is on the Validator allow-list in `ARCHITECTURE.md` Section 5 (`ALLOWED_INSIGHTS_PARAMS`); we send NO param that is not on that list, because Qloo silently ignores unknown params (research-brief §Error model) and a dropped param would make the demo look Qloo-powered while quietly not being. Values are the forge-chosen defaults; the UI may vary `filter.type` across gift domains and may re-tune `filter.popularity.min` per domain.

| Param | Value we send | Why we send it | What breaks if omitted |
|---|---|---|---|
| `filter.type` | a `GIFT_DOMAINS` URN, default `urn:entity:brand` | REQUIRED. Names the ONE output domain Qloo ranks giftable entities in. The whole cross-domain move is "seed one kind, rank a giftable kind." | The call is rejected by our own Validator (`filter.type required`) before it ever leaves the process. Qloo itself cannot run an insights query without it. There is no ranking, no gift. |
| `signal.interests.entities` | comma-joined resolved entity IDs, e.g. `<aesop-id>,<a24-id>` | The seed tastes, as Qloo entity IDs. These are the aggregate-behavioral anchors Qloo correlates FROM. This is the irreplaceable input: real entity IDs, not an LLM's paraphrase. | Omitted ONLY when zero tastes resolved to entities (then tags carry the seed). If BOTH entities and tags are empty there is no seed, so `rankFromSignals` short-circuits to `NO_QLOO_RESULT` and never calls Qloo. Sending a query with no signal would return a generic popularity list — which would fail the kill-test. |
| `signal.interests.tags` | comma-joined resolved tag URNs, e.g. `urn:tag:genre:music:lo_fi_hip_hop` | Tag-based seeds for freeform tastes that resolve as tags not entities (Flow 9). Lets a taste like "cottagecore" still drive genuine cross-domain ranking. | Omitted when no taste resolved to a tag. If omitted while it was the only seed source, same short-circuit as above. Tag-only journeys would be impossible without it — a real coverage loss for freeform tastes. |
| `filter.popularity.min` | `0.3` | Floors the output at a minimum audience-popularity so picks are giftable real things, not obscure long-tail entities nobody can buy or recognize. | Qloo may return extremely obscure entities that have no buyable gift form, inflating `NO_GIFT_MATCH` cards and making the grid feel broken. The ranking stays "correct" but the product value collapses. |
| `bias.content_based` | `0.35` | Nudges the blend slightly toward content-similarity rather than pure collaborative affinity, so picks stay legibly RELATED to the seed (a judge can see WHY), without overriding Qloo's audience correlation (which must remain the driver — the hero is shared-audience over-indexing). | Picks drift toward pure popularity/collaborative signal and can feel disconnected from the stated taste, weakening the "grounded but surprising" demo beat. Too high a value would drift toward LLM-style content guessing — so 0.35 is deliberately low. |
| `diversify.by` | `subtype` | Spreads the returned picks across subtypes so the grid is not twelve near-duplicates of the same thing. This is a visible deep-integration touch (research-brief §Insights query model: diversify). | The grid can return a dozen variations of one brand/category — visually monotonous and a weaker demo, and it hides the breadth of Qloo's cross-domain reach. |
| `feature.explainability` | `true` | THE provenance gold (research-brief §Explainability). Returns, per recommended entity, the input-entity contribution scores (0–1) and the aggregate top contributors. This is the raw material for the entire "Qloo says" half of the receipt. | The split "Qloo says / we chose" receipt loses its evidence. The receipt could only say "Qloo ranked this #2" with NO "driven by A24 and Aesop" — gutting the single highest-scoring judging dimension (provenance & user clarity, 9.0). Without it we cannot show WHY, only THAT. |
| `take` | `12` | Page size. Twelve picks fill a gift grid with enough variety to make the swap-recompute visibly mutate, while staying well under Qloo's `take` max (50) and keeping one call cheap against the 10k/mo quota. | Defaults to Qloo's 20, which is more cards than the grid needs and a larger payload per call. Omission is not fatal but wastes quota and clutters the grid. |

**Params we deliberately do NOT send** (on the allow-list, held in reserve, documented so the omission is a choice not an oversight): `signal.demographics.age`/`gender` (would edge toward individual profiling — held back for SAFE_USE caution), `filter.popularity.max` (no upper ceiling needed; we want recognizable gifts), `filter.price_level` (only meaningful for `urn:entity:place` gifts; sent only when the gift domain is place), `bias.trends` (trends primitive unverified on the tenant, research-brief §Capability Map — not depended on), `diversify.take`, `page` (single-page results are enough for the grid). Not sending a param is as deliberate as sending one; the allow-list documents the full surface either way.

### 4.9 Deep Qloo Integration Rationale — the 4 load-bearing surfaces and the kill-test

The hackathon's entire thesis is the kill-test: *if the project would work the same without Qloo, it is the wrong project* (research-brief §Overview). GiftProof uses four Qloo surfaces, each doing WORK a generic LLM cannot reproduce. "Deep integration = 4/4 surfaces load-borne" means all four are on the critical path, not decorative. Below, per surface: the work it does, and the kill-test — the concrete reason an LLM alone cannot stand in for it.

**Surface 1 — `/v2/insights` cross-domain ranking (CORE).**
*Work it does:* takes seed signals of one kind (a show, a brand, a studio, a music tag) and returns a ranked list of entities of a DIFFERENT, giftable kind, scored by SHARED-AUDIENCE AFFINITY drawn from Qloo's aggregate behavioral graph (research-brief §Tech Deep Dive). This is the bridge across a taste gap: it answers "what do people who love Succession and A24 actually over-index on, in the world of brands?" — a question about a real population's correlated behavior.
*Kill-test (why an LLM cannot reproduce it):* a generic LLM can only GUESS a plausible association from its training text ("A24 fans might like Diptyque"). It has no access to the aggregate behavioral correlation that says this audience MEASURABLY over-indexes on that entity, and it cannot attach a defensible rank or contribution to the claim. Remove Qloo and `picks[]` is empty (INVARIANTS NN-1, structurally enforced) — the product has nothing, because the LLM is forbidden from writing the ranking. The ranking is the product.

**Surface 2 — `feature.explainability` (CORE, rides on Surface 1).**
*Work it does:* returns, per recommended entity, which seed entities DROVE that pick and with what contribution — the per-recommendation input-entity contribution scores (research-brief §Explainability). This is what fills the "Qloo says" half of the receipt ("ranked #2, driven by A24 and Aesop").
*Kill-test:* an LLM can fabricate a plausible-sounding reason ("because A24 fans love design"), but it cannot cite which seeds Qloo actually weighted, because it did not do the ranking. The explainability block ties the receipt to Qloo's REAL internal attribution — the exact decisive judging line, "Qloo results as evidence in a clear product flow rather than an isolated API response" (research-brief §Judging Criteria). An LLM-authored reason would be interpretation masquerading as evidence, which is precisely what the rubric penalizes.

**Surface 3 — `/search` entity resolution (supporting, plumbing).**
*Work it does:* turns a human taste name ("Aesop," "A24," "Succession") into the canonical Qloo entity ID that the insights call requires as a signal (research-brief §Satellite primitives). It also disambiguates (Flow 8) by returning Qloo's ranked matches so the product can SHOW which entity was used.
*Kill-test:* an LLM can guess an entity exists but cannot produce Qloo's internal entity ID, which is the only key that unlocks Surface 1's aggregate correlation. No valid ID means no valid signal means Qloo silently returns junk (the silent-ignore footgun). The resolution is what makes the seed REAL rather than a string.

**Surface 4 — `/v2/tags` tag resolution (supporting, coverage).**
*Work it does:* resolves freeform tastes that are not single entities ("cottagecore," "lo-fi beats," "minimalist") into Qloo tag URNs that can seed insights as `signal.interests.tags` (Flow 9, research-brief §Satellite primitives). It is the fallback that keeps coverage honest and broad.
*Kill-test:* an LLM can name a vibe but cannot map it to Qloo's actual tag taxonomy (there is no master taxonomy — tags are discovered by query), and without a real tag URN the taste cannot seed Qloo's correlation. Tag resolution is what lets a vibe-word do real cross-domain work instead of being dropped.

**Signals / filters / bias / diversify we use, and the real product value each adds:**

| Qloo lever | Param(s) | Product value it adds |
|---|---|---|
| Entity signals | `signal.interests.entities` | Grounds the ranking in the recipient's REAL named tastes as aggregate-behavioral anchors — the core of "this is her taste, not mine." |
| Tag signals | `signal.interests.tags` | Extends coverage to freeform vibes, so a taste like "cottagecore" still produces a grounded gift rather than a shrug. |
| Explainability feature | `feature.explainability` | Turns every card into evidence — the "driven by X and Y" line that is the highest-scoring judging dimension and the live-mutating hero. |
| Popularity floor | `filter.popularity.min` | Keeps picks buyable and recognizable, so the entity→gift resolver actually finds a real SKU and the grid feels alive, not obscure. |
| Content bias | `bias.content_based` | Keeps picks legibly related to the seed so a judge can SEE the connection, while leaving audience affinity as the driver (not LLM-style guessing). |
| Diversify | `diversify.by=subtype` | Spreads the grid across kinds so the breadth of Qloo's cross-domain reach is visible and the swap visibly reshuffles variety. |
| Rank bands | derived from `rankPosition` when affinity score absent | Lets the UX tell the truth when Qloo exposes rank-order not a clean score — honest provenance under the real field uncertainty (research-brief §Affinity). |

### 4.10 Worked example: one CORE call traced end to end

This traces the hero sentence through the pipeline with the exact params and the shape of each hop, so a developer with zero context can see precisely what GiftProof sends and reads. Values marked with angle brackets are resolved at runtime; the response shape is the tolerated shape from `ARCHITECTURE.md` Section 7, not a fabricated Qloo payload (field names there are marked UNVERIFIED and probed at wire).

1. **Input.** `POST /api/gift { "sentence": "My sister is obsessed with Succession, Aesop skincare, and A24 films." }`
2. **Extract (LLM, extract-only).** Claude returns candidate tastes:
   `[{name:"Succession", domainGuess:"urn:entity:tv_show"}, {name:"Aesop", domainGuess:"urn:entity:brand"}, {name:"A24", domainGuess:"urn:entity:brand"}]`. The recipient reference "my sister" is dropped by the extractor's instruction (NN-2). On any LLM failure, the noun-phrase splitter yields the same three names with `domainGuess:"unknown"`.
3. **Resolve (Qloo `/search`).** Three GET calls (serialized through the semaphore, cached): `/search?query=Succession`, `/search?query=Aesop`, `/search?query=A24`. Each returns `results[0].entity_id`; the Resolver records the entity ID and the human label. Coverage: `{ resolved: 3, total: 3, misses: [] }`.
4. **Rank (Qloo `/v2/insights`, CORE).** One GET with the §4.8 param set:
   `GET /v2/insights?filter.type=urn:entity:brand&signal.interests.entities=<succession-id>,<aesop-id>,<a24-id>&filter.popularity.min=0.3&bias.content_based=0.35&diversify.by=subtype&feature.explainability=true&take=12`
   The Validator asserts every key is on the allow-list and `filter.type` is a known URN BEFORE the call. The non-empty assert runs AFTER.
5. **Response (tolerated shape).** `results.entities[]`, each `{ entity_id, name, type, affinity?|score?, explainability?[] }`. For pick #2, `explainability` lists the seed contributors (e.g. A24 and Aesop with contribution scores) — this is the provenance gold.
6. **Gift-resolve (entity→SKU).** Each pick's `name` is matched: exact hint → tag/domain semantic → domain-only last resort. A null match yields a `NO_GIFT_MATCH` card; others carry a real `buyUrl` and a disclosed `matchType`.
7. **Provenance.** `buildProvenance` assembles `qlooSays.rankStatement` ("Qloo ranked this #2 of gift categories for this audience"), `topContributors` (the top-3 explainability labels), and `affinityBand` (a real `affinity N.NN (band)` when present, else "medium rank band"). No percentage is synthesized.
8. **Narrate (LLM, narrate-only).** The narrator rewrites the FACTS into one warm sentence, forbidden from adding numbers or reordering. On failure, a deterministic template from the same facts.
9. **Render.** Twelve `GiftCard`s with affinity bars or rank bands, the split receipt, and the removable seed chips that drive `/api/swap`.

This single journey costs at most 3 `/search` + 1 `/v2/insights` = 4 Qloo calls (fewer with cache hits), comfortably inside the 5 req/s and 10k/mo envelope. The call count is captured to `submission/proof.md` so the frugality claim is recomputable (INVARIANTS §VERIFY-BEFORE-CLAIMING).

### 4.11 LLM boundary spec (the kill-test, structurally enforced)

The LLM touches exactly two edges and nothing else. This boundary is the structural guarantee behind INVARIANTS NN-1 ("Qloo ranks, always") and is what lets GiftProof answer the judge's kill-test question cleanly.

**What the LLM MAY do:**
- **Extract** (`lib/llm/extract.ts`): turn a free sentence into candidate taste NAMES + a guessed domain each. Output is a list of strings; it cannot be a ranking because it has no access to the gift catalog or the Qloo response.
- **Narrate** (`lib/llm/narrate.ts`): rewrite an already-built `Provenance` object into one warm sentence. It is handed Qloo's real rank/contribution FACTS and is instructed to add no numbers and reorder nothing.

**What the LLM MAY NOT do (and cannot, by signature):**
- It cannot produce or reorder `picks[]`. `rankGifts()` takes `(signals, domain, opts)` — there is no LLM in its signature, and `picks[]` is typed as the direct projection of `RankedResult.picks` (Qloo-sourced). No narrator string has a write path to pick order.
- It cannot choose the gift. The entity→SKU resolver is deterministic catalog logic (`lib/gift/resolve.ts`); the LLM never sees the catalog.
- It cannot invent a number. The narrator's system prompt forbids numbers not in the facts, and the provenance object it receives already contains only real fields; even a non-compliant narration cannot inject a figure into the structured `qlooSays` block the receipt renders from.

**Failure isolation:** an LLM failure at extract falls back to a deterministic splitter (the pipeline still reaches Qloo); an LLM failure at narrate falls back to a deterministic template from the same facts. In both cases Qloo stays on the critical path and the output stays honest. This is why removing the Qloo call empties `picks` while removing the LLM only degrades wording — the asymmetry IS the kill-test passing.

**Judge-attack walkthrough:** asked "would this work the same with just an LLM?", the operator flips the Qloo feature flag off and shows `picks` going empty (A2). Asked "where does this reason come from?", the operator expands `/proof` and points at the real explainability block the narrator was handed. Neither attack has a fabrication to find, because there is none.

---

## Section 5: API Contracts

### 5.1 External: Qloo Taste AI (`https://hackathon.api.qloo.com`)
- **Auth:** header `X-Api-Key: <key>` (NOT Bearer). Backend-only. Hackathon keys work ONLY on the hackathon tenant.
- **Transport:** GET, query-string params (even for insights).
- **Rate limit (field-observed):** `x-second-ratelimit-limit: 5`, `x-month-ratelimit-limit: 10000`. Parallel bursts 429.
- **Error model footgun:** invalid/unknown params SILENTLY ignored — no 4xx. Must validate every param and assert non-empty affinity-bearing results.

| Endpoint | Method | Key params | Returns | Used by |
|---|---|---|---|---|
| `/v2/insights` | GET | `filter.type` (required), `signal.interests.entities`, `signal.interests.tags`, `filter.popularity.min`, `bias.content_based`, `diversify.by`, `feature.explainability=true`, `take` | ranked entities + affinity + explainability contributions | Ranker (CORE) |
| `/search` | GET | `query`, `types` | entity ID + tags (schema undocumented — probe at wire) | Resolver |
| `/v2/tags` | GET | `filter.query` / family | tag URNs | Resolver |

### 5.2 External: Claude API (Anthropic)
- **Auth:** `x-api-key` env (backend-only). Model: `claude-sonnet` for extract + narrate (cheap, fast). Used ONLY for extraction + narration — NEVER ranking.

### 5.3 External: Tremendous sandbox (Option-B only, optional)
- **Auth:** Bearer sandbox key (backend-only). `/orders` POST to issue a sandbox e-gift. Only wired if self-serve sandbox keys confirm day-one; otherwise Option-A buy-link hand-off is the baseline.

### 5.4 Internal API

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/gift` | POST | `{ sentence: string }` | `{ picks: GiftCard[]; provenance: Provenance[]; coverage: Coverage; seeds: Seed[]; raw: unknown }` |
| `/api/swap` | POST | `{ seeds: Seed[]; domain?: string }` | same shape as `/api/gift` (recomputed) |
| `/api/action` | POST | `{ sku: string; mode: "handoff"\|"sandbox" }` | `{ mode; buyUrl?: string; orderId?: string; confirmation?: unknown }` |
| `/api/health` | GET | — | `{ ok: true; sha: string; qlooReachable: boolean }` |

---

## Section 6: Demo Script

> No demo video is required — the LIVE app IS the demo (judges click it). This script is the in-app **guided journey** + the on-air narration. Target: a judge reaches the "oh" inside 60 seconds. No em dashes in voiceover, active voice.

**Scene 1 — Land (0:00–0:15).** Screen: `/` with the value line "Gift someone whose taste you don't share" and a pre-seeded sample card grid already visible. Voice: "GiftProof reads a person's public taste and finds a gift you would never have guessed. Watch."

**Scene 2 — One sentence (0:15–0:40).** Screen: type "My sister loves Succession, Aesop, and A24." Submit. Cards resolve with affinity bars. Voice: "One sentence. Qloo's cross-domain graph ranks real giftable things by what fans of her taste actually over-index on. This is not my taste. It's hers."

**Scene 3 — The receipt (0:40–1:05).** Screen: expand a card's split "Qloo says / we chose" receipt. Voice: "Qloo says: this brand ranked second for her audience, driven by A24 and Aesop. We chose it because it's a digital gift card, deliverable with no address. Qloo picks what the gift is about. We find a way to buy it."

**Scene 4 — The hero: swap a seed (1:05–1:40).** Screen: remove "A24," add "Phoebe Bridgers." The ranking and the receipt recompute live in place. Voice: "Change what she likes, and the evidence moves with it. This is Qloo's result as live evidence inside the flow, not a static card."

**Scene 5 — Complete (1:40–2:05).** Screen: click "Get this gift." The default demo path performs a REAL action: Option-A opens a real, reachable digital-gift purchase rail in a new tab (a live checkout the judge can actually complete), and GiftProof records the real hand-off. If Option-B confirmed day-one, the same click instead issues a REAL Tremendous sandbox e-gift and shows the provider's real order/confirmation ID. In BOTH modes the completion is real and verifiable. There is NO mocked "Order placed" toast on any path (INVARIANTS NN-4). Voice: "And it ends in a real gift, not a suggestion. This opens a live gift checkout you can finish right now."

**Scene 6 — Honesty (2:05–2:25).** Screen: the `/proof` + limitations line. Voice: "Qloo gives aggregate taste correlation, not certainty. We show the raw response and what it does not prove."

### DEMO OBLIGATION satisfaction (traceability to the Thesis)
The Thesis DEMO OBLIGATION (WINNER-BRIEF `## Thesis`, field 3) requires the judge to WITNESS three things in the live demo. This script delivers all three, and the HERO FLOW (field 4) is the primary `/app` flow verbatim — not a side path:
- **Part (a) — a grounded-but-surprising cross-domain gift pick.** Witnessed in Scene 2: Qloo `/v2/insights` cross-domain ranks a giftable domain by the recipient's shared-audience affinity, producing a pick the giver would never have guessed (not a cliché). The pick is Qloo's, not the LLM's (INVARIANTS NN-1).
- **Part (b) — the split provenance receipt recomputes LIVE on seed-swap.** Witnessed in Scene 4: removing/adding a seed fires `/api/swap`, and the ranking + the "Qloo says / we chose" receipt recompute in place. This is a real re-call of the Qloo ranker, not a static re-render.
- **Part (c) — a REAL completed e-gift/reservation, never a mocked toast.** Witnessed in Scene 5. "Real" is satisfied by EITHER rail: Option-A is a real external purchase hand-off (a live, reachable checkout the judge can complete) and Option-B is a real sandbox-charged issue with a real provider confirmation ID. The DEMO OBLIGATION's "sandbox-charged" phrasing names the Option-B *example* of a real transaction; the binding requirement is "REAL, never a mocked confirmation" (INVARIANTS NN-4), which Option-A also satisfies because it performs and records a real external action rather than faking success. The guaranteed baseline is therefore real and on-stage-safe; the sandbox charge is an additive upgrade, never a fabrication.

The primary `/app` flow (Section 3, Flow 1 → Flow 2 → Flow 3) IS the HERO FLOW: `one sentence → ranked cross-domain gift cards with affinity bars → split "Qloo says / we chose" receipt → swap a seed, watch it recompute → buy → real confirmation`. No demo-only code path exists (USER-ONBOARDING.md): the demo hits the same `/api/gift`, `/api/swap`, `/api/action` endpoints a real giver hits.

### 6.2 On-air failure-recovery playbook

The live app is the demo, so the operator needs a rehearsed, calm recovery for each thing that can go wrong in the window. No em dashes in any spoken line; active voice. Each row pairs the on-stage symptom with the one-sentence recovery line and the move.

| Symptom on stage | Recovery line (spoken) | Move |
|---|---|---|
| Swap feels slow or the grid freezes briefly | "The taste engine is catching up for a second, here it comes." | Wait for the debounce plus semaphore to clear; the frozen grid is last-good, not an error. |
| A "busy a moment" banner appears (soft 429) | "We cap how fast we hit Qloo on purpose, so it stays honest, one more tap." | Re-tap the swap; the cache or a freed semaphore slot serves it. |
| A taste resolves to nothing (coverage gap) | "Qloo has not seen that one, so it did not shape the picks, watch the ones it did." | Point at the honest coverage line; it proves the product never fakes a resolution. |
| "Taste engine unreachable" labeled state | "We never fabricate picks, so when Qloo is down we say so, and here is the cached live run." | Fall to the seeded real-Qloo journey labeled "cached live Qloo response." |
| A card shows no buyable gift | "Qloo chose the thing, we could not find a digital gift for it yet, and we say that plainly." | Move to a card that did match; honesty is the point. |
| Option-B sandbox hiccups at buy | "The sandbox blinked, so we open the real buy link instead, still a real action." | The action falls back to Option-A automatically (Flow 10). |

The operator rule is simple: narrate the honest state out loud, because every labeled fallback is itself evidence for the "provenance and user clarity" dimension. A fabricated recovery would lose more points than the glitch it hides.

### 6.3 In-app guided-journey copy (the coach marks that reach the "oh" in 60s)

Because no video is required and the live app IS the demo, the app itself must walk a cold judge to the hero without an operator. These are the exact on-screen coach marks, timed to the 10/30/60-second judge tests (PRD §7.5). No em dashes, active voice.

| Trigger | On-screen copy | Purpose |
|---|---|---|
| Landing, before any input | "Gift someone whose taste you don't share. Type one sentence about them." | The 10-second value line; a sample grid is already visible beneath it. |
| First sample card in view | "Qloo ranked these by what fans of this person's taste actually over-index on. Not your taste. Theirs." | Names the irreplaceable Qloo work up front. |
| Hovering a card's receipt toggle | "Open the receipt to see what Qloo said and what we chose." | Points at the 30-second provenance surface. |
| Receipt expanded | "Qloo says: ranked here for this audience, driven by these tastes. We chose a digital gift, deliverable with no address." | Makes the split receipt legible without the operator. |
| Seed chips first render | "These are the tastes we read. Remove one, add another, and watch the gifts and the evidence move." | Invites the 60-second hero recompute. |
| After a swap completes | "The evidence moved with the taste. That is Qloo as live evidence, not a static card." | Lands the hero's meaning. |
| CTA in view | "Get this gift opens a real digital gift. It ends in an action, not a suggestion." | Names the completed-action payoff. |

These marks are dismissible and never block interaction; a judge who ignores them still sees the sample grid, the receipt, and the swap. The copy is the written-rubric safety net: even read silently, it narrates provenance and the kill-test, so the app scores the "evidence in a flow" line on its own.

**YouTube title (if a walkthrough is posted, ≤100 chars, no special chars):** "GiftProof: a Qloo taste agent that gifts across a taste gap you dont share"

### 6.1 The 30 hostile-input rehearsal set (required by R5)

Risk R5 is an on-air weird-input faceplant or a 429 on swap-spam. The defense is not hope; it is a rehearsed set of 30 concrete hostile or weird recipient sentences, each with its expected graceful labeled outcome and the typed state token or UI state it must produce. Before demo, every one of these is run against the live deployed URL; any input that produces a raw error, a blank "Qloo-powered" grid, a fabricated ranking, a fabricated percentage, or an uncaught exception is a BLOCKER. "Graceful" means: the giver sees a clear labeled state, and the backend returns a defined token (or a normal result built on real Qloo output). Tokens referenced: `NO_QLOO_RESULT`, `NO_AFFINITY_RESULTS`, `QLOO_UNREACHABLE`, `PII_BLOCKED`, `RANK_BAND_ONLY`, `EXPLAINABILITY_ABSENT`, `NO_GIFT_MATCH`, `ACTION_UNAVAILABLE`, `INVALID_PARAM`.

| # | Hostile / weird input | Expected graceful outcome | Token / UI state |
|---|---|---|---|
| 1 | `` (empty string) | Route-level `zod` rejects `sentence.min(2)`; UI shows "Type one sentence about the person, naming a show, artist, brand, or place." | 400 INVALID_INPUT (route) → empty-input UI |
| 2 | `a` (one character) | Same `zod` min(2) rejection; same prompt to name a taste. | 400 INVALID_INPUT (route) |
| 3 | `cat` (one real word, not a taste) | Extractor finds no public taste or emits one candidate that resolves to nothing; Resolver misses; orchestrator returns no signals. UI: "I couldn't find a public taste to work from — try naming a show, artist, brand, or place." | `NO_QLOO_RESULT` |
| 4 | `asdfjklqwpz` (gibberish) | Extractor yields a junk candidate; `/search` and `/v2/tags` both miss; zero signals. Same labeled empty-taste state. | `NO_QLOO_RESULT` |
| 5 | `😀😀🎉🔥` (emoji only) | Extractor yields nothing usable; splitter fallback yields emoji fragments that resolve to nothing. Labeled empty-taste state. | `NO_QLOO_RESULT` |
| 6 | A 400-word rant with 2 real tastes buried in it | Route `zod` caps `sentence.max(500)` — over-length is rejected at the route with a "keep it to one sentence" prompt; if trimmed under 500, Extractor pulls the 2 real tastes and ranks normally. | 400 INVALID_INPUT if >500 chars; else normal result |
| 7 | `my sister Jane Doe, jane@email.com, 12 Main St, loves Succession` | `stripPII` drops the email AND the recipient-name/descriptor fragments ("my sister Jane Doe...", bare "Jane Doe") — the deterministic fallback strips recipient names, not just emails, so NN-2 holds even with the LLM down; only "Succession" forwards to Qloo. Receipt notes personal details were not sent. | `PII_BLOCKED` on the stripped fields; normal result on "Succession" |
| 8 | `she loves jazz but hates jazz and only country not country` (contradictory) | Extractor emits both "jazz" and "country"; both resolve as tags; Qloo ranks on both signals (contradiction is just two seeds). Normal grid; the swap lets the giver drop one. | normal result (two tag signals) |
| 9 | `à minha irmã adora Rosalía e cinema de autor` (non-English) | Extractor handles the language and pulls "Rosalía" (artist) and an auteur-cinema tag; resolves and ranks. If a name misses, honest coverage. | normal result or partial `Coverage` |
| 10 | `loves the band Fontaines D.C. and obscure Faroese knitting podcasts` (extremely niche) | "Fontaines D.C." likely resolves as an artist; the ultra-niche podcast likely misses both `/search` and `/v2/tags`. Partial coverage, ranked on what resolved. | normal result with `misses` in Coverage |
| 11 | `loves ZyntharaxBrandThatDoesNotExist` (invented brand) | `/search` returns nothing; `/v2/tags` returns nothing; zero signals. Labeled empty-taste state, never a fabricated match. | `NO_QLOO_RESULT` |
| 12 | `'; DROP TABLE gifts; --` (SQL-injection-looking) | Treated as a plain string; there is no SQL anywhere (stateless, no DB). `zod` passes it as text; Extractor finds no taste; Resolver misses. Labeled empty-taste state. No injection surface exists. | `NO_QLOO_RESULT` |
| 13 | `<script>alert(1)</script> loves Dune` (XSS-looking) | React escapes all rendered text by default; the tag is inert. Extractor pulls "Dune"; resolves and ranks. No script executes. | normal result on "Dune" |
| 14 | `Zendaya` (a celebrity name only, no taste verb) | "Zendaya" resolves as a `urn:entity:person`; person-as-SEED (public figure taste anchor) is allowed — this is a public entity, not recipient PII. Qloo ranks giftable things by that audience. | normal result (person entity signal) |
| 15 | `my dad` (recipient reference, no taste) | Extractor is instructed NOT to treat "my dad" as a taste; emits nothing. Labeled: name a show, artist, brand, or place. | `NO_QLOO_RESULT` |
| 16 | `everything and nothing` (vacuous) | No concrete taste resolves; zero signals. Labeled empty-taste state. | `NO_QLOO_RESULT` |
| 17 | `AAAAAAAA...` (500 identical chars, at the cap) | Passes `zod` length but Extractor finds no taste; Resolver misses. Labeled empty-taste state; no crash on a long single token. | `NO_QLOO_RESULT` |
| 18 | `Succession, Succession, Succession` (same taste repeated) | Extractor dedupes or Resolver resolves to one entity; the normalized cache key collapses duplicates (`cacheKey` sorts + lowercases). One signal, normal grid. | normal result (deduped) |
| 19 | `loves 日本のアニメ and 村上春樹` (CJK script) | Extractor pulls the anime tag and "Haruki Murakami" (author); resolves via tags/search; ranks. If a token misses, honest coverage. | normal result or partial `Coverage` |
| 20 | `loves a@b.com and c@d.com` (emails only) | Both stripped by `stripPII`; nothing forwards to Qloo; zero signals. Labeled: personal contacts removed, name a public taste instead. | `PII_BLOCKED` → `NO_QLOO_RESULT` |
| 21 | `loves 💅 vibes and ✨aesthetic✨` (emoji + vibe words) | Emoji dropped; "aesthetic" may resolve as a tag; if it does, tag-seeded rank (likely rank-band). If not, empty-taste state. | `RANK_BAND_ONLY` (if tag resolves) or `NO_QLOO_RESULT` |
| 22 | `likes stuff and things and whatever` (filler only) | No concrete taste; zero signals. Labeled empty-taste state. | `NO_QLOO_RESULT` |
| 23 | `loves Taylor Swift` repeated as rapid swap-spam (10 swaps in 2s) | Debounce collapses to the terminal seed; semaphore caps 2-in-flight; cache serves repeats. If Qloo still 429s, frozen last-good grid + "busy a moment" banner. | `QLOO_UNREACHABLE` only on a true hard 429; else normal/cached |
| 24 | `loves Marvel movies` → resolves but no catalog SKU for the pick | Qloo ranks normally; the entity→SKU resolver finds no exact and no semantic match for one pick. That CARD shows `gift: null` labeled "No buyable digital gift found for this Qloo pick yet"; other cards render. | `NO_GIFT_MATCH` (card-level) |
| 25 | `loves a very expensive private island` (price-level edge) | Resolves to a destination/place; if the gift domain is place and `filter.price_level` would exclude it, the pick simply ranks within the floor; no crash. Digital-rail reframes to an experience/reservation e-gift or `NO_GIFT_MATCH` if none. | normal result or `NO_GIFT_MATCH` |
| 26 | `loves %%%&&&===` (symbol soup) | `URLSearchParams` encodes safely; Extractor finds no taste; Resolver misses. No malformed URL, no crash. Labeled empty-taste state. | `NO_QLOO_RESULT` |
| 27 | `filter.type=urn:entity:fake` style input trying to inject a param | User text never becomes a Qloo param name; params are set only by `rankGifts()`. Even if a taste name looked like a param, the Validator allow-list would reject any off-list key. Treated as plain taste text (resolves to nothing). | `NO_QLOO_RESULT` (and `INVALID_PARAM` is unreachable from user text by design) |
| 28 | `loves jazz` while Qloo is fully down (simulated outage) | `/search`/`/v2/tags`/insights all throw; orchestrator returns the unreachable token; grid shows "Taste engine unreachable right now. We never fabricate picks — try again shortly." | `QLOO_UNREACHABLE` |
| 29 | `loves lo-fi hip hop` (tag that returns rank-order, no clean score) | Resolves as a tag; Qloo returns rank-order without a per-entity affinity number. Cards render rank bands and "#2 of gift categories for this audience," never a fabricated %. | `RANK_BAND_ONLY` (card-level) |
| 30 | `loves Succession` then clicks "Get this gift" while Option-B sandbox is down | Action falls back from sandbox to the Option-A buy-link (Flow 10). The giver gets a real reachable buy URL; if even that is missing, a labeled terminal state. | `ACTION_UNAVAILABLE` (internal) → Option-A hand-off, or terminal labeled state |

**Rehearsal pass/fail rule:** all 30 must produce their expected labeled outcome on the live URL with zero uncaught errors, zero fabricated rankings, and zero fabricated percentages. This run is part of the Day-2 PM harden step (§8) and is a precondition for packaging. If any input faceplants, it is fixed before submit — not demoed around.

---

## Section 7: Risk Register

| # | Risk | Category | Severity | Likelihood | Impact | Mitigation | Decision Tree |
|---|---|---|:--:|:--:|---|---|---|
| R1 | "Completed real purchase" ⨯ no-PII contradiction (physical gift needs shipping address) | Scope/Data | CRITICAL | Low | DQ-class copy contradiction | Digital e-gift/reservation rail ONLY; no shipping; reconcile ALL copy | PLAN DT-1 |
| R2 | Entity→SKU gap: Qloo returns entities not buyable products | Technical | HIGH | High | buy button looks fake / Qloo looks decorative | Explicit disclosed resolver, real 500+ catalog, labeled semantic fallback; Qloo stays chooser | PLAN DT-2 |
| R3 | Fabricated over-index number (Qloo gives rank-order, not clean per-entity score) | Judging/Data | HIGH | Medium | provenance honesty collapses | Rank-band wording; every number traces to a real field; show raw response | PLAN DT-3 |
| R4 | Free-tier host cold-start / sleep in the on-air window = effective DQ | Demo/Infra | HIGH | Low (Oracle VM never sleeps) | judge hits a dead URL | Oracle Always-Free VM (no spin-to-zero) + keep-warm + 6h idle-then-hit test | PLAN DT-4 |
| R5 | On-air weird-input faceplant / 429 on swap-spam | Demo | MED | Medium | live error on stage | 2-in-flight semaphore + cache + debounce + validate-every-param + assert-non-empty; 30 hostile-input rehearsal | PLAN DT-5 |
| R6 | Qloo silent-ignore: demo looks Qloo-powered while params are being dropped | Technical | HIGH | Medium | kill-test secretly fails | Validator rejects unknown params + asserts affinity-bearing non-empty results before render | PLAN DT-6 |
| R7 | Live Qloo key not in hand at build start (Dami requesting) | Time/Integration | MED | Medium | build blocks on real calls | Architecture lets wire drop key into VM env; fixture-replay dev mode until key lands; key is the ONLY gate on real calls | PLAN DT-7 |
| R8 | `/search` + `/v2/tags` response schemas undocumented | Technical | MED | Medium | resolver mis-parses | Probe live key at wire; defensive parse + tag fallback; resolver degrades to tag-only | PLAN DT-8 |
| R9 | Option-B (Tremendous sandbox) keys don't confirm day-one | Scope | LOW | Medium | no real-charge upgrade | Option-A buy-link hand-off is the GUARANTEED baseline; Option-B is additive only | PLAN DT-9 |
| R10 | Scope creep: checkout becomes the headline (drift) | Scope | MED | Low | becomes a gift-card picker, loses the wedge | Lock feature set at forge; commerce LIGHT; hero = taste-bridging + live recompute | PLAN DT-10 |

### 7.1 Risk register — detailed analysis per risk

Each risk below is expanded into its failure scenario (what actually goes wrong), its trigger (the concrete condition that sets it off), and its mitigation mechanism (how the build structurally prevents or absorbs it). The table above is the index; this is the reasoning.

**R1 — "Completed real purchase" contradicts "no PII" (CRITICAL).**
*Failure scenario:* the product claims a completed gift purchase, but a physical gift requires a shipping address, and a shipping address is PII. If any submission copy, UI, or action flow implies physical shipping, the project simultaneously violates the no-PII invariant and invites a direct judge attack ("you said no PII but you need my sister's address"). This is DQ-class because it is a self-contradiction the judges can read off the submission.
*Trigger:* any gift framed as a physical object, any form field asking for a recipient address, any copy that says "we'll ship it," or an action rail (like a physical-merch provider) that structurally needs an address.
*Mitigation mechanism:* the completion rail is digital-ONLY by construction — e-gift cards, digital reservations, experience vouchers delivered by link or email-to-giver. No code path collects a shipping field; the action layer (`lib/action/*`) returns a `buyUrl` or a sandbox order ID, never an address form. All submission copy is reconciled to "digital gift, deliverable with no address" in the Day-2 PM harden step. The warroom adjudicated this CRITICAL risk as MITIGABLE precisely because the digital rail removes the shipping requirement entirely (WINNER-BRIEF §Top Risks #1, INVARIANTS NN-2/NN-4).

**R2 — Entity→SKU gap: Qloo returns entities, not buyable products (HIGH).**
*Failure scenario:* Qloo ranks entities (a brand, a show, a place), but a judge clicks "Get this gift" and there is no actual buyable product behind it. Either the buy button looks fake, or a hidden hardcoded lookup silently substitutes a gift, making Qloo look decorative — which fails the kill-test (the ranking stops mattering).
*Trigger:* a Qloo pick with no corresponding catalog entry, or a resolver so thin it only ever returns a handful of pre-baked gifts regardless of the pick.
*Mitigation mechanism:* an EXPLICIT, disclosed entity→SKU resolver (`lib/gift/resolve.ts`) backed by a real 500+ entry digital-gift catalog, with three ordered strategies — exact entity-hint match, tag/domain semantic overlap, then domain-only last resort — and every card DISCLOSES whether it is an exact or semantic match (`matchType`). Qloo stays visibly the chooser of WHAT the gift is about; the resolver only finds a buyable FORM. When nothing matches, the card shows `NO_GIFT_MATCH` honestly rather than faking a product (D-5, F-007).

**R3 — Fabricated over-index number (HIGH).**
*Failure scenario:* the receipt shows a clean per-entity percentage ("87% match") that Qloo never returned, because field teams report Qloo exposes rank-order, not always a clean per-entity score (research-brief §Affinity). A judge expands the receipt, asks "where does 87% come from?", and the provenance honesty — the project's highest-scoring dimension — collapses on contact.
*Trigger:* any UI element or narration that synthesizes a numeric score when the raw Qloo field is absent, or a narrator that invents a figure.
*Mitigation mechanism:* the provenance builder (`lib/qloo/provenance.ts`) derives every string from a real field — `rankPosition`, `explain[].label`, and `affinity` ONLY when it is actually present. When affinity is null, the UI renders a rank BAND ("#2 of gift categories for this audience," "high rank band"), never a number. The narrator is explicitly instructed and structurally constrained to add no numbers not in the facts, and `/proof` shows the raw Qloo response so any figure is auditable. `RANK_BAND_ONLY` is the token for the score-absent path (INVARIANTS NN-3, D-3, F-003).

**R4 — Free-tier host cold-start / sleep in the on-air window (HIGH).**
*Failure scenario:* during the live on-air judging window, a judge hits the URL and gets a cold-start delay or a dead app because the host spun to zero on idle. A dead URL in the window is an effective DQ, and GiftProof's whole thesis is "the live app IS the demo."
*Trigger:* deploying on a free tier that sleeps (Vercel/Render free, ephemeral containers) and an idle gap before the judge visits.
*Mitigation mechanism:* host on the Oracle Always-Free VM, which does not spin to zero and has no function timeouts for the deep Qloo+LLM chain (D-1). A pm2 keep-warm cron pings `/api/health` on a heartbeat, and a 6-hour idle-then-hit durability test the day before proves the URL returns a warm 200 after a realistic idle gap. The credential is backend-only VM env so a cold judge needs nothing local (F-008).

**R5 — On-air weird-input faceplant / 429 on swap-spam (MED).**
*Failure scenario:* a judge types something weird or spams the swap chips, and the app throws a raw error on stage, or hits Qloo's 5 req/s limit and 429s mid-hero. Either is a live faceplant in front of the panel.
*Trigger:* hostile/edge input (the 30-input set, §6.1), or rapid seed-chip changes firing parallel Qloo calls past the per-second limit.
*Mitigation mechanism:* four layers — a 2-in-flight `Semaphore` so Qloo never sees a parallel burst, an LRU cache so repeated/returned-to seed sets never re-hit quota, a 350ms swap debounce so only the terminal seed set dispatches, and param-validation + non-empty assertion so a bad input yields a labeled token not a crash. The 30 hostile-input rehearsal (§6.1) is run on the live URL before demo; any faceplant is a packaging blocker (research-brief §Community Pain #2).

**R6 — Qloo silent-ignore: demo looks Qloo-powered while params are dropped (HIGH).**
*Failure scenario:* Qloo silently ignores invalid/unknown params (no 4xx), so a typo'd or off-list param is dropped and Qloo returns unfiltered or empty results — and the grid still renders, looking Qloo-powered while actually running on junk. The kill-test secretly fails and the team may not even notice.
*Trigger:* sending a param name Qloo does not recognize, a non-URN tag, or a malformed signal — anything Qloo will quietly drop.
*Mitigation mechanism:* the Validator (`lib/qloo/validate.ts`) rejects any param not on the `ALLOWED_INSIGHTS_PARAMS` allow-list BEFORE the call (`INVALID_PARAM`), and asserts the result is non-empty and affinity-bearing AFTER the call (`NO_AFFINITY_RESULTS`) before anything renders. These two asserts are the ONLY defense against silent-ignore, since Qloo gives no error of its own (research-brief §Error model, INVARIANTS NN-5, F-006).

**R7 — Live Qloo key not in hand at build start (MED).**
*Failure scenario:* the build needs real Qloo calls to prove the core, but the event-issued key is still pending (Dami requested it via the Devpost/API form), so the build blocks on real integration.
*Trigger:* the key email not arriving before Day-1 core work begins.
*Mitigation mechanism:* the architecture isolates the key to one env var read in one gateway (`lib/qloo/client.ts`), so a fixture-replay dev mode runs the entire pipeline against recorded responses until the key lands; the moment it does, wire drops it into the VM env and the SAME code path makes real calls. The key is the ONLY gate on real calls — no other code change is needed to go live (R7, SOURCE LOCK build-gate).

**R8 — `/search` + `/v2/tags` response schemas undocumented (MED).**
*Failure scenario:* the resolver mis-parses the `/search` or `/v2/tags` response because the field names are undocumented (research-brief §Satellite primitives), and resolution silently returns nothing, starving the ranker of signals.
*Trigger:* Qloo returning a response shape different from the assumed one (e.g. `id` vs `entity_id`, nested results).
*Mitigation mechanism:* defensive parsing that tolerates several field shapes (`entity_id ?? id`, `id ?? value`), a tag fallback when entity resolution misses, and a live probe of the real key at wire to confirm the actual field names before relying on them. The resolver degrades to tag-only rather than failing hard, and coverage is reported honestly so a parse miss surfaces as a visible coverage gap, not a silent zero (R8, `lib/qloo/resolve.ts` marked UNVERIFIED pending wire).

**R9 — Option-B (Tremendous sandbox) keys don't confirm day-one (LOW).**
*Failure scenario:* the optional real-charge upgrade (sandbox e-gift issue) cannot be wired because self-serve sandbox keys don't arrive in time, and the team scrambles for a real-charge story at the last minute.
*Trigger:* Tremendous sandbox onboarding not completing on Day 1.
*Mitigation mechanism:* Option-A (buy-link hand-off to a real digital-gift rail) is the GUARANTEED baseline and is a real, reachable action on its own (INVARIANTS NN-4). Option-B is purely additive; if its keys never confirm, nothing breaks and the demo still ends in a real action. If Option-B is wired but fails at action time, Flow 10 falls back to Option-A cleanly (D-2, R9).

**R10 — Scope creep: checkout becomes the headline (MED).**
*Failure scenario:* the team over-invests in the commerce/checkout layer and the product drifts into "a gift-card picker," losing the wedge — the taste-correlation-that-bridges-a-gap — that makes it un-clonable and kill-test-passing.
*Trigger:* spending build time polishing checkout flows, adding providers, or making the buy step the demo centerpiece instead of the taste bridge and the live recompute.
*Mitigation mechanism:* the feature set is locked at forge with commerce deliberately LIGHT (Option-A hand-off, one light closing beat), and three drift tripwires are named in the WINNER-BRIEF: checkout-as-headline, a shrunken resolver that makes Qloo decorative, and a static (non-recomputing) receipt. The hero is explicitly the taste-bridging + live recompute, and the demo script (§6) spends its weight there, not on checkout (R10, WINNER-BRIEF §Drift Tripwires).

---

## Section 7.4b → see `USER-ONBOARDING.md`
## Section 7.4c → see `ROUTE-ARCHITECTURE.md`

## Section 7.5: Judge Experience
- **First-visit state:** `/` renders a pre-seeded sample journey — a full ranked gift grid with affinity bars + one expanded split receipt — before the judge types anything. No empty state, no login wall.
- **Seed script requirements:** `scripts/seed-demo.ts` precomputes 3 canonical journeys (sister/Succession, dad/jazz+woodworking, coworker/climbing+specialty-coffee) by calling the REAL Qloo API once and caching the real responses to `data/seed-journeys.json`. This is EARNED state (real Qloo runs), not fabricated — permitted because the product's claim is provenance, and the seeded output is genuine Qloo output.
- **10-second test:** hero line "Gift someone whose taste you don't share" + visible ranked cards.
- **30-second test:** the split "Qloo says / we chose" receipt is visible/one click away.
- **60-second test:** the seed-swap chips invite the live-recompute hero; "Get this gift" CTA is the primary action.
- **Keys-off-host:** non-custody. The Qloo key is a backend-only server env var; a cold judge needs no local keys. (State `custodyProduct: false`.)
- **Demo-insurance invariant check:** the seeded journeys use REAL Qloo responses (earned, per TASTE U7) — no fabricated rankings, no mocked checkout. If the live key is unavailable at demo time, the seeded REAL responses render (labeled "cached live Qloo response"), the swap is disabled with a label, and nothing fabricated is ever shown.

## Section 7.6: Judge Proof Artifacts
- **Proof route:** `/proof` page + `submission/proof.md`.
- **Required artifacts:** a redacted request→result walkthrough (the exact `/v2/insights` query params → the ranked response, key redacted); the resolved entity IDs; Qloo API call count for a journey; the raw explainability block for one pick; coverage stats.
- **Proof generation:** `scripts/capture-proof.ts` runs one real journey and writes the redacted request/response pair + call count to `submission/proof.md`.
- **Limitations:** `LIMITATIONS.md` — what Qloo does and does NOT prove (aggregate correlation ≠ individual certainty).

---

## Section 8: Day-by-Day Build Plan

Deadline Oct 30 23:45 EDT; internal cutoff Oct 30 20:00 WAT. ~2 build days.

- **Day 1 (Oct 29) — Core + deploy early.** Scaffold Next.js on the Oracle VM behind nginx (deploy hour-one). Build Qloo client (validator/cache/semaphore), Extractor, Resolver, Ranker (CORE), Provenance builder against fixtures. Wire the real key when it lands (R7). Primary objective: a real `/v2/insights` cross-domain call returns ranked picks on the deployed URL. Deliverable: `/api/gift` returns real Qloo-ranked picks + provenance.
- **Day 2 (Oct 30 AM) — Gift resolver + hero + action + polish.** Gift catalog (500+) + entity→SKU resolver; seed-swap live recompute (`/api/swap`); Option-A buy-link hand-off (Option-B only if sandbox keys confirmed); seed script + `/proof`; design pass (UI carries all demo weight). Deliverable: full hero flow on the live URL.
- **Day 2 (Oct 30 PM) — Harden + submit.** 30 hostile-input rehearsal; 6h idle-then-hit durability check; reconcile all submission copy to digital-only/no-PII; LICENSE visible in About; package. Cutoff 20:00 WAT.

Buffer: the 8+ hour margin between internal cutoff (20:00 WAT) and the real close.

---

## Section 9: Dependencies & Prerequisites
- **Qloo hackathon API key** (Dami, via Devpost/API form → emailed). Backend-only VM env. Gates real calls (R7). → `.input-manifest.json` tier `required`.
- **Claude API key** (Anthropic). Backend-only. → `required`.
- **Oracle Always-Free VM** — already provisioned, nginx+TLS configured, pm2, Node ≥ 22.19. → prerequisite (owned).
- **`@qloo/qloo-harness`** ≥ 0.1.26 (npm) OR direct REST — either path is server-side only.
- **Tremendous sandbox key** (Option-B, optional). → `optional`.
- **Digital-gift catalog source** — a named, concrete approach: the 500+ entries are curated from public e-gift / brand gift-card pages plus affiliate feeds, so every `buyUrl` is a REAL brand gift-card landing page (not a hand-faked URL). Assembled day-one, semi-automatically (scrape/curate the public gift-card pages + feeds, then hand-tag `domains`/`entityHints`/`tags`), and spot-checked for reachability (PLAN P2.1 buyUrl liveness sampling).

## Section 10: Concerns Compliance

| Concern | Severity | Addressed by |
|---|:--:|---|
| Hero flow runs end-to-end on deployed URL, zero errors | [C] | Flows 1-3; seed journeys; semaphore/cache/validator; 6h durability + 30-input rehearsal (§8) |
| Qloo `/v2/insights` live, authed, non-empty before render | [C] | §4.3, §4.7, §5.1; Validator asserts non-empty affinity-bearing (R6) |
| Kill-test: Qloo on critical path, LLM only extracts+narrates | [C] | §4.1/§4.6 LLM boundary; §4.3 Qloo always ranks; INVARIANTS NN-1 |
| Zero PII to Qloo; digital rail no shipping | [C] | §1, §4, §5; R1; INVARIANTS NN-2 |
| Provenance = real Qloo output, never fabricated % | [C] | §4.5; R3; INVARIANTS NN-3 |
| Durability for on-air window | [I] | Oracle VM (no sleep) + keep-warm + 6h test; R4 |
| Quota frugality | [I] | cache + semaphore(2) + debounce; R5 |
| Scope: commerce light | [I] | Option-A baseline; R10; drift tripwires |
| Polish | [A] | design phase owns; UI carries demo weight (§6) |

---

## Section 11: Qloo API Reference (as used)

> This section is the precise, as-used contract for every Qloo surface GiftProof touches. Facts are pulled from `ARCHITECTURE.md` Sections 5–8 and `research/research-brief.md` §Tech Deep Dive. It is deliberately narrow: it documents what WE send and WE expect, not Qloo's full API. Anything marked UNVERIFIED is confirmed by a live-key probe at wire before it is relied on.

### 11.1 Endpoints, base, and auth
- **Base URL:** `https://hackathon.api.qloo.com` (the hackathon tenant). Hackathon keys work ONLY on this tenant; dev keys fail against it and vice versa (research-brief §Access & transport).
- **Auth:** header `X-Api-Key: <key>` — NOT a Bearer token. The key is read once from `process.env.QLOO_API_KEY` in `lib/qloo/client.ts`, backend-only, never in a client bundle, repo, browser, or demo (INVARIANTS NN-6).
- **Transport:** every call is a GET with query-string params — even `/v2/insights`, which other APIs would make a POST. Params are assembled with `URLSearchParams`, which encodes values safely (so symbol-soup input cannot break the URL).
- **Endpoints used (3):**

| Endpoint | Method | Params we send | What we read back | Used by |
|---|---|---|---|---|
| `/v2/insights` | GET | the 8 params in §4.8 (`filter.type`, `signal.interests.entities`, `signal.interests.tags`, `filter.popularity.min`, `bias.content_based`, `diversify.by`, `feature.explainability`, `take`) | `results.entities[]` with `entity_id`, `name`, `type`, an affinity-ish field (see §11.4), and `explainability[]` contributions | Ranker (CORE), `lib/qloo/insights.ts` |
| `/search` | GET | `query=<taste name>` | `results[]` with `entity_id`/`id`, `name`, `types[]` (schema UNVERIFIED — defensive parse) | Resolver, `lib/qloo/resolve.ts` |
| `/v2/tags` | GET | `filter.query=<freeform taste>` | `tags[]` with `id`/`value`, `name` (schema UNVERIFIED — defensive parse) | Resolver, `lib/qloo/resolve.ts` |

- **Liveness:** `/api/health` issues a keyless `HEAD` to `/v2/insights` and treats `401` or `200` as "alive" (401 = alive and key-gated), so the health check never leaks the key. This keyless check proves the HOST is up but CANNOT detect a revoked / wrong-tenant / quota-exhausted key (a bad key returns the same `401` as a healthy gated endpoint). A SEPARATE authenticated reachability check — a tiny KEYED `/v2/insights` call with `take=1`, rate-limited to once per keep-warm interval — is what actually detects a bad key; it lives behind `/api/health?deep=1` (`qlooKeyReachable`) and the keep-warm cron runs this keyed check on its heartbeat and logs failures.

### 11.2 The 10 entity-type URNs (`filter.type` and search types)
These are the 10 confirmed insights output domains (research-brief §Entity types, `ARCHITECTURE.md` `QLOO_ENTITY_TYPES`):
`urn:entity:artist` · `urn:entity:book` · `urn:entity:brand` · `urn:entity:destination` · `urn:entity:movie` · `urn:entity:person` · `urn:entity:place` · `urn:entity:podcast` · `urn:entity:tv_show` · `urn:entity:video_game`.

GiftProof ranks gifts in a giftable SUBSET of these (`GIFT_DOMAINS`): `brand`, `place`, `book`, `movie`, `video_game`, `podcast`. We deliberately do NOT depend on `urn:heatmap` (geo), `urn:entity:audience` (deprecated), or the trends primitive — all unverified or deprecated on the tenant (research-brief §Capability Map, WINNER-BRIEF §Out-of-Scope).

### 11.3 The silent-ignore footgun and our defense
Qloo's error model has a specific, dangerous property: **invalid or unknown params are silently ignored — there is no 4xx** (research-brief §Error model). A typo'd param name, a non-URN tag, or a malformed signal does not error; Qloo simply drops it and returns unfiltered or empty results. The consequence is that a demo can LOOK Qloo-powered while actually running on dropped params and junk output, and the team may never notice.

Our defense is two assertions wrapped around every call in the gateway (`lib/qloo/validate.ts`):
1. **Pre-call allow-list (`assertInsightsParams`):** every param key we send is checked against `ALLOWED_INSIGHTS_PARAMS`; any off-list key throws `INVALID_PARAM` before the request leaves the process. `filter.type` is additionally asserted present and a known URN. This is the ONLY way to catch a dropped param, since Qloo will not tell us.
2. **Post-call non-empty assert (`assertAffinityBearing`):** the result must contain at least one entity; an empty result throws `NO_AFFINITY_RESULTS`, which the orchestrator turns into a labeled empty-state — never a blank "Qloo-powered" grid (INVARIANTS NN-5).

### 11.4 Rate-limit numbers and our response
Field-observed quota on the hackathon key (arrives with the key email, NOT in public docs — research-brief §Quota):
- `x-second-ratelimit-limit: 5` (5 requests per second)
- `x-month-ratelimit-limit: 10000` (10,000 requests per month)
- Parallel bursts 429 immediately.

Our three-part response keeps the demo inside this envelope:
1. **Semaphore(2)** (`lib/infra/semaphore.ts`) — at most two Qloo requests in flight at any moment, so a burst never fires in parallel (the documented fix from research-brief §Community Pain #2). A third request queues.
2. **LRU cache** (`lib/infra/cache.ts`, max 500, 30-min TTL) — keyed on the NORMALIZED signal set (sorted, lowercased), so swapping back to a prior seed set or re-running a journey serves from cache and spends zero quota.
3. **350ms swap debounce** (`src/app/app/page.tsx`) — rapid chip changes collapse to the single terminal seed set, so swap-spam dispatches one call, not ten.
On a hard 429 despite all three, `qlooGet()` first attempts a STALE-CACHE serve: it reads `cacheGetStale` (a second, non-expiring last-good map, capped) for the call key and returns the stale real picks labeled "cached live Qloo response" if present — a stale real result beats a blank grid, and it is still genuine Qloo output, never a fabrication. Only when no stale value exists does it throw `QLOO_UNREACHABLE`, and the UI shows a labeled "busy a moment" state over the frozen last-good grid. The LLM narrate edge is likewise concurrency-bounded (a 3-in-flight `llmSemaphore`), so the per-pick narration fan-out cannot burst the Anthropic rate limit.

### 11.5 Affinity-field uncertainty and our rank-band tolerance
The single most important data-honesty fact: **Qloo exposes rank-order, and not always a clean per-entity affinity score** (research-brief §Affinity; field teams redesigned UX around rank bands). The affinity field NAME inside each result entity is UNVERIFIED and may appear as `affinity`, `score`, or nested under `query.affinity` — or be absent entirely.

Our tolerance (`lib/qloo/insights.ts`):
- `readAffinity()` checks `affinity ?? score ?? query.affinity`; if none is a number, it returns `null`.
- When affinity is a real number, the UI may show it (`affinity 0.82 (high)`).
- When affinity is `null`, the UI renders a **rank band** derived from the 1-based `rankPosition` (top 3 = high, 4–8 = medium, else low) and the receipt says "#N of gift categories for this audience" — a `RANK_BAND_ONLY` state. We NEVER synthesize a percentage to fill the gap (INVARIANTS NN-3). The code is correct whether or not a clean score exists, so the product tells the truth under either Qloo behavior.

### 11.6 Per-endpoint walkthroughs (as-used)

Each walkthrough shows the exact request GiftProof issues, the response fields it reads, how it parses defensively, and what it does on a miss. Response field names on `/search` and `/v2/tags` are UNVERIFIED (undocumented schemas, research-brief §Satellite primitives) and confirmed by a live-key probe at wire; the parse tolerates alternatives.

**`/search` — name to entity ID.**
- *Request:* `GET /search?query=Aesop` with `X-Api-Key`.
- *Read:* `results[0].entity_id ?? results[0].id` as the ID; `results[0].name` as the label; `results[0].types` for a type hint.
- *Parse rule:* take the FIRST result as the deterministic match (Flow 8); record the real label so the seed chip and receipt show exactly which entity Qloo used.
- *Miss behavior:* if no `results` or no ID, return `null` — the Resolver then tries `/v2/tags`. A total miss becomes an honest `Coverage.misses` entry, never a silent zero.

**`/v2/tags` — freeform taste to tag URN.**
- *Request:* `GET /v2/tags?filter.query=cottagecore` with `X-Api-Key`.
- *Read:* `tags[0].id ?? tags[0].value` as the URN (e.g. `urn:tag:genre:music:lo_fi_hip_hop`); `tags[0].name` as the label.
- *Parse rule:* used only as the fallback after `/search` misses, so entity resolution stays preferred and Qloo stays the chooser even for vibes.
- *Miss behavior:* if no usable URN, the taste is recorded as a miss; the pipeline proceeds on whatever else resolved.

**`/v2/insights` — the CORE ranking.**
- *Request:* the full §4.8 param set as a GET query string (see §4.10 for the literal URL).
- *Read:* `results.entities[]`; per entity `entity_id`, `name`, `type`, an affinity-ish field via `readAffinity`, and `explainability[]` with `{ entity_id, name, score }` contributions.
- *Parse rule:* preserve Qloo's returned ORDER as `rankPosition` (1-based); derive a rank band when no numeric affinity exists; never reorder by any LLM or local heuristic (NN-1).
- *Miss behavior:* an empty `results.entities` throws `NO_AFFINITY_RESULTS` at the assert; the orchestrator returns the labeled degraded token, never a fabricated grid.

### 11.7 Quota-budget analysis (the 10k/mo and 5/s envelope)

A concrete accounting of how GiftProof stays inside Qloo's limits, so the frugality claim is not hand-waved:
- **Per hero journey (cold cache):** up to N `/search` calls (one per named taste, typically 2–4) + 1 `/v2/insights` = ~3–5 calls. Seeded demo journeys are precomputed once and cached to `data/seed-journeys.json`, so the landing page costs ZERO live calls.
- **Per swap (cold cache):** 1 `/v2/insights` (the seeds are already resolved; `runSwap` skips re-resolution). A swap back to a prior seed set costs ZERO (cache hit on the normalized key).
- **Per-second safety:** the Semaphore(2) guarantees at most 2 in flight, so even aggressive swap-spam cannot exceed the 5/s ceiling, because the third request queues rather than firing.
- **Monthly safety:** at ~4 calls per cold journey and heavy cache reuse across a demo session, a full day of judging and rehearsal is a few hundred calls at most, far under 10,000/mo. The month limit is effectively never the binding constraint; the per-second limit is, and the semaphore owns it.
- **Retry policy:** ZERO blind retries on a Qloo failure (ESCALATE-DON'T-FABRICATE). A 429 or error degrades to a labeled token; it does not spin the quota down with retries.

### 11.8 SAFE_USE / responsible-handling, as applied

The hackathon's responsible-data-handling dimension (20% weight) and its DQ gates (research-brief §Disqualifiers) require aggregate-only use, no PII, and no consequential individual decisions. How GiftProof satisfies each, concretely:
- **Aggregate-only.** Every Qloo call seeds with public taste entities or tags (shows, brands, artists, places, genres), never an identity. The output is a ranking of giftable entities by SHARED-AUDIENCE affinity — a statement about a population, not a person. The receipt wording ("fans of A24 and Aesop over-index on this") is deliberately audience-level, never "your sister will love this."
- **No PII to Qloo.** The extractor is instructed to drop recipient person-names; `stripPII` drops emails; the resolver forwards only resolved entity IDs and tag URNs. A full-journey log scan (A7) is the proof. No recipient name, email, address, device ID, or account ID is ever in an outbound Qloo query.
- **No consequential individual decisions.** GiftProof is a gift-selection aid, explicitly NOT housing, employment, credit, insurance, or health (the SAFE_USE DQ categories). It makes no individual profile and no claim about a specific person's attributes.
- **No silent fallback to another endpoint/credential.** A Qloo auth or rate-limit failure surfaces as a clear labeled token (`QLOO_UNREACHABLE`), never a quiet switch to a different endpoint or a cached-as-live substitution presented as fresh (research-brief §Disqualifiers). The cached seed journeys are LABELED "cached live Qloo response," never passed off as a live call.
- **Honest limitations.** `LIMITATIONS.md` and the `/proof` page state what Qloo does and does NOT prove: aggregate correlation is not individual certainty, and a high rank band is not a guarantee the recipient will love the gift (INVARIANTS §MUST NOT CLAIM).

---

## Section 12: Success Metrics & Acceptance

> Measurable acceptance criteria per feature, tied one-to-one to `FEATURE-OBSERVABLES.md` F-001..F-008. Each feature is ACCEPTED only when its observable passes on the live deployed URL (not just in unit tests), because the live app IS the demo. The `test_command` and `sentinel_fail` columns in FEATURE-OBSERVABLES are the exact gate; this section states the pass bar and the acceptance meaning for each.

### 12.1 Per-feature acceptance

**F-001 — Qloo cross-domain ranking IS the gift ranking (CORE).**
- *Acceptance:* `POST /api/gift {"sentence":"loves Succession, Aesop, A24"}` returns `picks[0].pick.entityId` as a non-null Qloo entity ID, and disabling the Qloo call (feature flag) makes `picks` EMPTY, never LLM-filled.
- *Pass bar:* at least one pick, every `entityId` traceable to the raw Qloo response in the same payload.
- *Sentinel fail (reject):* picks are non-empty while Qloo is mocked/off. That would mean the LLM is ranking — a kill-test failure (INVARIANTS NN-1). Verified by `stress_test.e2e_hero`.

**F-002 — Live seed-swap recompute (hero).**
- *Acceptance:* `POST /api/swap` with a changed seed returns a DIFFERENT `picks[0].pick.name` (or ordering/content) than the pre-swap result.
- *Pass bar:* a visible change in picks and provenance after a seed change, within the debounce + semaphore budget, rendered in place.
- *Sentinel fail:* identical output after a seed change (the hero does not actually recompute — drift toward a static card). Verified by `stress_test.e2e_swap`.

**F-003 — Provenance is real, no fabricated %.**
- *Acceptance:* `picks[0].provenance.qlooSays.rankStatement` matches `#\d+` (a real rank position) and NO invented `%` appears anywhere in any receipt.
- *Pass bar:* every number and band in the receipt traces to a field in the raw Qloo response; `/proof` shows that raw response alongside.
- *Sentinel fail:* a per-entity "%" appears with no matching raw field. Verified by `provenance.test` + `/proof` (INVARIANTS NN-3).

**F-004 — No PII to Qloo.**
- *Acceptance:* `stripPII('a@b.com')` returns `null`; a request/response log scan over a full journey shows no email or recipient-name string in any outbound Qloo URL.
- *Pass bar:* zero PII strings in any outbound Qloo query over a full hero journey; email input stripped before any Qloo call.
- *Sentinel fail:* an email or recipient-name string appears in an outbound Qloo query. Verified by `validate.test` + wire log scan (INVARIANTS NN-2).

**F-005 — Real completed action (not mocked).**
- *Acceptance:* `POST /api/action {"mode":"handoff"}` returns a reachable `buyUrl` (200/3xx); Option-B, if wired, returns a real provider order ID.
- *Pass bar:* the buy URL resolves to a real external digital-gift target; a sandbox order ID is echoed from the provider's real JSON.
- *Sentinel fail:* `buyUrl` absent, or an "Order placed" string with no real target (a mocked toast). Verified by `stress_test.action` (INVARIANTS NN-4).

**F-006 — Silent-ignore defended.**
- *Acceptance:* `npm test -- validate` is green (unknown param throws `INVALID_PARAM`; empty result throws `NO_AFFINITY_RESULTS`), and a no-result taste returns `.degraded == "NO_AFFINITY_RESULTS"`, not a blank grid.
- *Pass bar:* every param validated pre-call; every result asserted non-empty post-call; a no-result taste shows the labeled empty-state.
- *Sentinel fail:* a taste resolving to nothing renders cards anyway. Verified by `validate.test` + `orchestrate.test` (INVARIANTS NN-5).

**F-007 — Entity→SKU resolver keeps Qloo the chooser.**
- *Acceptance:* `picks[0].gift.matchType` is `exact` or `semantic`, and the matched gift is tied to Qloo's pick (never a giver-taste default).
- *Pass bar:* every card discloses its match type; a no-match card shows `NO_GIFT_MATCH` honestly rather than faking a product.
- *Sentinel fail:* a card whose gift ignores the Qloo pick. Verified by `gift-resolve.test` (D-5).

**F-008 — Durable host, backend-only key.**
- *Acceptance:* `curl -sI $URL/api/health` returns 200 after a 6-hour idle gap; `grep -r QLOO_API_KEY .next/static` is empty.
- *Pass bar:* warm 200 after realistic idle (no cold-start in the on-air window); no Qloo key anywhere in the client bundle or repo.
- *Sentinel fail:* a cold-start 502 after idle, or a key found in the bundle. Verified by `livetest` + grep gate (INVARIANTS NN-6).

### 12.2 Aggregate acceptance (submission-level)
GiftProof is submission-ready only when ALL of the following hold simultaneously on the live URL:
- All 8 feature observables (F-001..F-008) pass their `test_command` with none hitting its `sentinel_fail`.
- All 30 hostile inputs (§6.1) produce their expected labeled outcome with zero uncaught errors and zero fabricated rankings or percentages.
- The 6-hour idle-then-hit durability test (R4) returns a warm 200.
- A redacted request→result walkthrough is captured to `submission/proof.md` and every headline number in it is recomputable from a committed real Qloo response (INVARIANTS §VERIFY-BEFORE-CLAIMING).
- An open-source license is visible in the repo About section (DQ gate).
No single feature passing is sufficient; the acceptance is the conjunction, because a hackathon judge experiences the whole flow live, not an isolated unit test.

### 12.3 Acceptance test matrix (exact commands and expected values)

The precise checks run at acceptance, against the live URL (`$URL`) with the real key in the VM env. Each row is a copy-pasteable gate with its pass condition and the feature it accepts.

| # | Check | Command | Pass condition | Accepts |
|---|---|---|---|---|
| A1 | Core returns a Qloo entity | `curl -s $URL/api/gift -d '{"sentence":"loves Succession, Aesop, A24"}' \| jq '.picks[0].pick.entityId'` | non-null string (a Qloo entity ID) | F-001 |
| A2 | Kill-test: Qloo off empties picks | flip the Qloo feature flag off, re-run A1 | `.picks` is `[]`, never LLM-filled | F-001 |
| A3 | Swap recomputes | capture `.picks[0].pick.name`, swap a seed via `/api/swap`, re-capture | the two names differ (or ordering/content differs) | F-002 |
| A4 | Rank statement is real | `curl -s $URL/api/gift -d '{...}' \| jq -r '.picks[0].provenance.qlooSays.rankStatement'` | matches `#\d+`, contains no `%` | F-003 |
| A5 | No fabricated % anywhere | `curl -s $URL/api/gift -d '{...}' \| grep -c '%'` over the receipt fields | zero invented per-entity percentages | F-003 |
| A6 | PII stripped | `npm test -- validate` (asserts `stripPII('a@b.com') === null`) | green | F-004 |
| A7 | No PII in outbound Qloo | wire log scan over a full journey | no email/recipient-name in any Qloo URL | F-004 |
| A8 | Action returns a real URL | `curl -s $URL/api/action -d '{"sku":"<sku>","mode":"handoff"}' \| jq -r '.buyUrl'` | a reachable URL (follow returns 200/3xx) | F-005 |
| A9 | Unknown param throws | `npm test -- validate` (asserts off-list key throws `INVALID_PARAM`) | green | F-006 |
| A10 | Empty result is labeled | `curl -s $URL/api/gift -d '{"sentence":"ZyntharaxBrandThatDoesNotExist"}' \| jq -r '.degraded'` | `NO_QLOO_RESULT` or `NO_AFFINITY_RESULTS` | F-006 |
| A11 | Match type disclosed | `curl -s $URL/api/gift -d '{...}' \| jq -r '.picks[0].gift.matchType'` | `exact` or `semantic` | F-007 |
| A12 | Health warm after idle | `curl -sI $URL/api/health` after a 6h idle gap | `200`, no cold-start delay | F-008 |
| A13 | No key in bundle | `grep -r QLOO_API_KEY .next/static` | empty output | F-008 |
| A14 | Proof is recomputable | `node scripts/verify-claims.ts` | every headline number matches the committed Qloo response | VERIFY-BEFORE-CLAIMING |
| A15 | License visible | inspect repo About section | an OSS license is present | DQ gate |

Any A-row failing blocks submission. A2, A5, A7, and A10 are the honesty gates — they prove the product fails LOUD (labeled token) rather than faking output, which is the behavior the rubric and the SAFE_USE line reward.

### 12.4 Traceability matrix (invariant to feature to flow to risk)

So nothing load-bearing is orphaned, this maps each non-negotiable invariant to the feature that proves it, the user flow that exercises it, and the risk it retires.

| Invariant (INVARIANTS.md) | Feature | Flow(s) | Risk | Acceptance row |
|---|---|---|---|---|
| NN-1 Qloo ranks, always | F-001 | Flow 1, Flow 7 | R10 (drift), kill-test | A1, A2 |
| NN-2 Zero PII to Qloo | F-004 | Flow 7 (PII in sentence), Flow 5 of §6.1 (#7, #20) | R1 | A6, A7 |
| NN-3 Provenance real, never fabricated % | F-003 | Flow 1 (receipt), Flow 9 (rank-band) | R3 | A4, A5 |
| NN-4 Completed purchase is real | F-005 | Flow 3, Flow 10 | R2, R9 | A8 |
| NN-5 Silent-ignore defended | F-006 | Flow 6, Flow 8, §6.1 empty/junk rows | R5, R6 | A9, A10 |
| NN-6 Durable host, backend-only key | F-008 | all (served from the VM) | R4, R7 | A12, A13 |

Every invariant has at least one feature observable, one flow that exercises it, one risk it retires, and one acceptance command. There is no invariant that is merely asserted in prose with nothing proving it live — that absence is itself a gate failure (research-brief §Judging: "Qloo as evidence in a flow," not as a claim).

### 12.5 Definition of Done (per build phase)

- **Core done (Day 1):** A1 and A2 pass on the deployed URL against the REAL key; `/api/gift` returns real Qloo-ranked picks with a real explainability block; the seeded journey renders on `/`.
- **Hero done (Day 2 AM):** A3 passes; the swap visibly recomputes the grid and the receipt in place; the entity→SKU resolver (A11) discloses match types; Option-A action (A8) opens a real buy URL.
- **Harden done (Day 2 PM):** all 30 hostile inputs (§6.1) pass; the 6h durability test (A12) returns warm 200; the no-key-in-bundle grep (A13) is empty; `/proof` is captured and recomputable (A14); the license is visible (A15).
- **Submission done:** §12.2 aggregate acceptance holds in full; all submission copy is reconciled to digital-only, no-PII, rank-band-honest; the Devpost description leads with what is Qloo-powered (the 4/4 load-bearing surfaces).

### 12.6 PRD glossary (load-bearing terms as used here)

Terms this PRD leans on, defined as they are used in GiftProof. This is the product-level glossary; the build generates a fuller `DOMAIN-GUIDE.md` from `ARCHITECTURE.md` Section N+1.
- **Cross-domain affinity** — Qloo seeding signals of one kind (a show) and ranking entities of a DIFFERENT kind (a brand) by shared-audience behavior. The irreplaceable primitive; the thing an LLM cannot ground.
- **Shared-audience over-indexing** — the measurable fact that an audience gravitates to an entity more than a baseline population would; the content of the "driven by X" receipt line.
- **Seed / signal** — a resolved taste (entity ID or tag URN) fed to insights as `signal.interests.*`. Each seed is a removable chip; swapping seeds is the hero.
- **Rank band vs affinity score** — Qloo may return rank-order without a clean per-entity number. A rank band (high/medium/low from `rankPosition`) is the honest rendering when the score is absent; a fabricated percentage is forbidden.
- **Silent-ignore** — Qloo dropping an invalid param with no error. Defended by the pre-call allow-list and the post-call non-empty assert.
- **Entity vs tag** — an entity is a specific Qloo thing with an ID (`/search`); a tag is a taxonomy URN for a vibe (`/v2/tags`). Entities are preferred; tags are the coverage fallback.
- **Entity→SKU gap** — Qloo ranks entities, not buyable products; the disclosed gift resolver bridges the gap with a real catalog and a labeled semantic fallback, keeping Qloo the chooser.
- **Provenance receipt** — the split "Qloo says / we chose" structure built only from real Qloo output; the single highest-scoring surface against the rubric.
- **The kill-test** — would this work the same with just an LLM? If yes, it is the wrong project. GiftProof dies without Qloo (empty picks), so it passes.
- **Coverage** — the honest "N of M tastes resolved" report; a miss is shown, never padded into a fake resolution.
- **Digital rail** — the e-gift / reservation / voucher completion path that needs no shipping address, so there is no PII and no physical-shipping claim.
- **Degraded token** — a typed state (`NO_QLOO_RESULT`, `NO_AFFINITY_RESULTS`, `QLOO_UNREACHABLE`, `PII_BLOCKED`, `RANK_BAND_ONLY`, `EXPLAINABILITY_ABSENT`, `NO_GIFT_MATCH`, `ACTION_UNAVAILABLE`, `INVALID_PARAM`) returned on any non-happy path so the UI renders a labeled state, never a fabrication.
- **Earned state** — the seeded demo journeys built from REAL Qloo responses cached once; permitted because the product's claim is provenance and the output is genuine Qloo output, labeled as cached.

### 12.7 Out-of-scope restatement (anti-drift, referenced not modified)

To keep the acceptance honest, the following remain explicitly out of scope (WINNER-BRIEF §Explicit Out-of-Scope, referenced, not modified here): physical-goods purchase and shipping; any individual profiling or sending recipient names/emails to Qloo; multi-recipient or group gifting, registries, and B2B shapes; and dependence on `urn:heatmap`, trends, or audience-compare (unverified on the tenant). Any feature request that reaches into these is drift and is rejected at acceptance, not quietly built. The hero stays the taste-bridging cross-domain pick plus the live-recomputing provenance receipt; everything else is support.

### 12.8 Submission-field readiness checklist

Each expected Devpost field (research-brief §Submission Form Fields) mapped to the artifact that supplies it, so packaging is assembly, not authoring. The exact field list is verified in real logged-in Chrome before submit (Devpost 403s to fetchers).

| Submission field | Source artifact | Acceptance tie |
|---|---|---|
| Title / tagline | PRD §1 ("the gift agent that reads a stranger's taste") | — |
| Full description (lead Qloo-powered) | PRD §1 + §4.9 (the 4/4 load-bearing surfaces, leading) | A1, A2 |
| Which Qloo tools + rationale | §4.8, §4.9, §11; `submission/qloo-powered.md` | A1 |
| Redacted request→result walkthrough | `submission/proof.md` via `scripts/capture-proof.ts` | A14 |
| Built-with / stack | ARCHITECTURE §1 technology table | — |
| Try-it live URL (public) | the Oracle VM URL behind nginx+TLS | A12 |
| Public repo + from-scratch setup | the repo + README | A15, A13 |
| Open-source license (About) | LICENSE in repo About | A15 |
| Screenshots / optional walkthrough | demo phase (landing, hero-receipt, swap-recompute, action) | — |
| Limitations / what results don't prove | `LIMITATIONS.md` + §11.8 | A5, A7 |

A field with no ready source artifact is a packaging blocker. The description MUST lead with what is Qloo-powered (the single most-weighted submission instruction), so §4.9's four-surface story is the opening paragraph, not an appendix.

### 12.9 What this PRD does not decide

To keep the boundary clean: this PRD defines WHAT and WHY. It does not define the HOW (every code block, file path, and signature lives in `ARCHITECTURE.md`, the single source of truth), the WHEN/ORDER (the phase sequence lives in `PLAN.md` and the day-by-day in §8), or the non-negotiable LAW (the six invariants and resolved decisions live in `INVARIANTS.md`). Where this PRD cites a param, a token, a file, or a field, it is referencing those documents, never redefining them. If a conflict ever appears, `INVARIANTS.md` wins on law, `ARCHITECTURE.md` wins on code, and `warroom/WINNER-BRIEF.md` wins on thesis; this PRD yields to all three by design.

### 12.10 Cross-document reference index

For the reader navigating the doc suite, the load-bearing pointers in one place:
- **Thesis, drift tripwires, judging rationale:** `warroom/WINNER-BRIEF.md` (§Thesis, §Drift Tripwires, §Why It Won).
- **Non-negotiable law, resolved decisions, source lock:** `INVARIANTS.md` (NN-1..NN-6, D-1..D-7, SOURCE LOCK).
- **Every file, signature, and code block:** `ARCHITECTURE.md` (Sections 3–14, plus N+1..N+11 for config, testing, deploy, integration map).
- **Per-feature observables and test commands:** `FEATURE-OBSERVABLES.md` (F-001..F-008).
- **Qloo mechanics and field reality:** `research/research-brief.md` (§Tech Deep Dive, §Community Pain, §Capability Map).
This PRD is the WHAT/WHY spine that threads them together; read it with those four open.
