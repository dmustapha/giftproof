// File: src/lib/gift/resolve.ts
import { exactByHint } from "./catalog";
import { buyUrlForPick, isProductUrl } from "./buyurl";
import type { QlooPick, GiftMatch } from "@/lib/types";

// Map a Qloo-chosen entity to a buyable destination. Qloo stays the chooser of WHAT the gift is
// about; this layer only finds a buyable FORM for the EXACT pick.
//   - exact PRODUCT: our catalog knows this entity AND has a specific product page → use it, "exact".
//   - otherwise: route the exact pick name to a domain-appropriate real destination (search/store).
//     matchType stays honest — "exact" when the catalog recognized the entity, "semantic" when we
//     inferred from Qloo's taste pick without a catalog entry. We NEVER dress a generic gift-card as
//     a pick-specific product (INVARIANTS NN-4): the destination is always about the pick itself.
export function resolveGift(pick: QlooPick): GiftMatch | null {
  const name = pick.name?.trim();
  if (!name) return null;

  const exact = exactByHint(name);
  if (exact && isProductUrl(exact.buyUrl)) {
    return { sku: exact.sku, title: exact.title, provider: exact.provider, buyUrl: exact.buyUrl, matchType: "exact", matchedEntity: name };
  }

  const t = buyUrlForPick(name, pick.type);
  const matchType: "exact" | "semantic" = exact ? "exact" : "semantic";
  // sku encodes the pick as `prod:<type>:<name>` so the /api/action handoff RE-RESOLVES to the actual
  // product page (resolveProductUrl, cached) and falls back to this search URL — recomputed server-side,
  // never trusting a client-supplied URL.
  return { sku: `prod:${pick.type}:${name}`, title: t.title, provider: t.provider, buyUrl: t.buyUrl, matchType, matchedEntity: name };
}
