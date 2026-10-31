// File: src/__tests__/extract-plan.test.ts
// DEPTH PASS A+C — extractPlan parsing: the 0G agent's raw JSON is mapped to a validated AgentPlan.
// We mock the 0G client so no live key is needed and drive the parser/clamp/validation logic:
//   A. targetDomains clamped to 2–4 KNOWN giftable domains (junk dropped, too-few topped up)
//   C. recipient buckets validated (unknown age/gender -> null; place PII-floored); names never ride
// Also the no-key honest-failure path.
import { describe, it, expect, vi, beforeEach } from "vitest";

const chatJSONMock = vi.fn();
let configured = true;
vi.mock("@/lib/llm/client", () => ({
  llmConfigured: () => configured,
  // extractPlan calls chatJSONLong (the richer-plan budget); extractTastes calls chatJSON — mock both.
  chatJSON: (...a: unknown[]) => chatJSONMock(...a),
  chatJSONLong: (...a: unknown[]) => chatJSONMock(...a),
  chatText: vi.fn(),
}));
// cache is a real in-process LRU; use a unique sentence per test to avoid cross-test cache hits.
import { extractPlan, ExtractionUnavailableError } from "@/lib/llm/extract";

beforeEach(() => { chatJSONMock.mockReset(); configured = true; });

describe("extractPlan", () => {
  it("throws honestly when 0G is not configured (no fallback)", async () => {
    configured = false;
    await expect(extractPlan("unique-1 loves A24")).rejects.toBeInstanceOf(ExtractionUnavailableError);
  });

  it("A: parses tastes + clamps the agent's domain choice to known giftable domains", async () => {
    chatJSONMock.mockResolvedValue(JSON.stringify({
      tastes: [{ name: "A24", domainGuess: "urn:entity:brand" }, { name: "jazz", domainGuess: "unknown" }],
      targetDomains: ["book", "urn:entity:movie", "urn:entity:NONSENSE", "place"],
      reasoning: "a cinephile reader",
      recipient: { age: null, gender: null, place: null },
    }));
    const plan = await extractPlan("unique-2 reads and watches films");
    expect(plan.tastes.map((t) => t.name)).toEqual(["A24", "jazz"]);
    // "NONSENSE" dropped; the three valid domains kept (prefixed or bare both normalized)
    expect(plan.targetDomains).toEqual(["urn:entity:book", "urn:entity:movie", "urn:entity:place"]);
    expect(plan.reasoning).toBe("a cinephile reader");
  });

  it("A: tops up to >=2 domains when the agent returns too few", async () => {
    chatJSONMock.mockResolvedValue(JSON.stringify({
      tastes: [{ name: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["book"], recipient: {},
    }));
    const plan = await extractPlan("unique-3 loves A24");
    expect(plan.targetDomains.length).toBeGreaterThanOrEqual(2);
    expect(plan.targetDomains[0]).toBe("urn:entity:book");
  });

  it("C: validates recipient buckets — unknown age/gender become null, place is kept", async () => {
    chatJSONMock.mockResolvedValue(JSON.stringify({
      tastes: [{ name: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["brand", "book"],
      recipient: { age: "55_and_older", gender: "nonbinary-typo", place: "Tokyo" },
    }));
    const plan = await extractPlan("unique-4 grandmother in Tokyo");
    expect(plan.recipient.age).toBe("55_and_older");
    expect(plan.recipient.gender).toBeNull();       // unknown gender rejected
    expect(plan.recipient.place).toBe("Tokyo");
  });

  it("C: a recipient NAME echoed as a place is dropped by the PII floor (NN-2)", async () => {
    chatJSONMock.mockResolvedValue(JSON.stringify({
      tastes: [{ name: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["brand", "book"],
      recipient: { age: null, gender: null, place: "Jane Doe" },
    }));
    const plan = await extractPlan("unique-5 for Jane Doe");
    expect(plan.recipient.place).toBeNull();
  });

  it("NN-2: a recipient name echoed as a taste is stripped", async () => {
    chatJSONMock.mockResolvedValue(JSON.stringify({
      tastes: [{ name: "Jane Doe", domainGuess: "unknown" }, { name: "A24", domainGuess: "urn:entity:brand" }],
      targetDomains: ["brand", "book"], recipient: {},
    }));
    const plan = await extractPlan("unique-6 Jane Doe loves A24");
    expect(plan.tastes.map((t) => t.name)).toEqual(["A24"]);
  });
});
