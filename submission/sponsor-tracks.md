# Sponsor Track Justification

## Qloo (the core, not an integration)

**What we use:** Qloo Taste API across three surfaces plus demographic signals.

| Capability | Qloo surface | Where in the code |
|---|---|---|
| Resolve each taste to a real entity ID | `GET /search` | `giftproof-app/src/lib/qloo/resolve.ts` |
| Sharpen a broad taste into a tag signal | `GET /v2/tags` | `giftproof-app/src/lib/qloo/resolve.ts` |
| Rank giftable entities by cross-domain affinity (the differentiator) | `GET /v2/insights` with `signal.interests.entities` | `giftproof-app/src/lib/qloo/insights.ts` |
| Explain which taste drove each pick | `feature.explainability=true` on `/v2/insights` | `giftproof-app/src/lib/qloo/insights.ts`, `provenance.ts` |

**What it does:** the agent reads a one-sentence description, resolves the tastes to real Qloo entities, then fans `/v2/insights` out across 2 to 4 gift domains in parallel. Qloo's real `query.affinity` orders every pick, and `query.explainability` names which input taste drove it. That cross-domain correlation is the product.

**Proof of integration:** the reference journey ("my sister is obsessed with Succession, Aesop, and A24") makes 8 Qloo calls and returns 12 cross-domain picks across 3 agent-chosen domains, every one carrying real explainability contributors. Recompute it with `npm run verify-claims` (it refuses read-back). Raw response is live at https://giftproof-app.vercel.app/proof and committed at `submission/proof.md`.

**Integration depth:** load-bearing. The language model only extracts tastes and writes narration. It never ranks. Remove the Qloo call and the app returns nothing, which is the hackathon kill-test passed by construction.

**Honest note:** geo `place` is carried as a label for the receipt and is wired to a Qloo place-entity signal when the geo param is confirmed; it is tolerated-absent until then (no fabricated geo ranking).
