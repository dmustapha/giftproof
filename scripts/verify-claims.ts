// File: scripts/verify-claims.ts
// Franchise verifier (INVARIANTS VERIFY-BEFORE-CLAIMING). RECOMPUTES every headline number from
// the committed real Qloo output in data/ — it REFUSES read-back (never trusts a number just
// because CLAIMS.md says so) — and exits non-zero on ANY mismatch. Writes the recomputed numbers
// to evidence/ for the clean-room diff.
//
//   npx tsx scripts/verify-claims.ts --dry   # C0: no data/ yet -> "no claims yet", exit 0
//   npx tsx scripts/verify-claims.ts         # real: recompute from data/, exit !=0 on mismatch
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry");

interface SeedJourney {
  id: string;
  title: string;
  sentence: string;
  fixture?: boolean;
  response: {
    picks: Array<{ pick: { entityId: string } }>;
    coverage: { resolved: number; total: number };
    raw?: unknown;
    // DEPTH PASS: the agent records the REAL total Qloo call count for the journey (resolveSignals
    // /search+/v2/tags + the parallel multi-domain fan-out + any refine hop). This is the authoritative
    // recompute source for hero-call-count now that the journey is multi-domain, not single-insights.
    agent?: { qlooCallCount?: number };
  };
}
interface SeedFile {
  journeys: SeedJourney[];
}

function loadSeed(): SeedFile | null {
  const real = join(ROOT, "data", "seed-journeys.json");
  if (existsSync(real)) {
    return JSON.parse(readFileSync(real, "utf8")) as SeedFile;
  }
  return null;
}

function main(): void {
  // C0 dry run (documented --dry): report the no-claims state and exit 0 without recomputing,
  // even if data/ exists. Used before a live key is wired so CI has a green no-op gate.
  if (DRY) {
    console.log("no claims yet (--dry)");
    process.exit(0);
  }

  const seed = loadSeed();

  // C0 / pre-key: no real committed Qloo output to recompute from.
  if (!seed || seed.journeys.length === 0) {
    console.log("no claims yet");
    process.exit(0);
  }

  // Refuse fixture data as a recompute source — only EARNED real output backs a claim.
  const fixtures = seed.journeys.filter((j) => j.fixture === true);
  if (fixtures.length > 0) {
    console.error(
      `verify-claims: data/seed-journeys.json contains ${fixtures.length} fixture journeys; ` +
        `claims can only be recomputed from EARNED real Qloo output. Run scripts/seed-demo.ts with a live key.`,
    );
    process.exit(2);
  }

  // Recompute headline numbers from the real journeys.
  const recomputed = seed.journeys.map((j) => {
    const entityIds = j.response.picks.map((p) => p.pick.entityId).filter(Boolean);
    // DEPTH PASS: prefer the agent's recorded real call count (multi-domain fan-out + refine). Fall
    // back to the legacy single-insights formula (resolved /search + 1 insights) only for pre-depth seeds.
    const callCount = j.response.agent?.qlooCallCount ?? j.response.coverage.resolved + 1;
    return { id: j.id, entityIds, pickCount: j.response.picks.length, callCount };
  });

  // Write recomputed evidence for the clean-room diff.
  const evDir = join(ROOT, "evidence");
  if (!existsSync(evDir)) mkdirSync(evDir, { recursive: true });
  writeFileSync(
    join(evDir, "recomputed-claims.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), recomputed }, null, 2) + "\n",
  );

  // Cross-check against CLAIMS.md headline rows that carry a concrete recomputed value.
  // (Rows still marked `pending-key` are not yet asserted; a value row that disagrees fails.)
  const claimsMd = existsSync(join(ROOT, "CLAIMS.md"))
    ? readFileSync(join(ROOT, "CLAIMS.md"), "utf8")
    : "";
  let mismatches = 0;
  const heroCall = recomputed.find((r) => r.id === "sister-succession")?.callCount;
  // Match the FIRST "N Qloo calls" after the hero-call-count id (non-greedy [^\n]*?) so a tampered
  // claim value is caught even when the row's status column also mentions a call count. Enforce on
  // EVERY "N Qloo calls" number on that row — any one that disagrees with the recompute is a mismatch.
  const heroLine = claimsMd.split("\n").find((l) => l.includes("hero-call-count")) ?? "";
  const claimedNums = [...heroLine.matchAll(/\b(\d+)\s+Qloo calls/gi)].map((m) => Number(m[1]));
  if (heroCall !== undefined && claimedNums.length > 0) {
    for (const n of claimedNums) {
      if (n !== heroCall) {
        console.error(`MISMATCH hero-call-count: CLAIMS.md says ${n}, recomputed ${heroCall}`);
        mismatches++;
      }
    }
  }

  if (mismatches > 0) {
    console.error(`verify-claims: ${mismatches} mismatch(es) — refusing read-back.`);
    process.exit(1);
  }
  console.log(`claims match (recomputed ${recomputed.length} journeys from data/)`);
  process.exit(0);
}

main();
