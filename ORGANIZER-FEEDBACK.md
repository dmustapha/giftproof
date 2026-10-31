# Organizer Feedback

Constructive developer-experience feedback for the Qloo and 0G teams, from building GiftProof during the hackathon. Each item is organizer-actionable (not a self-inflicted issue) and carries the concrete evidence we hit.

## Qloo Taste API

1. **Document the real explainability shape.** On the hackathon tenant, `query.explainability` is an OBJECT keyed by the input signal name, with each value an array of `{entity_id, name, score}`. Our first integration assumed a top-level `explainability` array (which the examples suggested) and returned empty receipts until we inspected a live response. A one-line note in the docs ("explainability is nested under `query`, keyed by signal") would save every team this round trip. Evidence: `src/lib/qloo/insights.ts` (the corrected flatten of `query.explainability`).

2. **Affinity also lives under `query`.** `query.affinity` (0 to 1) is where the real score is, not a top-level field. Same discoverability gap as above; worth calling out together.

3. **Entity imagery from the hackathon image CDN is mostly placeholders.** `https://images.qloo.com/i/{entityId}-420x-au` redirected to a 117-byte `oops.png` for every entity we tried (valid IDs included). We wanted to show the real picked-entity image and could not. Documenting which entities carry images on the hackathon tier (or exposing an `image` field in the insights response) would let teams show richer, Qloo-native imagery.

4. **Publish the hackathon-key rate limits.** We added an in-process semaphore, an LRU cache, request debounce, and stale-cache-on-429 defensively because the per-key quota was not stated. A published limit (requests per minute, burst) would let teams budget precisely instead of guessing.

## 0G Compute

1. **Narration completions truncate intermittently.** The narration endpoint returned fragments ("This digital gift", "As") instead of full sentences on a meaningful fraction of calls (a `finish_reason: length` style cutoff). We now withhold incomplete prose in the UI rather than show a fragment. Either more stable completions or a clearer truncation signal in the response would help.

2. **Extraction is intermittently unavailable or slow.** We saw `EXTRACTION_UNAVAILABLE` and multi-second hangs on the taste-extraction path during the window. Clearer error semantics and a documented timeout/retry guidance would make the agent loop more predictable.

## Note

Image-generation provider outages (a dead third-party key, a paywalled public endpoint) that we hit while making brand assets were our own tooling, not a Qloo or 0G issue, so they are excluded here.
