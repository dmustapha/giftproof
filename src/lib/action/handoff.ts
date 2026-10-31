// File: src/lib/action/handoff.ts
// Option-A (GUARANTEED baseline): real buy-link hand-off to a real, reachable destination.
import { allEntries } from "@/lib/gift/catalog";
import { buyUrlForPick } from "@/lib/gift/buyurl";
import { resolveProductUrl } from "@/lib/gift/product";
import { TOKENS, type QlooEntityType } from "@/lib/types";

// sku = "prod:<urn:entity:type>:<pick name>" → RE-RESOLVE the actual product page server-side
// (resolveProductUrl, cached), falling back to the pick-relevant SEARCH url on miss/low-confidence.
// We recompute server-side (never trust a client-supplied URL), so the destination is guaranteed real
// and reachable (INVARIANTS NN-4). Legacy catalog SKUs fall through to the catalog buyUrl.
const PROD = /^prod:(urn:entity:[a-z_]+):([\s\S]+)$/;

export async function handoff(sku: string): Promise<{ mode: "handoff"; buyUrl: string }> {
  const m = PROD.exec(sku);
  if (m) {
    const [, type, name] = m;
    if (!name.trim()) throw new Error(`${TOKENS.ACTION_UNAVAILABLE}: empty pick for ${sku}`);
    const t = type as QlooEntityType;
    const resolved = await resolveProductUrl(name, t); // actual product page, or null → search fallback
    return { mode: "handoff", buyUrl: resolved?.buyUrl ?? buyUrlForPick(name, t).buyUrl };
  }
  const e = allEntries().find((x) => x.sku === sku);
  if (!e?.buyUrl) throw new Error(`${TOKENS.ACTION_UNAVAILABLE}: no buyUrl for ${sku}`);
  return { mode: "handoff", buyUrl: e.buyUrl }; // real, reachable external URL (INVARIANTS NN-4)
}
