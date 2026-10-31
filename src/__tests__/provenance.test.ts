// File: src/__tests__/provenance.test.ts
import { describe, it, expect } from "vitest";
import { buildProvenance } from "@/lib/qloo/provenance";
import type { QlooPick, GiftMatch, Coverage } from "@/lib/types";

const coverage: Coverage = { resolved: 2, total: 2, misses: [] };

function pick(partial: Partial<QlooPick>): QlooPick {
  return {
    entityId: "e1",
    name: "Diptyque",
    type: "urn:entity:brand",
    affinity: null,
    rankBand: "medium",
    rankPosition: 2,
    explain: [
      { entityId: "a24", label: "A24", score: 0.9 },
      { entityId: "aesop", label: "Aesop", score: 0.7 },
    ],
    ...partial,
  };
}

const gift: GiftMatch = {
  sku: "diptyque-egift",
  title: "Diptyque e-gift card",
  provider: "Diptyque",
  buyUrl: "https://example.com/diptyque",
  matchType: "exact",
  matchedEntity: "Diptyque",
};

describe("buildProvenance", () => {
  it("uses the real rankPosition in the rank statement", () => {
    const p = buildProvenance(pick({ rankPosition: 2 }), gift, coverage);
    expect(p.qlooSays.rankStatement).toContain("#2");
  });

  it("renders a rank band and NO fabricated percentage when affinity is null (NN-3)", () => {
    const p = buildProvenance(pick({ affinity: null }), gift, coverage);
    expect(p.qlooSays.affinityBand).toBe("medium rank band");
    expect(p.qlooSays.affinityBand).not.toMatch(/%/);
  });

  it("renders the real affinity (2dp) when present, never invented", () => {
    const p = buildProvenance(pick({ affinity: 0.83, rankBand: "high" }), gift, coverage);
    expect(p.qlooSays.affinityBand).toBe("affinity 0.83 (high)");
  });

  it("surfaces top contributors from real explainability labels, highest score first", () => {
    const p = buildProvenance(pick({}), gift, coverage);
    expect(p.qlooSays.topContributors).toEqual(["A24", "Aesop"]);
  });

  it("carries the match type through to weChose", () => {
    const p = buildProvenance(pick({}), gift, coverage);
    expect(p.weChose.matchType).toBe("exact");
  });
});
