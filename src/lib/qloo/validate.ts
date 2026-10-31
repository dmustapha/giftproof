// File: src/lib/qloo/validate.ts
import { z } from "zod";
import { QLOO_ENTITY_TYPES, QLOO_AGE_BUCKETS, QLOO_GENDERS, TOKENS } from "@/lib/types";

// Allow-list of EVERY param we send. Qloo silently ignores unknown params (no 4xx),
// so we reject anything off-list BEFORE the call — our only defense (INVARIANTS NN-5).
const ALLOWED_INSIGHTS_PARAMS = new Set([
  "filter.type", "signal.interests.entities", "signal.interests.tags",
  "signal.demographics.age", "signal.demographics.gender",
  "filter.popularity.min", "filter.popularity.max", "filter.price_level",
  "bias.content_based", "bias.trends", "diversify.by", "diversify.take",
  "feature.explainability", "take", "page",
]);

export function assertInsightsParams(params: Record<string, string>): void {
  for (const k of Object.keys(params)) {
    if (!ALLOWED_INSIGHTS_PARAMS.has(k)) throw new Error(`${TOKENS.INVALID_PARAM}: ${k}`);
  }
  if (!params["filter.type"]) throw new Error(`${TOKENS.INVALID_PARAM}: filter.type required`);
  if (!QLOO_ENTITY_TYPES.includes(params["filter.type"] as never))
    throw new Error(`${TOKENS.INVALID_PARAM}: filter.type not a known URN`);
  // DEPTH-PASS C: Qloo SILENTLY ignores an unknown demographic bucket (no 4xx), so a mis-spelled
  // age/gender would be dropped invisibly and the receipt would over-claim a demographic signal that
  // never applied. Reject off-list buckets BEFORE the call so only VERIFIED values reach Qloo (NN-5).
  const age = params["signal.demographics.age"];
  if (age !== undefined && !QLOO_AGE_BUCKETS.includes(age as never))
    throw new Error(`${TOKENS.INVALID_PARAM}: age bucket "${age}" not a known Qloo bracket`);
  const gender = params["signal.demographics.gender"];
  if (gender !== undefined && !QLOO_GENDERS.includes(gender as never))
    throw new Error(`${TOKENS.INVALID_PARAM}: gender "${gender}" not male|female`);
}

// A result is usable only if it has entities AND at least one affinity-or-rank signal.
export function assertAffinityBearing(results: Array<{ entity_id?: string }>): void {
  if (!Array.isArray(results) || results.length === 0) throw new Error(TOKENS.NO_AFFINITY_RESULTS);
}

// Strip anything that looks like a recipient contact OR a recipient-descriptor/person-name
// fragment before it can seed Qloo (INVARIANTS NN-2, PII_BLOCKED). This is the DETERMINISTIC
// floor: it must hold even when the LLM extractor is down and the naive splitter feeds raw
// sentence fragments through (see extract.ts fallback). It drops (a) emails, (b) fragments that
// begin with a recipient possessive/verb lead ("my ", "her ", "his ", "their ", "for my"),
// and (c) bare capitalized person-name tokens that carry no taste noun. Returning null routes
// the fragment to the PII_BLOCKED token path (it becomes a Coverage miss, never an outbound signal).
export const EmailRe = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const RecipientLeadRe = /^(my|her|his|their|our|your|for my|for her|for his|for their)\b/i;
// A bare person-name fragment: 2–3 capitalized word tokens ("Jane Doe"), no lowercase taste noun.
// DEV-006: the ARCHITECTURE regex allowed {0,2} trailing tokens, so a SINGLE capitalized word
// ("Succession", "Diptyque") was wrongly dropped as a person name — contradicting the spec's own
// verbatim stripPII test ("Succession" must pass). A recipient name needs first+last, so require
// {1,2} trailing tokens: "Jane Doe" still drops (NN-2), single-word taste names pass.
const BarePersonNameRe = /^(?:[A-Z][a-z]+)(?:\s+[A-Z][a-z]+){1,2}$/;
export function stripPII(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (EmailRe.test(trimmed)) return null;              // never forward an email
  if (RecipientLeadRe.test(trimmed)) return null;      // "my sister loves ..." style lead = recipient descriptor
  if (BarePersonNameRe.test(trimmed)) return null;     // "Jane Doe" with no taste noun = recipient name
  return trimmed;                                      // taste names (shows/brands/places) pass
}
