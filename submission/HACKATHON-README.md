# GiftProof (submission narrative)

**Gift someone whose taste you do not share.** Describe a person in one sentence and Qloo's taste graph finds a gift you would never have guessed, each proven by a live receipt that shows exactly why.

Live demo: https://giftproof-app.vercel.app
Repo (public, MIT): https://github.com/dmustapha/giftproof

## The problem

Buying a gift for someone whose taste you cannot guess (a parent, an in-law, a new partner) is a recurring problem. Keyword search and a generic chatbot both collapse to the giver's taste bubble or a safe cliche.

## What we built

A 0G Compute agent reads the sentence, extracts the tastes, and chooses 2 to 4 giftable domains. Qloo's taste graph then ranks real gifts by cross-domain affinity, and every pick arrives with a "Qloo says / we chose" receipt built from Qloo's real explainability. Remove or add a taste chip and the whole grid re-prints live.

## Our Qloo integration (the differentiator)

Qloo is load-bearing, not decoration. See the capability table and call sites in [sponsor-tracks.md](sponsor-tracks.md) and the deep technical read in the [repo README](../README.md). Five Qloo surfaces are load-bearing and zero are decorative. The language model never ranks. Remove the Qloo call and the app returns nothing.

## What makes this different

Every number on screen is a real Qloo field (affinity, explainability score, rank), never a fabricated percentage. Degraded states are labelled, not hidden. The receipt metaphor turns "trust me" into "here is the correlation, re-derive it yourself."

## Verify in 60s

One command re-derives the hero claim from committed real Qloo output (recompute tier, it refuses read-back):

```
git clone https://github.com/dmustapha/giftproof && cd giftproof && npm ci && npm run verify-claims
```

It recomputes the reference journey: 8 Qloo calls, 12 cross-domain picks across 3 agent-chosen domains, each with real explainability contributors. The raw request and response are also live at https://giftproof-app.vercel.app/proof and committed at [proof.md](proof.md).

## Try it

1. Open https://giftproof-app.vercel.app
2. Tap a sample journey, or type one sentence about someone's public taste.
3. Read the receipt on each gift, then remove a taste chip and watch the grid re-print.

Full technical and honesty detail: [repo README](../README.md), [HONESTY-LEDGER.md](HONESTY-LEDGER.md).
