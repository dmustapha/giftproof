# Limitations — GiftProof

## In scope (built for this submission)
- One-sentence public-taste input → Qloo `/v2/insights` cross-domain ranked digital gifts with affinity bars / rank bands.
- Split "Qloo says / we chose" provenance receipt driven by real `feature.explainability` output.
- Live seed-swap recompute (the hero): remove/add a taste, the ranking and provenance recompute in place.
- Disclosed entity→gift resolver over a real 500+ digital-gift catalog with a labeled semantic fallback.
- Option-A real buy-link hand-off (guaranteed). Option-B real Tremendous sandbox issue (if keys confirm day-one).
- A `/proof` page with the redacted request→result walkthrough and the raw Qloo response.

## Feature-gated (deliberately not built for this scope)
- Physical-goods purchase + shipping. Reason: the no-PII invariant (no shipping address to Qloo or us) — digital rail only for the hackathon (NN-2).
- Multi-recipient / group gifting, registries, B2B brand-match. Reason: scope — those are separate ideas (SponsorFit/TasteBridge in foldback).
- Individual profiling / sending recipient names or emails to Qloo. Reason: SAFE_USE + NN-2 — Qloo is used for aggregate taste correlation only.
- `urn:heatmap` / trends / audience-compare features. Reason: unverified on the hackathon tenant; out of scope to avoid a decorative or broken surface.
- User accounts / saved gift history. Reason: stateless by design — no persistence, no login wall.

## What the results do NOT prove
- Qloo returns aggregate behavioral correlation across a shared audience — NOT a guarantee the specific recipient will like the gift. The provenance says "fans of X over-index on Y," never "your sister will love this."
- Rank order is Qloo's; a per-entity numeric "match score" is shown only when Qloo returns a real affinity field, otherwise a rank band. No percentage is invented.
- The entity→gift mapping is OUR resolver, disclosed on every card as exact or semantic; Qloo chooses what the gift is about, not the exact SKU.
