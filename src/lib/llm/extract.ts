// File: src/lib/llm/extract.ts
// LLM EXTRACTS taste names only. It NEVER ranks or scores gifts (INVARIANTS NN-1).
// Provider: 0G Compute Router (OpenAI-compatible chat-completions) — the SOLE extraction brain.
// USER DIRECTIVE 2026-10-29 (no-fallback): the minimal-LLM / curated-alias-table fallback is
// REMOVED from normal operation. The 0G LLM is the only path that turns a sentence into tastes.
// If 0G is unreachable we FAIL HONESTLY (throw) rather than silently substitute a regex/alias
// extraction and pass it off as the agent's work. The alias table survives ONLY downstream as a
// deterministic entity-ID resolution aid (src/lib/qloo/resolve.ts), never as a sentence extractor.
import { stripPII } from "@/lib/qloo/validate";
import { llmConfigured, chatJSON, chatJSONLong } from "@/lib/llm/client";
import { cacheKey, cacheGet, cacheSet } from "@/lib/infra/cache";
import {
  GIFT_DOMAINS, QLOO_AGE_BUCKETS, QLOO_GENDERS,
  type AgentPlan, type CandidateTaste, type QlooAgeBucket, type QlooEntityType,
  type QlooGender, type Recipient,
} from "@/lib/types";

// Thrown when the sole 0G extraction path is unavailable/failed. Callers surface this as an honest
// error/degraded state — they must NEVER fall back to a fabricated non-LLM extraction.
export class ExtractionUnavailableError extends Error {
  constructor(cause: string) {
    super(`EXTRACTION_UNAVAILABLE: ${cause}`);
    this.name = "ExtractionUnavailableError";
  }
}

const SYS = `Extract every public TASTE SIGNAL in the sentence. A taste signal is either:
(1) a NAMED entity — a specific show, film, artist, band, brand, book, game, podcast, place, destination; or
(2) a GENRE, HOBBY, ACTIVITY or INTEREST — e.g. "jazz", "woodworking", "rock climbing", "specialty coffee",
"sci-fi", "indie music", "hiking". These are real cultural-taste signals (Qloo resolves them as tags), so
ALWAYS include them — do not drop a taste just because it is a genre/activity rather than a proper noun.
Return ONLY a JSON array of {name, domainGuess} where name is the concise taste term (e.g. "jazz", not
"jazz records") and domainGuess is one of
urn:entity:tv_show|movie|artist|brand|book|video_game|podcast|place|destination|person or "unknown".
Use "unknown" for genres/activities. Do NOT include person names used as the recipient (e.g. "my sister",
"Jane", "my dad", "my coworker"). Do NOT invent tastes not present in the sentence.`;

function parseTastes(text: string): Array<{ name?: string; domainGuess?: string }> {
  // Tolerant parse: strip ```json fences, accept a raw array or {tastes:[...]}.
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed?.tastes) ? parsed.tastes : [];
}

export async function extractTastes(sentence: string): Promise<CandidateTaste[]> {
  // No-fallback: with no key configured there is NO extraction path. Fail honestly.
  if (!llmConfigured()) throw new ExtractionUnavailableError("0G key not configured");
  // E-2 latency: the 0G extraction call is the cold-path's single largest cost (~4.5s). Cache the
  // extracted tastes by sentence so a repeated sentence (demo replays, swap re-submits, the 3
  // canonical journeys) skips the LLM round-trip entirely. Deterministic result for a given input.
  const ckey = cacheKey({ op: "extract", sentence });
  const cached = cacheGet<CandidateTaste[]>(ckey);
  if (cached !== undefined) return cached;
  let text: string;
  try {
    text = await chatJSON(
      SYS,
      `Sentence: ${sentence}\nReturn JSON: {"tastes":[{name, domainGuess}]}`,
    );
  } catch (e) {
    // No silent substitution: surface the 0G failure so the route returns an honest degraded state.
    throw new ExtractionUnavailableError(String((e as Error).message));
  }
  const tastes = parseTastes(text)
    // CRITICAL (NN-2): the LLM might echo a recipient name — the deterministic PII floor must
    // still hold, so route EVERY extracted name through stripPII and drop nulls.
    .map((t) => {
      const name = typeof t.name === "string" ? stripPII(t.name) : null;
      if (name === null) return null;
      const domainGuess: QlooEntityType | "unknown" =
        t.domainGuess?.startsWith("urn:entity:") ? (t.domainGuess as QlooEntityType) : "unknown";
      return { name, raw: name, domainGuess };
    })
    .filter((t): t is CandidateTaste => t !== null);
  cacheSet(ckey, tastes);
  return tastes;
}

// DEPTH-PASS A+C — the agent's PLAN prompt. One 0G reasoning pass turns the sentence into: the taste
// signals (as before), the 2–4 GIFT DOMAINS that best fit the recipient (agent reasoning over the
// tastes — NOT a hardcoded brand default), and the coarse recipient demographic/geo cues. The agent
// NEVER ranks or scores gifts here (NN-1: Qloo ranks) — it only SELECTS which domains to ask Qloo for.
const GIFTABLE = GIFT_DOMAINS.map((d) => d.replace("urn:entity:", "")).join("|"); // brand|place|book|movie|video_game|podcast
const PLAN_SYS = `You are a gift-strategy agent. Read ONE sentence about a gift RECIPIENT and output a plan.

Return ONLY JSON: {"tastes":[{"name","domainGuess"}], "targetDomains":[...], "reasoning":"...", "recipient":{"age","gender","place"}}

tastes — every public TASTE SIGNAL in the sentence:
 (1) a NAMED entity (show, film, artist, band, brand, book, game, podcast, place); or
 (2) a GENRE/HOBBY/ACTIVITY/INTEREST ("jazz","woodworking","rock climbing","specialty coffee","sci-fi","hiking").
 ALWAYS include genres/activities — Qloo resolves them as tags. name = concise term ("jazz", not "jazz records").
 domainGuess = one of urn:entity:tv_show|movie|artist|brand|book|video_game|podcast|place|destination|person or "unknown".

targetDomains — choose 2 to 4 GIFT domains that best fit THIS recipient, ordered best-first. Each MUST be one of:
 ${GIFTABLE}. REASON from the tastes (e.g. a reader -> book; a gamer -> video_game; a foodie/traveller -> place;
 a design/skincare lover -> brand; a cinephile -> movie; a commuter/learner -> podcast). Do NOT just default to brand.

reasoning — ONE short sentence explaining the domain choice (for the receipt).

recipient — coarse buckets ONLY, each null if the sentence gives no cue (NEVER guess, NEVER output a name/email):
 age    = one of ${QLOO_AGE_BUCKETS.join("|")} or null (map "a kid/teen/20s" -> 35_and_younger, "middle-aged/40s/50s" -> 36_to_55, "retired/senior/60s+" -> 55_and_older).
 gender = "male"|"female"|null (ONLY if the sentence clearly states it, e.g. "my brother"->male, "my sister"->female; "my coworker"/"my friend"->null).
 place  = a short place LABEL if the sentence names one ("Tokyo","Portland","the Pacific Northwest") else null. NEVER an address.

Do NOT invent tastes/domains/demographics not supported by the sentence. Do NOT include the recipient's name.`;

// Tolerant plan parse: strip ```json fences; if the whole thing isn't clean JSON, extract the first
// balanced {...} object (the model sometimes wraps the JSON in prose). Returns null if nothing parses.
function parsePlanObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const p = JSON.parse(s);
      return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch { return null; }
  };
  const extractBraced = (s: string): string | null => {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    return start >= 0 && end > start ? s.slice(start, end + 1) : null;
  };
  // Attempt 1: parse as-is.
  const direct = tryParse(cleaned);
  if (direct) return direct;
  // Attempt 2: extract the first balanced {...} (the model sometimes wraps JSON in prose).
  const braced = extractBraced(cleaned);
  if (braced) {
    const p = tryParse(braced);
    if (p) return p;
    // Attempt 3: gemini-2.5-flash occasionally injects RAW newlines/tabs mid-token ("t\nastes",
    // "Succession\n") which breaks JSON.parse (observed live 2026-10-30, ~5/8 raw completions). A VALID
    // JSON string can never contain a literal control char (it must be escaped as \n), so stripping all
    // raw \n\r\t from the braced candidate removes only the model's corruption and recovers the real
    // object — pretty-printing whitespace is between tokens and safe to drop too.
    const p2 = tryParse(braced.replace(/[\n\r\t]+/g, ""));
    if (p2) return p2;
  }
  return null;
}

function toDomain(s: unknown): QlooEntityType | null {
  if (typeof s !== "string") return null;
  const urn = s.startsWith("urn:entity:") ? s : `urn:entity:${s.trim()}`;
  return (GIFT_DOMAINS as string[]).includes(urn) ? (urn as QlooEntityType) : null;
}
function toAge(s: unknown): QlooAgeBucket | null {
  return typeof s === "string" && (QLOO_AGE_BUCKETS as readonly string[]).includes(s) ? (s as QlooAgeBucket) : null;
}
function toGender(s: unknown): QlooGender | null {
  return typeof s === "string" && (QLOO_GENDERS as readonly string[]).includes(s) ? (s as QlooGender) : null;
}
function toPlace(s: unknown): string | null {
  // Place is a coarse LABEL carried for the receipt; run it through the PII floor anyway so a stray
  // "123 Main St, <name>'s house" can never ride through as a place (NN-2 defense in depth).
  if (typeof s !== "string" || !s.trim()) return null;
  const safe = stripPII(s.trim());
  return safe && safe.length <= 60 ? safe : null;
}

export async function extractPlan(sentence: string): Promise<AgentPlan> {
  if (!llmConfigured()) throw new ExtractionUnavailableError("0G key not configured");
  const ckey = cacheKey({ op: "plan", sentence });
  const cached = cacheGet<AgentPlan>(ckey);
  if (cached !== undefined) return cached;
  // One parse-retry: gemini-2.5-flash occasionally returns a 200 whose content is reasoning-only or
  // malformed JSON (a transient model quirk, observed live 2026-10-30). A single re-ask on the SAME 0G
  // request is the standard cure — still the sole 0G path, no template/alias substitution. A second
  // failure throws ExtractionUnavailableError and the route surfaces an honest degraded state.
  let parsed: Record<string, unknown> | null = null;
  let lastErr = "plan JSON unparseable";
  for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
    let text: string;
    try {
      text = await chatJSONLong(PLAN_SYS, `Sentence: ${sentence}\nReturn the plan JSON.`);
    } catch (e) {
      lastErr = String((e as Error).message);
      continue;
    }
    const p = parsePlanObject(text);
    if (p) parsed = p; else lastErr = "plan JSON unparseable";
  }
  if (parsed === null) throw new ExtractionUnavailableError(lastErr);

  const rawTastes = Array.isArray(parsed.tastes) ? (parsed.tastes as Array<{ name?: string; domainGuess?: string }>) : [];
  const tastes: CandidateTaste[] = rawTastes
    .map((t) => {
      const name = typeof t.name === "string" ? stripPII(t.name) : null;  // NN-2 floor on every name
      if (name === null) return null;
      const domainGuess: QlooEntityType | "unknown" =
        t.domainGuess?.startsWith("urn:entity:") ? (t.domainGuess as QlooEntityType) : "unknown";
      return { name, raw: name, domainGuess } as CandidateTaste;
    })
    .filter((t): t is CandidateTaste => t !== null);

  // Validate/clamp the agent's domain choice to 2–4 KNOWN giftable domains. If the agent returned
  // junk/too-few, fall back to a taste-informed default set (never leave it empty — Qloo must rank).
  const picked = Array.isArray(parsed.targetDomains) ? parsed.targetDomains : [];
  const seen = new Set<string>();
  let targetDomains: QlooEntityType[] = [];
  for (const d of picked) {
    const dom = toDomain(d);
    if (dom && !seen.has(dom)) { seen.add(dom); targetDomains.push(dom); }
    if (targetDomains.length >= 4) break;
  }
  if (targetDomains.length < 2) targetDomains = defaultDomains(tastes, targetDomains, seen);

  const r = (parsed.recipient && typeof parsed.recipient === "object") ? parsed.recipient as Record<string, unknown> : {};
  const recipient: Recipient = { age: toAge(r.age), gender: toGender(r.gender), place: toPlace(r.place) };
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 200) : null;

  const plan: AgentPlan = { tastes, targetDomains, recipient, reasoning };
  cacheSet(ckey, plan);
  return plan;
}

// Deterministic default domain set from the tastes' domain guesses, topped up to >=2 from GIFT_DOMAINS.
// Qloo must always have >=2 domains to rank — this guards the rare case the agent returns too few.
function defaultDomains(tastes: CandidateTaste[], start: QlooEntityType[], seen: Set<string>): QlooEntityType[] {
  const out = [...start];
  for (const t of tastes) {
    if (out.length >= 2) break;
    const dom = toDomain(t.domainGuess);
    if (dom && !seen.has(dom)) { seen.add(dom); out.push(dom); }
  }
  for (const d of GIFT_DOMAINS) {
    if (out.length >= 2) break;
    if (!seen.has(d)) { seen.add(d); out.push(d); }
  }
  return out;
}
