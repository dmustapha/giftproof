// File: src/lib/orchestrate.ts
// DEPTH PASS (2026-10-30): the pipeline is now an AGENT LOOP, not a single-pass call.
//   A. Multi-domain cross-ranking — the 0G agent SELECTS 2–4 gift domains from the tastes, we fan
//      rankGifts out across them IN PARALLEL (Promise.all, bounded by the Semaphore(2) in client.ts),
//      then SELECT the best cross-domain picks BY QLOO'S REAL query.affinity (Qloo's numbers decide
//      the order — the agent never invents a ranking; NN-1).
//   B. Agentic refine loop — the agent inspects the first ranking's sharpness (weakness gate) and, if
//      weak, refines the signal set (adds a Qloo tag / adjusts domains) and RE-QUERIES. Capped at ONE
//      round, fired only behind the weakness gate so sharp first results skip it (E-2 latency).
//   C. Demographics + geo — extractPlan derives coarse recipient buckets fed into rankGifts (NN-2).
//   D. Cross-domain explainability — buildProvenance names WHICH seed taste drove each pick, across
//      the fan-out (real query.explainability, never fabricated; NN-3).
// 0G is the SOLE LLM path (no template/alias fallback). Deleting the Qloo call yields EMPTY picks.
import { extractPlan, ExtractionUnavailableError } from "./llm/extract";
import { resolveSignals, searchTagSignal } from "./qloo/resolve";
import { rankGifts } from "./qloo/insights";
import { resolveGift } from "./gift/resolve";
import { resolveProductUrl } from "./gift/product";
import { buildProvenance } from "./qloo/provenance";
import {
  GIFT_DOMAINS, TOKENS,
  type AgentTrace, type FanoutLeg, type GiftCard, type GiftResponse, type QlooEntityType,
  type QlooPick, type QlooSignal, type RankedResult, type Recipient, type RefineTrace, type Seed,
} from "@/lib/types";

// ASYNC enrichment pass (DEPTH-PASS, external APIs — NOT 0G/Qloo). After picks+gifts are built on the
// guaranteed search baseline, resolve each pick to its ACTUAL product page IN PARALLEL and UPGRADE the
// gift (buyUrl/provider/title + matchType "exact" = a specific product resolved). resolveProductUrl
// never throws and returns null on miss/low-confidence/timeout → that pick keeps its search fallback
// (matchType "semantic"). Wrapped so a TOTAL failure just leaves every search url intact — this pass
// must never block or break the existing degrade paths. Mutates cards in place; returns them.
async function enrichBuyUrls(cards: GiftCard[], coverage: GiftResponse["coverage"]): Promise<GiftCard[]> {
  await Promise.allSettled(cards.map(async (card) => {
    if (!card.gift) return;                 // NO_GIFT_MATCH stays as-is
    if (card.gift.matchType === "exact") return; // a real catalog product — never clobber it
    const t = await resolveProductUrl(card.pick.name, card.pick.type);
    if (!t) return;                         // miss → keep search fallback + "semantic"
    card.gift = { ...card.gift, buyUrl: t.buyUrl, provider: t.provider, title: t.title, matchType: "exact" };
    // Rebuild the receipt so weChose.matchType/reason stay consistent with the upgraded gift (honesty).
    card.provenance = buildProvenance(card.pick, card.gift, coverage);
  }));
  return cards;
}

function seedsFromSignals(signals: QlooSignal[]): Seed[] {
  return signals.map((s, i) => ({ id: `s${i}`, label: s.label, signal: s }));
}

// Weakness heuristic (DEPTH-PASS B gate): the first ranking is "weak" — worth a refine hop — when the
// best pick's real affinity is low OR picks carry too few explainability contributors (generic picks,
// the intel "single-seed = broad picks" caveat). A sharp first result returns null and SKIPS the loop.
const WEAK_AFFINITY = 0.6;
function weaknessSignal(picks: QlooPick[]): string | null {
  if (picks.length === 0) return "no picks returned";
  const affinities = picks.map((p) => p.affinity).filter((a): a is number => a !== null);
  const topAff = affinities.length ? Math.max(...affinities) : null;
  const withContribs = picks.filter((p) => p.explain.some((e) => e.label)).length;
  if (topAff !== null && topAff < WEAK_AFFINITY) return `top affinity ${topAff.toFixed(2)} < ${WEAK_AFFINITY}`;
  if (withContribs < 2) return `only ${withContribs} pick(s) carry explainability contributors`;
  return null;
}

function topAffinityOf(r: RankedResult): number | null {
  const a = r.picks.map((p) => p.affinity).filter((x): x is number => x !== null);
  return a.length ? Math.max(...a) : null;
}

// Run one parallel fan-out across the chosen domains. Each leg is an independent rankGifts call; the
// Semaphore(2) in the Qloo client bounds real in-flight calls to 2, so this respects the 5 req/s limit
// while cutting wall-clock vs serial. A per-leg failure degrades that leg to empty (labeled), never the
// whole journey — as long as ONE leg returns picks, Qloo still produced the ranking (NN-1).
async function fanOut(
  signals: QlooSignal[],
  domains: QlooEntityType[],
  recipient: Recipient,
  take: number,
): Promise<{ legs: Array<{ domain: QlooEntityType; result: RankedResult | null }>; calls: number }> {
  const settled = await Promise.all(
    domains.map(async (domain) => {
      try {
        const result = await rankGifts(signals, domain, { take, recipient });
        return { domain, result };
      } catch {
        return { domain, result: null as RankedResult | null };
      }
    }),
  );
  return { legs: settled, calls: domains.length };
}

// Merge fan-out legs into ONE cross-domain ranking ORDERED BY QLOO'S REAL AFFINITY (Qloo decides),
// with a light diversity pass so the grid spans domains rather than one domain dominating. Picks with a
// real affinity sort by it desc; picks with null affinity fall back to their in-leg rank position. The
// agent NEVER re-scores — it only interleaves Qloo's already-scored picks across domains.
function mergeCrossDomain(
  legs: Array<{ domain: QlooEntityType; result: RankedResult | null }>,
  limit: number,
): QlooPick[] {
  const byDomain = new Map<QlooEntityType, QlooPick[]>();
  for (const leg of legs) {
    if (!leg.result) continue;
    // sort each leg by real affinity desc, nulls last (keep Qloo's rank order among nulls)
    const sorted = [...leg.result.picks].sort((a, b) => {
      if (a.affinity !== null && b.affinity !== null) return b.affinity - a.affinity;
      if (a.affinity !== null) return -1;
      if (b.affinity !== null) return 1;
      return a.rankPosition - b.rankPosition;
    });
    byDomain.set(leg.domain, sorted);
  }
  // Round-robin across domains (diversity) but always emitting the current best-affinity head globally,
  // so Qloo's numbers set the order while no single domain monopolizes the grid.
  const heads = new Map<QlooEntityType, number>();
  for (const d of byDomain.keys()) heads.set(d, 0);
  const out: QlooPick[] = [];
  const seen = new Set<string>();
  while (out.length < limit) {
    let bestDomain: QlooEntityType | null = null;
    let bestPick: QlooPick | null = null;
    for (const [domain, picks] of byDomain) {
      const i = heads.get(domain)!;
      if (i >= picks.length) continue;
      const cand = picks[i];
      // Prefer real-affinity picks; among them the highest affinity; nulls only when no real left.
      if (!bestPick) { bestDomain = domain; bestPick = cand; continue; }
      const ca = cand.affinity, ba = bestPick.affinity;
      if (ca !== null && ba === null) { bestDomain = domain; bestPick = cand; }
      else if (ca !== null && ba !== null && ca > ba) { bestDomain = domain; bestPick = cand; }
    }
    if (!bestDomain || !bestPick) break;
    heads.set(bestDomain, heads.get(bestDomain)! + 1);
    const id = `${bestPick.type}:${bestPick.entityId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(bestPick);
  }
  return out;
}

export async function runGift(sentence: string): Promise<GiftResponse> {
  // 0G-only (no-fallback): extraction/planning is 0G. On 0G failure we surface an HONEST degraded state
  // — never a curated-alias substitution that fakes agentic work.
  let plan;
  try { plan = await extractPlan(sentence); }
  catch (e) {
    if (e instanceof ExtractionUnavailableError) return degradedResponse(TOKENS.EXTRACTION_UNAVAILABLE);
    throw e;
  }
  // Resolving tastes to Qloo signals is itself a Qloo call (/search + /v2/tags). If Qloo is down/keyless
  // this throws — degrade HONESTLY to QLOO_UNREACHABLE with EMPTY picks (kill-test: the LLM never fills
  // the ranking; deleting Qloo yields no picks, never an LLM-fabricated list — NN-1).
  let signals: QlooSignal[];
  let coverage: GiftResponse["coverage"];
  try { ({ signals, coverage } = await resolveSignals(plan.tastes)); }
  catch {
    return { ...emptyBase(plan.targetDomains), degraded: TOKENS.QLOO_UNREACHABLE,
      agent: baseTrace(plan.targetDomains, plan.reasoning, plan.recipient, [], notRefined(), 0) };
  }
  let qlooCalls = coverage.total; // /search + /v2/tags attempts during resolveSignals (one per taste leg)
  if (signals.length === 0) {
    return { ...emptyBase(plan.targetDomains), coverage, degraded: TOKENS.NO_QLOO_RESULT,
      agent: baseTrace(plan.targetDomains, plan.reasoning, plan.recipient, [], notRefined(), qlooCalls) };
  }

  // A — PARALLEL fan-out across the agent's chosen domains.
  const { legs, calls } = await fanOut(signals, plan.targetDomains, plan.recipient, 12);
  qlooCalls += calls;
  let fanoutLegs = legs;

  // B — weakness-gated refine (ONE round). Judge sharpness from the merged first ranking.
  const firstMerged = mergeCrossDomain(fanoutLegs, 12);
  const weakness = weaknessSignal(firstMerged);
  let refine: RefineTrace = notRefined();
  let refineSignals = signals;
  if (weakness) {
    // The agent refines by ADDING a Qloo tag derived from the strongest resolved taste label — this
    // sharpens a broad single-seed query (intel caveat) WITHOUT inventing a ranking. If no new tag
    // resolves, the loop records that it fired-but-could-not-sharpen (honest, still bounded to 1 round).
    const added = await deriveRefineTag(signals);
    qlooCalls += 1; // the /v2/tags resolution attempt
    if (added) {
      refineSignals = [...signals, added];
      const re = await fanOut(refineSignals, plan.targetDomains, plan.recipient, 12);
      qlooCalls += re.calls;
      const reMerged = mergeCrossDomain(re.legs, 12);
      // Keep the refined result only if it is actually sharper (higher top affinity); else keep first.
      const first = firstMerged.map((p) => p.affinity).filter((x): x is number => x !== null);
      const next = reMerged.map((p) => p.affinity).filter((x): x is number => x !== null);
      const firstTop = first.length ? Math.max(...first) : 0;
      const nextTop = next.length ? Math.max(...next) : 0;
      if (nextTop >= firstTop) fanoutLegs = re.legs;
      refine = { fired: true, reason: weakness, action: `added Qloo tag "${added.label}" and re-queried; kept ${nextTop >= firstTop ? "refined" : "first"} result`, addedTags: [added.label] };
    } else {
      refine = { fired: true, reason: weakness, action: "no sharper tag resolved; kept first result", addedTags: [] };
    }
  }

  const merged = mergeCrossDomain(fanoutLegs, 12);
  if (merged.length === 0) {
    // Every leg empty/failed => Qloo produced nothing usable. Honest degraded token, never LLM-filled.
    const anyFailed = fanoutLegs.some((l) => l.result === null);
    const token = anyFailed ? TOKENS.QLOO_UNREACHABLE : TOKENS.NO_AFFINITY_RESULTS;
    return { ...emptyBase(plan.targetDomains), coverage, seeds: seedsFromSignals(refineSignals),
      degraded: token, agent: traceFromLegs(plan, fanoutLegs, refine, qlooCalls) };
  }

  const res = buildResponse(merged, fanoutLegs, coverage, seedsFromSignals(refineSignals), plan, refine, qlooCalls);
  try { await enrichBuyUrls(res.picks, coverage); } catch { /* external APIs best-effort — keep search urls */ }
  return res;
}

export async function runSwap(seeds: Seed[]): Promise<GiftResponse> {
  const signals = seeds.map((s) => s.signal);
  const coverage = { resolved: signals.length, total: signals.length, misses: [] };
  // Swap carries no recipient/plan (the UI only round-trips resolved seeds), so we fan out across a
  // sensible default domain set and let Qloo's affinities re-decide the grid — the live-recompute hero.
  const domains = GIFT_DOMAINS.slice(0, 3);
  const recipient: Recipient = { age: null, gender: null, place: null };
  let qlooCalls = 0;
  const { legs, calls } = await fanOut(signals, domains, recipient, 12);
  qlooCalls += calls;
  const merged = mergeCrossDomain(legs, 12);
  const plan = { tastes: [], targetDomains: domains, recipient, reasoning: "re-ranked from swapped seeds across domains" };
  if (merged.length === 0) {
    const anyFailed = legs.some((l) => l.result === null);
    const token = anyFailed ? TOKENS.QLOO_UNREACHABLE : TOKENS.NO_AFFINITY_RESULTS;
    return { ...emptyBase(domains), coverage, seeds, degraded: token, agent: traceFromLegs(plan, legs, notRefined(), qlooCalls) };
  }
  const res = buildResponse(merged, legs, coverage, seeds, plan, notRefined(), qlooCalls);
  try { await enrichBuyUrls(res.picks, coverage); } catch { /* external APIs best-effort — keep search urls */ }
  return res;
}

// ── assembly helpers ──────────────────────────────────────────────────────────────────────────────
function notRefined(): RefineTrace { return { fired: false, reason: null, action: null, addedTags: [] }; }

function emptyBase(domains: QlooEntityType[]): GiftResponse {
  const domain = domains[0] ?? GIFT_DOMAINS[0];
  return { picks: [], coverage: { resolved: 0, total: 0, misses: [] }, seeds: [], domain, degraded: null, raw: null };
}
function degradedResponse(token: GiftResponse["degraded"]): GiftResponse {
  return { ...emptyBase([GIFT_DOMAINS[0]]), degraded: token };
}

function toFanoutLegs(legs: Array<{ domain: QlooEntityType; result: RankedResult | null }>): FanoutLeg[] {
  return legs.map((l) => ({
    domain: l.domain,
    returned: l.result?.picks.length ?? 0,
    topAffinity: l.result ? topAffinityOf(l.result) : null,
    raw: l.result?.raw ?? null,
  }));
}
function baseTrace(
  chosenDomains: QlooEntityType[], reasoning: string | null, recipient: Recipient,
  fanout: FanoutLeg[], refine: RefineTrace, qlooCallCount: number,
): AgentTrace {
  return { chosenDomains, reasoning, recipient, fanout, refine, qlooCallCount };
}
function traceFromLegs(
  plan: { targetDomains: QlooEntityType[]; reasoning: string | null; recipient: Recipient },
  legs: Array<{ domain: QlooEntityType; result: RankedResult | null }>, refine: RefineTrace, calls: number,
): AgentTrace {
  return baseTrace(plan.targetDomains, plan.reasoning, plan.recipient, toFanoutLegs(legs), refine, calls);
}

function buildResponse(
  merged: QlooPick[],
  legs: Array<{ domain: QlooEntityType; result: RankedResult | null }>,
  coverage: GiftResponse["coverage"],
  seeds: Seed[],
  plan: { targetDomains: QlooEntityType[]; reasoning: string | null; recipient: Recipient },
  refine: RefineTrace,
  qlooCalls: number,
): GiftResponse {
  // Narration stays lazy (null here) — the UI fills real 0G prose via /api/narrate (E-2 off-path).
  const picks = merged.map((pick) => {
    const gift = resolveGift(pick);
    const provenance = buildProvenance(pick, gift, coverage);
    return { pick, gift, provenance, narration: null };
  });
  // Primary domain + raw kept for back-compat (/proof reads response.domain + response.raw): use the
  // leg that actually drove the #1 pick so /proof shows the response behind the top card.
  const primaryDomain = merged[0]?.type ?? plan.targetDomains[0] ?? GIFT_DOMAINS[0];
  const primaryLeg = legs.find((l) => l.domain === primaryDomain) ?? legs.find((l) => l.result);
  return {
    picks, coverage, seeds, domain: primaryDomain, degraded: null,
    raw: primaryLeg?.result?.raw ?? null,
    agent: traceFromLegs(plan, legs, refine, qlooCalls),
  };
}

// DEPTH-PASS B helper — derive a Qloo TAG to sharpen a broad query, from the strongest entity seed's
// label. Returns a resolved tag signal (via /v2/tags) or null if nothing new resolves. This is the
// agent "adding signal.interests.tags" per the spec — it never fabricates a ranking.
async function deriveRefineTag(signals: QlooSignal[]): Promise<QlooSignal | null> {
  const already = new Set(signals.filter((s) => s.kind === "tag").map((s) => s.value));
  // Anchor the tag search on the strongest available signal's label — prefer an entity seed (its label
  // is a concrete name like "A24"), else fall back to the first signal (a tag-only seed's label still
  // works). This lets a broad single-seed query (entity OR tag) get a sharpening tag.
  const anchor = signals.find((s) => s.kind === "entity") ?? signals[0];
  if (!anchor) return null;
  const tag = await searchTagSignal(anchor.label);
  if (!tag || already.has(tag.value)) return null;
  return tag;
}
