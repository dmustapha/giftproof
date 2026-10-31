# CLAIMS: GiftProof headline-number ledger

> Every headline number, entity ID, rank statement, and API-call count the submission cites lives
> here. `scripts/verify-claims.ts` RECOMPUTES each from committed real Qloo output in `data/`
> (it refuses read-back) and exits non-zero on any mismatch. No unbacked figure ships
> (INVARIANTS VERIFY-BEFORE-CLAIMING). This ledger is empty until the live Qloo key lands and
> `scripts/seed-demo.ts` writes `data/seed-journeys.json`; the verifier handles the empty case.

## Headline claims

| id | claim | recompute source (`data/`) | status |
|----|-------|----------------------------|--------|
| qloo-surfaces | 5/5 Qloo surfaces load-bearing (insights cross-domain + explainability CORE; /search + /v2/tags supporting; demographic signals DEPTH-PASS C), 0 decorative | code (`src/lib/qloo/*`) + `data/seed-journeys.json` raw blocks + `agent` trace | verified (deep seed 2026-10-30) |
| hero-call-count | the sister/Succession journey makes 8 Qloo calls (5× /search resolution + a 3-domain parallel /v2/insights fan-out), recorded in `response.agent.qlooCallCount` | `data/seed-journeys.json` `response.agent.qlooCallCount` | verified: 8 Qloo calls |
| resolved-entities | each seed taste resolves to a real Qloo entity ID; the sister journey returns 12 cross-domain ranked picks (spanning the agent's chosen domains), all with explainability contributors | `data/seed-journeys.json` `picks[].pick.entityId` + `agent.chosenDomains` | verified: 12 picks, 5/5 tastes resolved, 3 domains chosen |

> Rows re-recomputed on 2026-10-30 after the DEPTH PASS (multi-domain cross-ranking + weakness-gated
> refine + demographics) re-earned `data/seed-journeys.json`. `scripts/verify-claims.ts` now recomputes
> `hero-call-count` (8) from `response.agent.qlooCallCount` (the real per-journey Qloo call tally, the
> journey is multi-domain, no longer a single /v2/insights) and exits non-zero if tampered (refuses
> read-back). The machine counterpart is `docs/pipeline/claims.json`.
