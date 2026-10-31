// File: src/__tests__/narrate.test.ts
// No-fallback directive (2026-10-29): narration is SOLELY 0G-generated. The deterministic template
// render was REMOVED — narrate() either returns real 0G prose grounded in the given Qloo facts, or
// throws NarrationUnavailableError (honest failure, no fabricated substitution).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Provenance } from "@/lib/types";

const chatTextMock = vi.fn();
const llmConfiguredMock = vi.fn();
vi.mock("@/lib/llm/client", () => ({
  chatText: (...a: unknown[]) => chatTextMock(...a),
  llmConfigured: () => llmConfiguredMock(),
}));

import { narrate, NarrationUnavailableError } from "@/lib/llm/narrate";

const prov: Provenance = {
  qlooSays: {
    rankStatement: "Qloo ranked this #2 of brands for this audience",
    topContributors: ["A24", "Aesop"],
    affinityBand: "affinity 0.91 (high)",
    raw: {},
  },
  weChose: { reason: "it fits a film-and-design sensibility", matchType: "semantic" },
};

beforeEach(() => {
  chatTextMock.mockReset();
  llmConfiguredMock.mockReset();
});

describe("narrate (0G-only, no-fallback)", () => {
  it("returns the REAL 0G completion when 0G is reachable (no template)", async () => {
    llmConfiguredMock.mockReturnValue(true);
    chatTextMock.mockResolvedValue("  For an A24-and-Aesop lover, this is a confident pick.  ");
    const line = await narrate(prov);
    expect(line).toBe("For an A24-and-Aesop lover, this is a confident pick.");
    // The 0G call was actually made (not short-circuited to a template).
    expect(chatTextMock).toHaveBeenCalledOnce();
  });

  it("grounds the prompt in the REAL Qloo fields (rank, affinity band, contributors)", async () => {
    llmConfiguredMock.mockReturnValue(true);
    chatTextMock.mockResolvedValue("ok");
    await narrate(prov);
    const userMsg = String(chatTextMock.mock.calls[0][1]);
    expect(userMsg).toContain("Qloo ranked this #2 of brands for this audience");
    expect(userMsg).toContain("affinity 0.91 (high)");
    expect(userMsg).toContain("A24");
  });

  it("throws NarrationUnavailableError when no 0G key is configured (no template fallback)", async () => {
    llmConfiguredMock.mockReturnValue(false);
    await expect(narrate(prov)).rejects.toBeInstanceOf(NarrationUnavailableError);
    expect(chatTextMock).not.toHaveBeenCalled();
  });

  it("throws (honest failure) on a 0G error — never a fabricated template", async () => {
    llmConfiguredMock.mockReturnValue(true);
    chatTextMock.mockRejectedValue(new Error("0G router 503"));
    await expect(narrate(prov)).rejects.toBeInstanceOf(NarrationUnavailableError);
  });

  it("throws on an empty 0G completion (blank is not a valid narration)", async () => {
    llmConfiguredMock.mockReturnValue(true);
    chatTextMock.mockResolvedValue("   ");
    await expect(narrate(prov)).rejects.toBeInstanceOf(NarrationUnavailableError);
  });
});
