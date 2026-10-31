// File: src/lib/qloo/provenance.ts
import type { QlooPick, QlooEntityType, Coverage, Provenance, GiftMatch } from "@/lib/types";

// Human-readable plural label for a pick's filter.type, so the rank statement names the ACTUAL
// giftable domain Qloo ranked in ("brands", "places", "books") rather than the vague "gift
// categories". Falls back to a generic "gifts" for any unmapped type.
const DOMAIN_LABELS: Partial<Record<QlooEntityType, string>> = {
  "urn:entity:brand": "brands",
  "urn:entity:place": "places",
  "urn:entity:book": "books",
  "urn:entity:movie": "films",
  "urn:entity:video_game": "video games",
  "urn:entity:podcast": "podcasts",
  "urn:entity:artist": "artists",
  "urn:entity:tv_show": "shows",
  "urn:entity:destination": "destinations",
  "urn:entity:person": "people",
};
export function domainLabel(type: QlooEntityType): string {
  return DOMAIN_LABELS[type] ?? "gifts";
}

// Assemble the split "Qloo says / we chose" receipt from the RAW Qloo output only.
// DEPTH-PASS D: the rank statement now tells the CROSS-DOMAIN story — "fans of <top seed taste> →
// this <gift domain>" — because each pick's domain (pick.type) can differ from its driving seed's
// domain (the fan-out spans domains). The contributor labels come straight from the real
// query.explainability (which SEED drove this pick); a null/absent set never fabricates one (NN-3).
export function buildProvenance(pick: QlooPick, gift: GiftMatch | null, coverage: Coverage): Provenance {
  const contributorLabels = pick.explain
    .filter((c) => c.label)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .map((c) => c.label);
  const topDriver = contributorLabels[0];
  const rankStatement = topDriver
    ? `Qloo ranked this #${pick.rankPosition} of ${domainLabel(pick.type)} for fans of ${topDriver}`
    : `Qloo ranked this #${pick.rankPosition} of ${domainLabel(pick.type)} for this audience`;
  // Explainability-absent fallback (EXPLAINABILITY_ABSENT): Qloo ranked the pick but returned no
  // per-recommendation contributors (field teams report this happens, esp. for tag-only seeds).
  // The receipt still renders the rank statement + "we chose"; the "top contributors" line shows a
  // single labeled sentinel ("contributors not returned for this pick") instead of an empty list.
  // We NEVER fabricate a contributor to fill the gap (NN-3 honesty).
  const topContributors =
    contributorLabels.length > 0 ? contributorLabels : ["contributors not returned for this pick"];
  const affinityBand =
    pick.affinity !== null ? `affinity ${pick.affinity.toFixed(2)} (${pick.rankBand})` : `${pick.rankBand} rank band`;
  const matchType = gift?.matchType ?? "semantic";
  const weChoseReason = gift
    ? matchType === "exact"
      ? `A direct product match for Qloo's pick (${pick.name}) — ${gift.provider}.`
      : `A pick-specific destination for Qloo's pick (${pick.name}) via ${gift.provider}.`
    : `No buyable match found for Qloo's pick yet.`;
  return {
    qlooSays: { rankStatement, topContributors, affinityBand, raw: { entityId: pick.entityId, explain: pick.explain, coverage } },
    weChose: { reason: weChoseReason, matchType },
  };
}
