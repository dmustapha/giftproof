// File: src/lib/types.ts
// The 10 confirmed Qloo insights filter.type URNs (research-brief §Entity types [A1]).
export const QLOO_ENTITY_TYPES = [
  "urn:entity:artist", "urn:entity:book", "urn:entity:brand", "urn:entity:destination",
  "urn:entity:movie", "urn:entity:person", "urn:entity:place", "urn:entity:podcast",
  "urn:entity:tv_show", "urn:entity:video_game",
] as const;
export type QlooEntityType = (typeof QLOO_ENTITY_TYPES)[number];

// Domains we rank gifts in (a giftable subset of the output types).
export const GIFT_DOMAINS: QlooEntityType[] = [
  "urn:entity:brand", "urn:entity:place", "urn:entity:book",
  "urn:entity:movie", "urn:entity:video_game", "urn:entity:podcast",
];

export interface CandidateTaste { name: string; domainGuess: QlooEntityType | "unknown"; raw: string; }

// DEPTH-PASS C — coarse recipient signals derived by the 0G agent from the sentence. These feed
// Qloo's demographic/geo signal params. ONLY coarse buckets + a place label are ever carried (NN-2:
// no names/emails). Each field is optional; absent => the param is simply omitted (never guessed).
// Qloo's allowed demographic buckets (VERIFIED param allow-list in validate.ts):
//   age    : one of the Qloo age brackets below (sent as signal.demographics.age)
//   gender : "male" | "female" (sent as signal.demographics.gender)
//   place  : a human place label the agent reads from the sentence ("Tokyo", "the PNW"). Carried for
//            the receipt/provenance; it is resolved to a Qloo place ENTITY signal at wire when the
//            geo param is confirmed, and tolerated-absent until then (DEPTH-PASS-SPEC §C).
export const QLOO_AGE_BUCKETS = [
  "35_and_younger", "36_to_55", "55_and_older",
] as const;
export type QlooAgeBucket = (typeof QLOO_AGE_BUCKETS)[number];
export const QLOO_GENDERS = ["male", "female"] as const;
export type QlooGender = (typeof QLOO_GENDERS)[number];
export interface Recipient {
  age: QlooAgeBucket | null;
  gender: QlooGender | null;
  place: string | null;   // coarse place LABEL only (no address); drives geo signal when wired
}

// DEPTH-PASS A — the agent's plan: the tastes PLUS the 2–4 gift domains it selected for this
// recipient PLUS the coarse recipient signals. Produced by the 0G agent in a single reasoning pass.
export interface AgentPlan {
  tastes: CandidateTaste[];
  targetDomains: QlooEntityType[];   // 2–4 giftable domains the agent chose from the tastes
  recipient: Recipient;
  reasoning: string | null;          // the agent's one-line rationale for the domain choice
}

export interface QlooSignal {
  kind: "entity" | "tag";
  value: string;          // entity ID or tag URN
  label: string;          // human label for the receipt
  source: "search" | "tags";
}

export interface Coverage { resolved: number; total: number; misses: string[]; }

export interface ExplainContribution { entityId: string; label: string; score: number | null; } // score real or null (never fabricated)

export interface QlooPick {
  entityId: string;
  name: string;
  type: QlooEntityType;
  affinity: number | null;                 // real field or null
  rankBand: "high" | "medium" | "low";     // derived from rank position when affinity absent
  rankPosition: number;                    // 1-based position in Qloo's returned order
  explain: ExplainContribution[];
}

export interface RankedResult { picks: QlooPick[]; raw: unknown; domain: QlooEntityType; }

export interface GiftMatch {
  sku: string; title: string; provider: string; buyUrl: string;
  matchType: "exact" | "semantic";
  matchedEntity: string;
}

export interface Provenance {
  qlooSays: { rankStatement: string; topContributors: string[]; affinityBand: string; raw: unknown };
  weChose: { reason: string; matchType: "exact" | "semantic" };
}

export interface GiftCard {
  pick: QlooPick;
  gift: GiftMatch | null;                  // null => NO_GIFT_MATCH labeled state
  provenance: Provenance;
  // null = narration not yet fetched / 0G unavailable. The lazy /api/narrate route fills it with
  // REAL 0G prose or leaves it null on honest failure (no-fallback directive). The card renders
  // fully from the real Qloo pick/receipt regardless — narration is additive.
  narration: string | null;
}

export interface Seed { id: string; label: string; signal: QlooSignal; }

// DEPTH-PASS A+B — the observable agent trail. Each fan-out leg names the domain the agent chose,
// how many picks Qloo returned for it, and the best REAL affinity it saw there (Qloo's number, never
// the agent's). The refine block records whether the loop fired, WHY (the weakness signal), and what
// the agent changed. This is the cross-domain "story" the receipt + /proof render.
export interface FanoutLeg {
  domain: QlooEntityType;
  returned: number;             // how many picks Qloo returned for this domain
  topAffinity: number | null;   // best real query.affinity in this leg (null => rank-band only)
  raw: unknown;                 // this leg's raw Qloo response (full multi-domain evidence)
}
export interface RefineTrace {
  fired: boolean;
  reason: string | null;        // the weakness signal that triggered it (null => not weak, skipped)
  action: string | null;        // what the agent changed (added tags / dropped seed / adjusted domains)
  addedTags: string[];          // tag labels the agent added on the refine hop (if any)
}
export interface AgentTrace {
  chosenDomains: QlooEntityType[];   // the 2–4 domains the agent selected (DEPTH-PASS A)
  reasoning: string | null;          // the agent's one-line rationale for the domain choice
  recipient: Recipient;              // coarse demographic/geo signals derived (DEPTH-PASS C)
  fanout: FanoutLeg[];               // per-domain parallel results (Qloo's real numbers)
  refine: RefineTrace;               // the refine-loop trail (DEPTH-PASS B)
  qlooCallCount: number;             // total Qloo calls this journey made (observability)
}

export interface GiftResponse {
  picks: GiftCard[];
  coverage: Coverage;
  seeds: Seed[];
  domain: QlooEntityType;                  // PRIMARY domain (first chosen) — kept for back-compat (/proof)
  degraded: null | "NO_QLOO_RESULT" | "NO_AFFINITY_RESULTS" | "QLOO_UNREACHABLE" | "EXTRACTION_UNAVAILABLE";
  raw: unknown;                            // the PRIMARY domain's real Qloo response (for /proof)
  agent?: AgentTrace;                      // DEPTH-PASS: multi-domain + refine observability (additive)
}

// State tokens (INVARIANTS.md) — returned on disallowed/empty paths, never a fabrication.
export const TOKENS = {
  NO_QLOO_RESULT: "NO_QLOO_RESULT",
  EXTRACTION_UNAVAILABLE: "EXTRACTION_UNAVAILABLE",
  NO_AFFINITY_RESULTS: "NO_AFFINITY_RESULTS",
  QLOO_UNREACHABLE: "QLOO_UNREACHABLE",
  INVALID_PARAM: "INVALID_PARAM",
  PII_BLOCKED: "PII_BLOCKED",
  RANK_BAND_ONLY: "RANK_BAND_ONLY",
  EXPLAINABILITY_ABSENT: "EXPLAINABILITY_ABSENT",
  NO_GIFT_MATCH: "NO_GIFT_MATCH",
  ACTION_UNAVAILABLE: "ACTION_UNAVAILABLE",
} as const;
