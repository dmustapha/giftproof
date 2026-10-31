// File: scripts/seed-demo.ts
// Precompute the 3 canonical demo journeys by running each sentence through the REAL orchestrator
// (runGift → live Qloo /search + /v2/tags + /v2/insights + 0G extraction/narration) ONCE and
// caching the genuine responses to data/seed-journeys.json. This is EARNED state (PRD §7.5): real
// Qloo ran, the real output is committed, and the landing renders it labeled "cached live Qloo
// response" so a cold judge sees real example output with no empty state, and the operator has a
// demo-insurance fallback if the key is briefly unavailable at demo time.
//
//   cd giftproof-app && npx tsx --env-file=.env.local scripts/seed-demo.ts
//
// NEVER regenerate under time pressure at the venue (P3 rollback rule) — the committed file is the
// safe source of truth.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runGift } from "../src/lib/orchestrate";
import { narrate } from "../src/lib/llm/narrate";

const JOURNEYS = [
  { id: "sister-succession", title: "For my sister",
    sentence: "My sister is obsessed with Succession, Aesop skincare, and A24 films." },
  { id: "dad-jazz-woodworking", title: "For my dad",
    sentence: "My dad loves jazz records and woodworking." },
  { id: "coworker-climbing-coffee", title: "For my coworker",
    sentence: "My coworker is into rock climbing and specialty coffee." },
];

// The 0G Compute Router intermittently fails a plan completion (gateway blip / malformed JSON that
// survives the in-code retry). The seed is the demo-insurance artifact — it MUST land all 3 journeys
// as real earned state, so we retry a journey a few times before accepting a degraded result. This is
// NOT a fallback (still the sole 0G path, real Qloo) — just patience against a flaky router at seed time.
async function runGiftWithRetry(sentence: string, tries = 5) {
  let last = await runGift(sentence);
  for (let i = 1; i < tries && last.degraded === "EXTRACTION_UNAVAILABLE"; i++) {
    await new Promise((r) => setTimeout(r, 800));
    last = await runGift(sentence);
  }
  return last;
}

async function main() {
  const out: Array<Record<string, unknown>> = [];
  for (const j of JOURNEYS) {
    process.stdout.write(`seeding ${j.id} ... `);
    const response = await runGiftWithRetry(j.sentence);
    // No-fallback directive: runGift now returns narration:null (narration is lazy/off critical path).
    // For the EARNED-STATE seed we bake REAL 0G narration per pick here, grounded in each pick's Qloo
    // provenance — the exact prose the lazy /api/narrate route would produce. No template is used; a
    // pick whose 0G narration fails keeps narration:null and the landing omits that line honestly.
    for (const card of response.picks) {
      try { card.narration = await narrate(card.provenance); }
      catch { card.narration = null; }
    }
    if (!response.raw || response.picks.length === 0) {
      console.log(`WARN: ${j.id} produced ${response.picks.length} picks (degraded=${response.degraded}). Keeping it labeled honestly.`);
    } else {
      const narrated = response.picks.filter((p) => p.narration).length;
      console.log(`ok (${response.picks.length} picks, ${response.coverage.resolved}/${response.coverage.total} tastes resolved, ${narrated} 0G-narrated)`);
    }
    out.push({ id: j.id, title: j.title, sentence: j.sentence, fixture: false, response });
  }
  const payload = {
    _note: "Cached REAL Qloo responses (seed-demo.ts). Earned state per PRD 7.5 — not fabricated. Renders the no-empty-state landing and the demo-insurance fallback.",
    journeys: out,
  };
  const path = join(import.meta.dirname, "..", "data", "seed-journeys.json");
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log(`wrote ${out.length} real journeys to ${path}`);
}

main().catch((e) => { console.error("seed-demo failed:", e); process.exit(1); });
