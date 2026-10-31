// File: src/__tests__/orchestrate.test.ts
// DEPTH PASS: orchestrate is now an AGENT LOOP (extractPlan -> resolveSignals -> parallel fan-out
// -> cross-domain merge by real affinity -> weakness-gated refine). These tests drive that loop with
// mocked boundaries so no live key is needed, and assert the four depth behaviors:
//   A. the agent's chosen domains are fanned out in parallel and the grid is ordered by Qloo affinity
//   B. the refine loop fires ONLY behind the weakness gate (and is skipped for sharp first results)
//   C. the recipient demographics flow into rankGifts
//   D. cross-domain explainability is carried into each pick's provenance
// Plus the invariants: 0G-only (EXTRACTION_UNAVAILABLE), empty signals (NO_QLOO_RESULT), Qloo-empty
// (NO_AFFINITY_RESULTS / QLOO_UNREACHABLE), narration null on the critical path.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TOKENS, type QlooEntityType, type Recipient } from "@/lib/types";
import { ExtractionUnavailableError } from "@/lib/llm/extract";

const extractPlanMock = vi.fn();
const resolveSignalsMock = vi.fn();
const searchTagSignalMock = vi.fn();
const rankGiftsMock = vi.fn();

vi.mock("@/lib/llm/extract", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, extractPlan: (...a: unknown[]) => extractPlanMock(...a) };
});
vi.mock("@/lib/qloo/resolve", () => ({
  resolveSignals: (...a: unknown[]) => resolveSignalsMock(...a),
  searchTagSignal: (...a: unknown[]) => searchTagSignalMock(...a),
}));
vi.mock("@/lib/qloo/insights", () => ({ rankGifts: (...a: unknown[]) => rankGiftsMock(...a) }));
vi.mock("@/lib/gift/resolve", () => ({
  resolveGift: () => ({ sku: "s1", title: "T1", provider: "P", buyUrl: "https://example.com/x", matchType: "exact", matchedEntity: "N" }),
}));

import { runGift } from "@/lib/orchestrate";

const sig = (id: string, label: string) => ({ kind: "entity" as const, value: id, label, source: "search" as const });
function qlooPick(over: Record<string, unknown> = {}) {
  return {
    entityId: "x1", name: "Gift", type: "urn:entity:brand", affinity: 0.9,
    rankBand: "high", rankPosition: 1, explain: [{ entityId: "a24", label: "A24", score: 0.9 }], ...over,
  };
}
function ranked(domain: QlooEntityType, picks: Array<Record<string, unknown>>) {
  return { picks: picks.map((p) => qlooPick({ type: domain, ...p })), raw: { results: { entities: picks } }, domain };
}

beforeEach(() => {
  extractPlanMock.mockReset();
  resolveSignalsMock.mockReset();
  searchTagSignalMock.mockReset();
  rankGiftsMock.mockReset();
});

const emptyRecipient: Recipient = { age: null, gender: null, place: null };

describe("runGift — agent loop", () => {
  it("returns EXTRACTION_UNAVAILABLE (honest) when 0G planning is unavailable — no alias fallback", async () => {
    extractPlanMock.mockRejectedValue(new ExtractionUnavailableError("0G key not configured"));
    const r = await runGift("My sister loves A24");
    expect(r.degraded).toBe(TOKENS.EXTRACTION_UNAVAILABLE);
    expect(r.picks).toEqual([]);
    expect(resolveSignalsMock).not.toHaveBeenCalled();
  });

  it("returns NO_QLOO_RESULT when no signals resolve", async () => {
    extractPlanMock.mockResolvedValue({ tastes: [{ name: "x", raw: "x", domainGuess: "unknown" }], targetDomains: ["urn:entity:brand", "urn:entity:book"], recipient: emptyRecipient, reasoning: "r" });
    resolveSignalsMock.mockResolvedValue({ signals: [], coverage: { resolved: 0, total: 1, misses: ["x"] } });
    const r = await runGift("gibberish");
    expect(r.degraded).toBe(TOKENS.NO_QLOO_RESULT);
    expect(r.picks).toEqual([]);
  });

  it("A: fans out across the agent's chosen domains IN PARALLEL and orders the grid by Qloo affinity", async () => {
    extractPlanMock.mockResolvedValue({
      tastes: [{ name: "A24", raw: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["urn:entity:brand", "urn:entity:book"], recipient: emptyRecipient, reasoning: "cinephile",
    });
    resolveSignalsMock.mockResolvedValue({ signals: [sig("e-a24", "A24")], coverage: { resolved: 1, total: 1, misses: [] } });
    rankGiftsMock.mockImplementation((_s, domain: QlooEntityType) => {
      if (domain === "urn:entity:brand") return Promise.resolve(ranked(domain, [{ entityId: "b1", name: "Brand", affinity: 0.7 }]));
      return Promise.resolve(ranked(domain, [{ entityId: "k1", name: "Book", affinity: 0.95 }]));
    });
    const r = await runGift("loves A24");
    expect(r.degraded).toBeNull();
    // both domains queried (parallel fan-out)
    const calledDomains = rankGiftsMock.mock.calls.map((c) => c[1]).sort();
    expect(calledDomains).toEqual(["urn:entity:book", "urn:entity:brand"]);
    // highest real affinity leads the grid regardless of its domain (Qloo decides the order)
    expect(r.picks[0].pick.name).toBe("Book");
    expect(r.picks[0].pick.affinity).toBe(0.95);
    expect(r.agent?.chosenDomains).toEqual(["urn:entity:brand", "urn:entity:book"]);
    expect(r.agent?.fanout.map((f) => f.domain).sort()).toEqual(["urn:entity:book", "urn:entity:brand"]);
    // narration is NOT produced on the critical path (lazy)
    expect(r.picks[0].narration).toBeNull();
  });

  it("B: SKIPS the refine loop when the first ranking is sharp (high affinity + contributors)", async () => {
    extractPlanMock.mockResolvedValue({
      tastes: [{ name: "A24", raw: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["urn:entity:brand", "urn:entity:book"], recipient: emptyRecipient, reasoning: "r",
    });
    resolveSignalsMock.mockResolvedValue({ signals: [sig("e-a24", "A24")], coverage: { resolved: 1, total: 1, misses: [] } });
    rankGiftsMock.mockResolvedValue(ranked("urn:entity:brand", [
      { entityId: "b1", name: "B1", affinity: 0.92 }, { entityId: "b2", name: "B2", affinity: 0.88 },
    ]));
    const r = await runGift("loves A24");
    expect(r.agent?.refine.fired).toBe(false);
    expect(searchTagSignalMock).not.toHaveBeenCalled();
  });

  it("B: FIRES the refine loop when the first ranking is weak (low top affinity), capped at one round", async () => {
    extractPlanMock.mockResolvedValue({
      tastes: [{ name: "A24", raw: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["urn:entity:brand", "urn:entity:book"], recipient: emptyRecipient, reasoning: "r",
    });
    resolveSignalsMock.mockResolvedValue({ signals: [sig("e-a24", "A24")], coverage: { resolved: 1, total: 1, misses: [] } });
    // first pass weak (top affinity 0.4); refine adds a tag and the re-query is sharper (0.85)
    let call = 0;
    rankGiftsMock.mockImplementation((_s, domain: QlooEntityType) => {
      call += 1;
      const weak = call <= 2; // first fan-out (2 domains) weak, refined fan-out sharp
      const aff = weak ? 0.4 : 0.85;
      return Promise.resolve(ranked(domain, [{ entityId: `d${call}`, name: `G${call}`, affinity: aff }]));
    });
    searchTagSignalMock.mockResolvedValue({ kind: "tag", value: "urn:tag:indie", label: "indie", source: "tags" });
    const r = await runGift("loves A24");
    expect(r.agent?.refine.fired).toBe(true);
    expect(r.agent?.refine.reason).toMatch(/top affinity/);
    expect(r.agent?.refine.addedTags).toEqual(["indie"]);
    // one refine round only: 2 (first fan-out) + 2 (refined fan-out) = 4 rankGifts calls max
    expect(rankGiftsMock.mock.calls.length).toBe(4);
    expect(searchTagSignalMock).toHaveBeenCalledTimes(1);
  });

  it("C: feeds the derived recipient demographics into rankGifts", async () => {
    const recipient: Recipient = { age: "55_and_older", gender: "female", place: "Tokyo" };
    extractPlanMock.mockResolvedValue({
      tastes: [{ name: "A24", raw: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["urn:entity:brand", "urn:entity:book"], recipient, reasoning: "r",
    });
    resolveSignalsMock.mockResolvedValue({ signals: [sig("e-a24", "A24")], coverage: { resolved: 1, total: 1, misses: [] } });
    rankGiftsMock.mockResolvedValue(ranked("urn:entity:brand", [{ entityId: "b1", name: "B1", affinity: 0.9 }]));
    const r = await runGift("my grandmother in Tokyo loves A24");
    // the recipient is passed through to every fan-out leg
    for (const c of rankGiftsMock.mock.calls) expect((c[2] as { recipient?: Recipient }).recipient).toEqual(recipient);
    expect(r.agent?.recipient).toEqual(recipient);
  });

  it("D: carries cross-domain explainability (which seed drove the pick) into provenance", async () => {
    extractPlanMock.mockResolvedValue({
      tastes: [{ name: "A24", raw: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["urn:entity:book"], recipient: emptyRecipient, reasoning: "r",
    });
    resolveSignalsMock.mockResolvedValue({ signals: [sig("e-a24", "A24")], coverage: { resolved: 1, total: 1, misses: [] } });
    rankGiftsMock.mockResolvedValue(ranked("urn:entity:book", [
      { entityId: "k1", name: "A Book", affinity: 0.9, explain: [{ entityId: "e-a24", label: "A24", score: 1 }] },
    ]));
    const r = await runGift("loves A24");
    // the receipt names the driving seed across the domain boundary (fans of A24 -> a book)
    expect(r.picks[0].provenance.qlooSays.rankStatement).toContain("A24");
    expect(r.picks[0].provenance.qlooSays.topContributors).toContain("A24");
  });

  it("maps an all-empty fan-out to NO_AFFINITY_RESULTS (Qloo produced nothing; LLM never fills)", async () => {
    extractPlanMock.mockResolvedValue({
      tastes: [{ name: "A24", raw: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["urn:entity:brand", "urn:entity:book"], recipient: emptyRecipient, reasoning: "r",
    });
    resolveSignalsMock.mockResolvedValue({ signals: [sig("e-a24", "A24")], coverage: { resolved: 1, total: 1, misses: [] } });
    rankGiftsMock.mockResolvedValue(ranked("urn:entity:brand", [])); // every leg empty
    const r = await runGift("loves A24");
    expect(r.degraded).toBe(TOKENS.NO_AFFINITY_RESULTS);
    expect(r.picks).toEqual([]);
  });

  it("maps a thrown fan-out leg to QLOO_UNREACHABLE when no leg returns picks", async () => {
    extractPlanMock.mockResolvedValue({
      tastes: [{ name: "A24", raw: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["urn:entity:brand", "urn:entity:book"], recipient: emptyRecipient, reasoning: "r",
    });
    resolveSignalsMock.mockResolvedValue({ signals: [sig("e-a24", "A24")], coverage: { resolved: 1, total: 1, misses: [] } });
    rankGiftsMock.mockRejectedValue(new Error(`${TOKENS.QLOO_UNREACHABLE}: 429 quota`));
    const r = await runGift("loves A24");
    expect(r.degraded).toBe(TOKENS.QLOO_UNREACHABLE);
  });
});
