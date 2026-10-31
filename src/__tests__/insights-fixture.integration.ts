// File: src/__tests__/insights-fixture.integration.ts
// REAL recorded-data integration: feed the committed Qloo fixtures through the ranker/resolver
// via a mocked gateway. Proves the DEV-004 subtype fix against the ACTUAL tenant response shape
// (entities carry type="urn:entity" + subtype="urn:entity:book") — a unit mock could mask this.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../../fixtures/qloo");
const insightsFixture = JSON.parse(readFileSync(resolve(fixturesDir, "insights-a24-to-books.json"), "utf8"));
const searchFixture = JSON.parse(readFileSync(resolve(fixturesDir, "search-a24.json"), "utf8"));

// Mock the single Qloo gateway; return the recorded fixture for whichever path is requested.
const getMock = vi.fn();
vi.mock("@/lib/qloo/client", () => ({ qlooGet: (...a: unknown[]) => getMock(...a) }));

import { rankGifts } from "@/lib/qloo/insights";
import { resolveSignals } from "@/lib/qloo/resolve";
import type { QlooSignal } from "@/lib/types";

const signals: QlooSignal[] = [
  { kind: "entity", value: "7E904879-87BC-4BA6-B4AB-6E380A4C250D", label: "A24", source: "search" },
];

beforeEach(() => getMock.mockReset());

describe("rankGifts against the real recorded insights fixture (DEV-004 subtype proof)", () => {
  it("ranks books and reports the real giftable subtype URN, not the generic urn:entity", async () => {
    getMock.mockResolvedValue(insightsFixture);
    const r = await rankGifts(signals, "urn:entity:book");
    expect(r.picks.length).toBeGreaterThan(0);
    // The real tenant puts "urn:entity:book" in `subtype`; ARCHITECTURE read `type` (="urn:entity").
    // The subtype fix makes this pass — a regression would surface "urn:entity" here.
    expect(r.picks[0].type).toBe("urn:entity:book");
    // Affinity is a real recorded number at query.affinity (readAffinity tolerates it).
    expect(r.picks[0].affinity).not.toBeNull();
  });
});

describe("resolveSignals against the real recorded search fixture", () => {
  it("resolves A24 to its real recorded entity_id via /search", async () => {
    // searchEntity reads results[0].entity_id; the tag fallback is never reached on a hit.
    getMock.mockResolvedValue(searchFixture);
    const { signals: out, coverage } = await resolveSignals([
      { name: "A24", domainGuess: "urn:entity:brand", raw: "A24" },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe("entity");
    expect(out[0].value).toBe("7E904879-87BC-4BA6-B4AB-6E380A4C250D");
    expect(coverage.resolved).toBe(1);
  });
});
