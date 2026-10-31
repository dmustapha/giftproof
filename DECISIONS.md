# Architecture Decision Records — GiftProof

## ADR-001: Hosting on the Oracle Always-Free VM
- Context: the app must be reachable with no cold-start during the on-air judging window; a sleeping free tier is effective disqualification.
- Decision: deploy the full Next.js app on the owned Oracle Always-Free VM behind the existing nginx+TLS, managed by pm2.
- Rejected: Vercel+Upstash and Render free tiers — both sleep / cold-start and impose function timeouts that would cut deep Qloo+LLM chains. Declined because the DQ risk is unacceptable on a no-video, live-URL-is-the-demo event.
- Consequence: zero sleep, no function timeouts, full control; costs a manual scripted deploy instead of git-push CI.
- Where: `deploy/deploy.sh`, `ecosystem.config.cjs`, ARCHITECTURE §N+9, `durability-tier.json`.

## ADR-002: Action layer = Option-A buy-link baseline, Option-B sandbox optional
- Context: the thesis demands a real completed action, but a mandatory real charge risks a day-one provider-key failure live on air.
- Decision: Option-A real buy-link hand-off is the guaranteed baseline (no payment, zero on-stage risk); Option-B Tremendous sandbox issue is an additive upgrade only if self-serve sandbox keys confirm day-one.
- Rejected: a mandatory sandbox charge (fragile on air) and a mocked "Order placed" toast (violates TASTE U7 / INVARIANTS NN-4).
- Consequence: the demo never breaks on the action; the "real charge" wow is a bonus, not a dependency.
- Where: `src/lib/action/*`, ARCHITECTURE §11, INVARIANTS NN-4.

## ADR-003: Provenance = rank bands + real explainability, never a fabricated %
- Context: field reports say Qloo exposes rank-order, not always a clean per-entity affinity score.
- Decision: render rank-band wording ("ranked #2 for this audience") and only real `feature.explainability` contributors; a number appears only if a real affinity field is present.
- Rejected: a synthesized per-entity match percentage — dishonest and it fails the provenance rubric line.
- Consequence: provenance is always truthful and recomputable; the UI must be comfortable with bands, not just bars.
- Where: `src/lib/qloo/provenance.ts`, `src/lib/qloo/insights.ts` (`readAffinity`), INVARIANTS NN-3.

## ADR-004: LLM extracts + narrates only; Qloo always ranks
- Context: the kill-test — "would this work the same without Qloo?" — is the whole event.
- Decision: the LLM parses the sentence into tastes and rewrites provenance into copy; the ranking is always Qloo `/v2/insights` cross-domain.
- Rejected: letting the LLM rank/score gifts — a generic LLM could reproduce it, failing the kill-test.
- Consequence: the ranking function has no LLM dependency; structurally, a narrator string cannot reorder picks.
- Where: `src/lib/llm/*`, `src/lib/orchestrate.ts`, INVARIANTS NN-1.

## ADR-005: Explicit disclosed entity→gift resolver with a real 500+ catalog
- Context: Qloo returns entities, not buyable SKUs — the gap could make Qloo look decorative.
- Decision: ship a disclosed resolver over a real 500+ digital-gift catalog (exact-hint → tag overlap → labeled semantic fallback); every card states exact vs semantic.
- Rejected: a tiny hardcoded lookup table — shrinks Qloo to decoration (drift tripwire, kill-test failure).
- Consequence: Qloo stays visibly the chooser of what the gift is about; the resolver only finds a buyable form.
- Where: `src/lib/gift/*`, `data/gift-catalog.json`, ARCHITECTURE §9, INVARIANTS D-5.

## ADR-006: Local in-process LRU cache + 2-in-flight semaphore (no external cache)
- Context: 5 req/s + 10k/mo quota and a silent-429 on parallel bursts; swap-spam on air is the risk.
- Decision: in-process LRU keyed on the normalized signal set + a Semaphore(2) + a 350ms swap debounce, all VM-local.
- Rejected: external Upstash/Redis — Dami ruling (no external cache service); unnecessary for a stateless app on an owned VM.
- Consequence: cache is lost on restart (acceptable — derived state); swap and retry hit cache, not quota.
- Where: `src/lib/infra/*`, ARCHITECTURE §4, INVARIANTS D-6.

## ADR-007: Direct REST to the Qloo tenant (harness as a wire probe)
- Context: every Qloo call needs deterministic validation, caching, and concurrency control.
- Decision: call `https://hackathon.api.qloo.com` directly (GET, `X-Api-Key`) through one gateway; keep `@qloo/qloo-harness` available for wire-time probing.
- Rejected: spawning the harness CLI per request — a subprocess per call is slower and harder to wrap with the validator/cache/semaphore.
- Consequence: one code path controls every Qloo call; wire still has the harness to cross-check field names.
- Where: `src/lib/qloo/client.ts`, INVARIANTS D-7, SOURCE LOCK.
