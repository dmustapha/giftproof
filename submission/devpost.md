# GiftProof — Devpost submission pack

Copy each block into the matching Devpost field. No em-dashes (per house style); Markdown is supported in "About the project".

---

## Project name (max 60 chars)

```
GiftProof — a gift, with its receipt
```

## Elevator pitch (max 200 chars)

```
Type one sentence about someone. Qloo's taste graph finds a gift you would never have guessed across brands, film, books and places, each proven by a live receipt that shows exactly why.
```

## "Try it out" links

- **Live demo:** https://giftproof-app.vercel.app
- **Public code repo:** https://github.com/dmustapha/giftproof

## Built with (tags)

```
next.js, react, typescript, tailwindcss, qloo, qloo-taste-api, 0g-compute, llm, agent, zod, vercel, lru-cache, node.js
```

---

## About the project (paste into "Project Story", Markdown)

## Inspiration

Buying a gift for someone whose taste you do not share (a parent, an in-law, a new partner) is a near universal, recurring problem. Keyword search and a generic chatbot both collapse to the giver's taste bubble or a safe cliche. We wanted an agent that reads only public taste, lets a real behavioral graph do the bridging across categories, and then proves every choice instead of asking you to trust it.

## What it does

You type one sentence about someone, for example "my sister is obsessed with Succession, Aesop skincare, and A24 films." A 0G Compute agent reads it, extracts the tastes, and chooses 2 to 4 giftable domains to target. **Qloo's taste graph then ranks real gifts by cross domain affinity**, and every pick arrives with a live **receipt** that shows which taste drove it and how strongly. Remove or add a taste chip and the whole grid re prints live, with the cross domain connections redrawing in real time.

## What makes it Qloo powered

Qloo's own kill test is: "if your submission would work the same without Qloo, you are building the wrong thing." Delete the Qloo call and GiftProof returns nothing. The entire product is Qloo's cross domain affinity plus explainability made visible:

- A chatbot can guess "buy her an A24 tote." It cannot know that fans of **Aesop, A24, and Succession** over index on a specific brand. That correlation lives in Qloo's 250M plus entity graph, not in language.
- **Every number on screen is a real Qloo field:** affinity (0 to 1), explainability score (which taste drove the pick), and rank position. Nothing is fabricated.
- **The language model never ranks.** It extracts tastes and writes narration only. Qloo's numbers decide the order of every gift.

Five Qloo surfaces are load bearing and zero are decorative: `/v2/insights` cross domain ranking and `feature.explainability` (the core differentiator), `/search` and `/v2/tags` for resolving tastes to real entity IDs, and demographic signals for sharper ranking.

## How we built it

1. **Extract:** the 0G Compute agent reads the free text sentence and pulls out the recipient's tastes plus 2 to 4 giftable domains. It extracts, it never ranks.
2. **Resolve:** each taste is resolved to a real Qloo entity ID via `/search`, or sharpened to a tag via `/v2/tags`. No recipient names or PII are ever sent to Qloo.
3. **Rank cross domain:** `/v2/insights` is fanned out across the chosen domains in parallel, seeded with the resolved entities, and the picks are ordered by Qloo's real `query.affinity`.
4. **Refine (gated):** if the first ranking is weak (low top affinity or thin explainability), the agent adds a tag signal and re queries once. Sharp first results skip this hop to keep latency low.
5. **Resolve to a gift:** an entity to gift resolver maps each Qloo chosen pick to a buyable destination, keeping Qloo the chooser.
6. **Prove it:** every pick carries a split "Qloo says / we chose" receipt built from Qloo's real explainability contributors, never a fabricated score. Swap a seed and the receipt recomputes live.

The reference journey ("my sister is obsessed with Succession, Aesop, and A24") makes **8 Qloo calls** (5 resolution calls plus a 3 domain parallel insights fan out) and returns **12 cross domain ranked picks** across **3 agent chosen domains**, each with real explainability contributors. Every headline number is recomputable from committed real Qloo output by `npm run verify-claims`, which refuses read back and exits non zero on any mismatch.

## Honesty invariants (they bind the UI)

GiftProof is a trust product, so honesty is enforced in code, not promised in copy:

- **Qloo always ranks.** The model never invents an order.
- **Zero PII:** no name, email, or shipping fields, and nothing personal is sent to Qloo.
- **No fabricated numbers:** rank bands and affinities are real Qloo fields or a labeled rank band fallback, never a made up percentage.
- **Honest failure:** when 0G is unreachable the app shows a labeled `EXTRACTION_UNAVAILABLE` state; when Qloo is unreachable it serves a labeled empty state. It never fakes a pick.
- **Aggregate framing only** ("fans of X over index on Y"), with the raw Qloo response shown on the `/proof` page.

## Challenges we ran into

- **Reading Qloo's real explainability shape.** The useful signal lives under `query.explainability` keyed by the input taste, not in a top level array. Getting the per pick contributors right is what makes the receipt real.
- **Quota frugality.** The hackathon key has limits, so we added an in process semaphore, an LRU cache, request debounce, and stale cache on 429 to keep live demos within budget.
- **Keeping the agent honest.** It was tempting to let the LLM re rank or fill gaps. We drew a hard line: the model extracts and narrates, Qloo ranks, and degraded states are labeled rather than hidden.

## Accomplishments that we are proud of

- **The receipt is a real instrument, not decoration.** It is built from live Qloo data and recomputes on every taste swap.
- **Verifiable claims.** A claims ledger recomputes every cited number from committed real Qloo output.
- **5 of 5 Qloo surfaces are load bearing**, and the whole experience falls apart without Qloo, which is exactly the point.

## What we learned

Cross domain taste is a genuinely different capability from search or language. The hardest and most valuable design work was not generating text, it was making the correlation legible and provable so a gift giver actually trusts a surprising suggestion.

## What's next

Deeper gift catalog and per domain deep links, richer demographic and geo signals, and a saved journeys feature so a giver can revisit and share a proven gift.

---

## Additional info (for judges, not public)

- **When did you begin your project?** During the Qloo Agentic Hackathon window (October 2026).
- **Public URL:** https://giftproof-app.vercel.app
- **Public code repo:** https://github.com/dmustapha/giftproof
- **If existing, how did you upgrade it with Qloo?** New project built for this hackathon. Qloo is the core, not an add on: cross domain `/v2/insights` with explainability ranks every gift, `/search` and `/v2/tags` resolve tastes, and demographic signals sharpen results. Remove Qloo and the app returns nothing.

## Requirements checklist

- Live, externally hosted demo: https://giftproof-app.vercel.app (public, verified end to end).
- Public repo with all source, assets, and run instructions: https://github.com/dmustapha/giftproof
- Text description of what it does and what makes it Qloo powered: the story above.
- Open source license in the repo About section: MIT (`LICENSE`).
- Demo video: not required by this hackathon.

## Media

- Image gallery (3:2 recommended): use the three app screenshots in `docs/images/` (landing, find a gift, results).
- Thumbnail: `public/og-image` style card or any of the screenshots.
