// File: src/lib/qloo/alias.ts
// Deterministic noun-phrase split + PII floor. USER DIRECTIVE 2026-10-29 (no-fallback): this is NO
// LONGER wired as an extraction path — the 0G LLM is the SOLE sentence→tastes extractor (see
// src/lib/llm/extract.ts). This helper is retained only as a self-contained PII-floor reference
// (exercised by alias.test.ts to prove stripPII drops recipient leads and emails independently of
// the LLM). It is NOT imported by the orchestrator. Entity-ID resolution of an already-named taste
// lives in src/lib/qloo/resolve.ts (Qloo /search + /v2/tags), which the LLM feeds — that remains
// the legitimate deterministic resolution aid the directive permits.
import { stripPII } from "@/lib/qloo/validate";
import type { CandidateTaste } from "@/lib/types";

export function aliasTableExtract(sentence: string): CandidateTaste[] {
  return sentence.split(/,| and | & /).map((s) => s.trim()).filter(Boolean)
    .map((frag) => stripPII(frag))
    .filter((frag): frag is string => frag !== null)
    .map((name) => ({ name, raw: name, domainGuess: "unknown" as const }));
}
