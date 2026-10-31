# HANDOFF

The one page a judge or teammate opens to reproduce GiftProof from a cold clone.

## Target commit
`git checkout 4d2e0a47` (the reviewed HEAD of https://github.com/dmustapha/giftproof).

## Fresh-clone verify
```
git clone https://github.com/dmustapha/giftproof && cd giftproof
npm ci
npm run verify-claims
```
`verify-claims` recomputes every headline number from committed real Qloo output and exits non-zero on any mismatch (it refuses read-back). The test suite (`npm test`) reports 71 passing.

Expected hero recompute: the reference journey makes 8 Qloo calls and returns 12 cross-domain picks across 3 agent-chosen domains, each with real explainability contributors.

## Demo walkthrough
See the live app at https://giftproof-app.vercel.app. Tap a sample journey or type one sentence about someone, read the receipt on each gift, then remove a taste chip and watch the grid re-print. The raw Qloo request and response are at https://giftproof-app.vercel.app/proof. (Try-it steps mirror submission/HACKATHON-README.md.)

## Do-not-modify (freeze list)
Files that are load-bearing and frozen for review; changing them invalidates the recorded proof:
- `giftproof-app/src/lib/qloo/insights.ts` (the cross-domain ranker + real explainability shape)
- `giftproof-app/src/lib/qloo/provenance.ts` (the receipt source of truth)
- `data/seed-journeys.json` (committed real Qloo output the claims recompute from)
- `CLAIMS.md` + `scripts/verify-claims.ts` (the proof surface)
