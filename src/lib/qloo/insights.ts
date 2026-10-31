// File: src/lib/qloo/insights.ts
// THE CORE. Cross-domain: seed signals of one kind, rank entities of a GIFTABLE kind
// by shared-audience affinity, with feature.explainability for the receipt (INVARIANTS NN-1/NN-3).
import { qlooGet } from "./client";
import { assertInsightsParams, assertAffinityBearing } from "./validate";
import type { QlooSignal, QlooEntityType, QlooPick, RankedResult, ExplainContribution, Recipient } from "@/lib/types";

interface InsightsResp {
  results?: {
    entities?: Array<{
      entity_id?: string; name?: string; type?: string;
      // DEV-004: the real tenant returns the generic "urn:entity" in `type` and the giftable URN
      // in `subtype` (e.g. "urn:entity:book"). ARCHITECTURE §7 assumed `type`; real recorded
      // fixtures carry `subtype`. We read subtype first so picks get the real giftable type.
      subtype?: string;
      // Affinity + explainability live under `query` on the real hackathon tenant (VERIFIED wire
      // 2026-10-29): query.affinity is a real 0..1 score; query.explainability is an OBJECT keyed by
      // signal name (e.g. "signal.interests.entities") whose value is an array of {entity_id, score}
      // naming WHICH input taste drove this pick. (The earlier top-level `explainability` array guess
      // was wrong and returned nothing — DEV-016.) We tolerate both shapes defensively.
      affinity?: number; score?: number;
      query?: {
        affinity?: number;
        explainability?: Record<string, Array<{ entity_id?: string; name?: string; score?: number }>>;
      };
      explainability?: Array<{ entity_id?: string; name?: string; score?: number }>;
    }>;
  };
}

function readAffinity(e: { affinity?: number; score?: number; query?: { affinity?: number } }): number | null {
  const a = e.affinity ?? e.score ?? e.query?.affinity;
  return typeof a === "number" ? a : null;   // null => render a rank band, NEVER a fabricated number (NN-3)
}
function band(affinity: number | null, pos: number): QlooPick["rankBand"] {
  // The 0.8 / 0.5 cutoffs are a DISPLAY heuristic for bucketing a REAL affinity number into
  // high/medium/low for the bar label — they are NOT a Qloo-defined threshold and are applied
  // ONLY when a real affinity number exists. When affinity is null we never invent one; we band
  // purely by Qloo's returned rank position (below). Neither branch fabricates a score (NN-3).
  if (affinity !== null) return affinity >= 0.8 ? "high" : affinity >= 0.5 ? "medium" : "low";
  return pos <= 3 ? "high" : pos <= 8 ? "medium" : "low"; // rank-position band when score absent
}

export async function rankGifts(
  signals: QlooSignal[],
  domain: QlooEntityType,
  opts: { take?: number; recipient?: Recipient } = {},
): Promise<RankedResult> {
  const entities = signals.filter((s) => s.kind === "entity").map((s) => s.value);
  const tags = signals.filter((s) => s.kind === "tag").map((s) => s.value);
  const params: Record<string, string> = {
    "filter.type": domain,
    "feature.explainability": "true",
    "filter.popularity.min": "0.3",       // avoid obscure picks
    "bias.content_based": "0.35",
    "diversify.by": "subtype",            // spread the picks (deep integration)
    "take": String(opts.take ?? 12),
  };
  if (entities.length) params["signal.interests.entities"] = entities.join(",");
  if (tags.length) params["signal.interests.tags"] = tags.join(",");
  // DEPTH-PASS C: feed the coarse recipient demographics when the agent derived them. ABSENT => the
  // param is OMITTED (never an empty/guessed value, NN-2). The validator (assertInsightsParams) rejects
  // any off-list bucket before the call, so a hallucinated bucket can never ride through silently (NN-5).
  const rec = opts.recipient;
  if (rec?.age) params["signal.demographics.age"] = rec.age;
  if (rec?.gender) params["signal.demographics.gender"] = rec.gender;

  assertInsightsParams(params);           // silent-ignore defense BEFORE the call (NN-5)
  const resp = await qlooGet<InsightsResp>("/v2/insights", params);
  const ents = resp.results?.entities ?? [];
  assertAffinityBearing(ents.map((e) => ({ entity_id: e.entity_id })));  // non-empty assert (NN-5)

  // Map seed entity/tag IDs back to their human labels so the receipt can say WHICH taste drove a
  // pick (explainability references the SEED's id, not the pick's). Falls back to the raw id.
  const seedLabel = new Map(signals.map((s) => [s.value, s.label]));

  const picks: QlooPick[] = ents.map((e, i) => {
    const affinity = readAffinity(e);
    // Real shape: e.query.explainability is an object keyed by signal name; flatten its arrays into
    // one contribution list, resolving each entity_id to the seed label (NN-3: real fields only, a
    // null score stays null, never fabricated). Fall back to the legacy flat-array shape if present.
    const explainObj = e.query?.explainability;
    const flatFromQuery: Array<{ entity_id?: string; name?: string; score?: number }> = explainObj
      ? Object.values(explainObj).flat()
      : [];
    const source = flatFromQuery.length ? flatFromQuery : (e.explainability ?? []);
    const explain: ExplainContribution[] = source.map((x) => ({
      entityId: x.entity_id ?? "",
      label: x.name ?? seedLabel.get(x.entity_id ?? "") ?? x.entity_id ?? "",
      score: typeof x.score === "number" ? x.score : null,
    }));
    return {
      // DEV-004: prefer subtype (real giftable URN) over the generic type, then fall back to domain.
      entityId: e.entity_id ?? "", name: e.name ?? "", type: (e.subtype as QlooEntityType) ?? (e.type as QlooEntityType) ?? domain,
      affinity, rankBand: band(affinity, i + 1), rankPosition: i + 1, explain,
    };
  });
  return { picks, raw: resp, domain };
}
