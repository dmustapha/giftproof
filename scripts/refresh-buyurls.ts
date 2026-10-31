// File: scripts/refresh-buyurls.ts
// Refresh of the gift-routing layer in the committed demo fixture. For each ALREADY-REAL Qloo pick in
// data/seed-journeys.json it re-runs resolveGift() (the search baseline), then AWAITS resolveProductUrl()
// (REAL free-keyless API calls) to UPGRADE the gift to the ACTUAL product page — falling back to the
// search url + matchType "semantic" on miss/low-confidence. Finally re-runs buildProvenance(). Rewrites
// ONLY `gift` and `provenance`; the earned Qloo picks, raw payloads, coverage, and 0G narration are
// preserved byte-for-byte. Hits the network (product resolvers only; no LLM/Qloo). Backup kept.
// Run: npx tsx scripts/refresh-buyurls.ts
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { resolveGift } from "../src/lib/gift/resolve";
import { resolveProductUrl } from "../src/lib/gift/product";
import { buildProvenance } from "../src/lib/qloo/provenance";

const FILE = join(process.cwd(), "data/seed-journeys.json");
const data = JSON.parse(readFileSync(FILE, "utf8")) as {
  journeys: Array<{ id: string; response: { coverage: unknown; picks: Array<Record<string, unknown>> } }>;
};

copyFileSync(FILE, FILE.replace(/\.json$/, `.pre-buyurl-refresh.bak.json`));

async function main() {
  let changed = 0, total = 0;
  for (const j of data.journeys) {
    const coverage = j.response.coverage as Parameters<typeof buildProvenance>[2];
    for (const card of j.response.picks) {
      total++;
      const pick = card.pick as Parameters<typeof resolveGift>[0];
      const before = (card.gift as { buyUrl?: string } | null)?.buyUrl;
      const gift = resolveGift(pick);
      if (gift && gift.matchType !== "exact") {
        // UPGRADE search-fallback gifts to the actual product page when confidently resolved; NEVER
        // clobber a real catalog product (matchType "exact" already).
        const t = await resolveProductUrl(pick.name, pick.type);
        if (t) Object.assign(gift, { buyUrl: t.buyUrl, provider: t.provider, title: t.title, matchType: "exact" });
      }
      card.gift = gift;
      card.provenance = buildProvenance(pick, gift, coverage);
      if (gift?.buyUrl !== before) changed++;
      console.log(`  ${j.id} | ${pick.name} [${pick.type}] -> ${gift?.matchType} ${gift?.buyUrl}`);
    }
  }
  writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log(`\nrefreshed ${changed}/${total} buyUrls across ${data.journeys.length} journeys. backup: seed-journeys.pre-buyurl-refresh.bak.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
