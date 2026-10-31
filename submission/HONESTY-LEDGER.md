# Honesty Ledger

What is real, what is simplified, and what is not built. This is a strength signal: every claim on the submission page maps to one of these rows.

## Real (live, verifiable)

- **Cross-domain ranking by Qloo.** `/v2/insights` with `feature.explainability` orders every pick by real `query.affinity`. Verifiable at `/proof` and by `npm run verify-claims`.
- **Taste resolution.** Each taste resolves to a real Qloo entity ID via `/search` (or a tag via `/v2/tags`). No PII is sent to Qloo.
- **The receipt.** Built from real explainability contributors, recomputes live on taste swap. No fabricated score anywhere.
- **The live app.** Deployed and public at https://giftproof-app.vercel.app. Live search runs the full 0G extraction plus Qloo fan-out end to end.
- **Committed proof.** `submission/proof.md` holds the redacted request, resolved entity IDs, affinities, and a raw explainability block, all recomputable from committed data.
- **Real brand and product imagery** at each pick, resolved per domain (OpenLibrary covers, iTunes art, brand logos), with a drawn-bridge fallback when none resolves.

## Simplified (works, scoped for the hackathon window)

- **Gift catalog.** Each Qloo pick maps to a buyable destination (currently an Amazon search for the pick, plus a small set of gift-card providers). The taste chooser is Qloo; the gift delivery layer is deliberately thin.
- **Geo signal.** The recipient `place` is carried as a label for the receipt and will drive a Qloo place-entity signal at wire. It is tolerated-absent today rather than guessed.
- **0G narration.** Grounded 0G prose is additive. When the endpoint returns an incomplete fragment the UI withholds it (the receipt carries the proof); narration is never faked.

## Not built (out of scope this round)

- Saved and shareable journeys.
- A deeper per-domain deep-link catalog (movie to streaming, book to bookshop, game to store).
- A demo video (the hackathon does not require one; the live app carries the demo).
