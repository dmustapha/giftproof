// debug P6 regression (M1): /api/gift must NEVER surface a red HTTP 502 on an unexpected orchestrator
// throw. The orchestrator degrades honestly for known classes; any OTHER throw after extraction (e.g. a
// malformed Qloo payload breaking merge/provenance) must still return a graceful degraded-200 that the UI
// renders as a labelled fault slip — never a stage-losing 502. (added by hackathon-debug, never modified
// build's tests — DEBUG CONTRACT rule #4)
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the orchestrator so we can force the "unexpected throw" path deterministically, offline.
vi.mock("@/lib/orchestrate", () => ({
  runGift: vi.fn(),
}));

import { runGift } from "@/lib/orchestrate";
import { POST } from "@/app/api/gift/route";

function reqWith(body: unknown): import("next/server").NextRequest {
  // Minimal NextRequest shim — the route only calls req.json().
  return { json: async () => body } as unknown as import("next/server").NextRequest;
}

describe("debug P6 M1 — /api/gift honest degrade (no 502)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a graceful degraded-200 (QLOO_UNREACHABLE, 0 picks) when runGift throws unexpectedly", async () => {
    (runGift as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Cannot read properties of undefined (reading 'results')"),
    );
    const res = await POST(reqWith({ sentence: "my sister loves A24 films" }));
    expect(res.status).toBe(200); // NOT 502
    const json = await res.json();
    expect(json.degraded).toBe("QLOO_UNREACHABLE");
    expect(json.picks).toEqual([]); // never a fabricated card (NN-1/NN-3)
  });

  it("still 400s on invalid input (too short)", async () => {
    const res = await POST(reqWith({ sentence: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_INPUT");
  });

  it("passes a successful orchestrator result straight through (200)", async () => {
    (runGift as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      picks: [{ pick: { entityId: "e1" } }], coverage: { resolved: 1, total: 1, misses: [] },
      seeds: [], domain: "urn:entity:brand", degraded: null, raw: null,
    });
    const res = await POST(reqWith({ sentence: "loves Succession and A24" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.degraded).toBeNull();
    expect(json.picks).toHaveLength(1);
  });
});
