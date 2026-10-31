// File: src/__tests__/insights.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the single Qloo gateway so the ranker runs without a live key.
const getMock = vi.fn();
vi.mock("@/lib/qloo/client", () => ({ qlooGet: (...a: unknown[]) => getMock(...a) }));

import { rankGifts } from "@/lib/qloo/insights";
import type { QlooSignal } from "@/lib/types";

const signals: QlooSignal[] = [
  { kind: "entity", value: "e-a24", label: "A24", source: "search" },
  { kind: "tag", value: "urn:tag:jazz", label: "jazz", source: "tags" },
];

beforeEach(() => getMock.mockReset());

describe("rankGifts", () => {
  it("reads a real affinity number when present", async () => {
    getMock.mockResolvedValue({
      results: { entities: [{ entity_id: "x1", name: "Diptyque", type: "urn:entity:brand", affinity: 0.91 }] },
    });
    const r = await rankGifts(signals, "urn:entity:brand");
    expect(r.picks[0].affinity).toBe(0.91);
    expect(r.picks[0].rankBand).toBe("high");
  });

  it("falls back to score, then query.affinity, then null", async () => {
    getMock.mockResolvedValue({
      results: {
        entities: [
          { entity_id: "a", name: "A", score: 0.6 },
          { entity_id: "b", name: "B", query: { affinity: 0.4 } },
          { entity_id: "c", name: "C" },
        ],
      },
    });
    const r = await rankGifts(signals, "urn:entity:brand");
    expect(r.picks[0].affinity).toBe(0.6);
    expect(r.picks[1].affinity).toBe(0.4);
    expect(r.picks[2].affinity).toBeNull();
  });

  it("derives a rank-position band when affinity is absent (NN-3, never a fabricated number)", async () => {
    getMock.mockResolvedValue({
      results: {
        entities: Array.from({ length: 10 }, (_, i) => ({ entity_id: `e${i}`, name: `E${i}` })),
      },
    });
    const r = await rankGifts(signals, "urn:entity:brand");
    expect(r.picks[0].affinity).toBeNull();
    expect(r.picks[0].rankBand).toBe("high"); // position 1
    expect(r.picks[4].rankBand).toBe("medium"); // position 5
    expect(r.picks[9].rankBand).toBe("low"); // position 10
  });

  it("preserves Qloo's returned order in rankPosition", async () => {
    getMock.mockResolvedValue({
      results: { entities: [{ entity_id: "first", name: "First" }, { entity_id: "second", name: "Second" }] },
    });
    const r = await rankGifts(signals, "urn:entity:brand");
    expect(r.picks.map((p) => p.rankPosition)).toEqual([1, 2]);
    expect(r.picks.map((p) => p.entityId)).toEqual(["first", "second"]);
  });

  it("throws NO_AFFINITY_RESULTS on an empty entity list", async () => {
    getMock.mockResolvedValue({ results: { entities: [] } });
    await expect(rankGifts(signals, "urn:entity:brand")).rejects.toThrow("NO_AFFINITY_RESULTS");
  });

  // DEV-016: real tenant returns explainability under query, keyed by signal name (object, not a
  // flat array), referencing the SEED's id. The parser must flatten it and resolve ids to labels.
  it("parses query.explainability (object keyed by signal) and resolves seed ids to labels", async () => {
    getMock.mockResolvedValue({
      results: {
        entities: [
          {
            entity_id: "gift1", name: "Gift One", subtype: "urn:entity:brand",
            query: {
              affinity: 0.87,
              explainability: {
                "signal.interests.entities": [{ entity_id: "e-a24", score: 1 }],
                "signal.interests.tags": [{ entity_id: "urn:tag:jazz", score: 0.5 }],
              },
            },
          },
        ],
      },
    });
    const r = await rankGifts(signals, "urn:entity:brand");
    expect(r.picks[0].affinity).toBe(0.87);
    // both contributions flattened, seed ids resolved to their human labels
    expect(r.picks[0].explain.map((x) => x.label).sort()).toEqual(["A24", "jazz"]);
    expect(r.picks[0].explain.find((x) => x.label === "A24")?.score).toBe(1);
  });

  it("still reads the legacy flat-array explainability shape if present", async () => {
    getMock.mockResolvedValue({
      results: {
        entities: [{ entity_id: "g", name: "G", explainability: [{ entity_id: "e-a24", name: "A24", score: 0.9 }] }],
      },
    });
    const r = await rankGifts(signals, "urn:entity:brand");
    expect(r.picks[0].explain[0].label).toBe("A24");
    expect(r.picks[0].explain[0].score).toBe(0.9);
  });
});
