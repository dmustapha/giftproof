# SECURITY: GiftProof

> Threat matrix + what we deliberately do NOT defend. Scaffolded at C0 (ARCHITECTURE §Security spec,
> PLAN Task 0.2). Naming what is out of scope is part of the honesty posture.

## Threat matrix

| Threat | Enforcement | File |
|---|---|---|
| Qloo key leak to client | key read only in server route handlers from `process.env`; never imported into a `"use client"` file | `src/lib/qloo/client.ts` |
| PII to Qloo | `stripPII` + extractor prompt/alias-table drops recipient names/emails | `src/lib/qloo/validate.ts`, `src/lib/llm/extract.ts` |
| Silent-ignore (params dropped) | `assertInsightsParams` allow-list rejects unknown params before the call | `src/lib/qloo/validate.ts` |
| Quota exhaustion / 429 | `Semaphore(2)` + LRU cache + 350ms debounce + stale-cache-on-429 | `src/lib/infra/semaphore.ts`, `src/lib/infra/cache.ts` |
| Fabricated provenance | rank-band-only when score absent; narrator cannot add numbers | `src/lib/qloo/provenance.ts`, `src/lib/llm/narrate.ts` |
| Injection via sentence | `zod` body validation + length cap (2–500) | `src/app/api/*/route.ts` |

## Not defended against

- A **compromised VM env**: if the host itself is breached, the Qloo key in `process.env` is exposed. Out of scope for a hackathon demo; mitigated only by the key being backend-only and never in the repo/bundle.
- **Qloo-side data accuracy**: we render Qloo's real output honestly; we do not and cannot verify Qloo's underlying taste data is correct.
- **Abuse / rate-limiting of our own public endpoints** beyond the in-process semaphore + cache: there is no per-IP throttle or auth on `/api/*`; a determined abuser could burn our Qloo monthly quota.
- **User auth**: there is NO user authentication by design. GiftProof is a public, read-only taste tool; it stores no user data and has no accounts. This is a conscious choice, not a gap.
