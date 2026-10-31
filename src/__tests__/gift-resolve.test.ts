// File: src/__tests__/gift-resolve.test.ts
import { describe, it, expect, vi } from "vitest";
import type { CatalogEntry } from "@/lib/gift/catalog";

// DEV-010 (UNTESTED-class): the §16-verbatim factory calls CATALOG.map() eagerly at mock
// registration, which vitest 5 hoists above the `const CATALOG` declaration ("Cannot access
// 'CATALOG' before initialization"). Wrapping the identical fixture in vi.hoisted makes it
// initialize before the hoisted factory. Data and all assertions below are unchanged from §16.
const CATALOG: CatalogEntry[] = vi.hoisted(() => [
  {
    sku: "aesop-egift",
    title: "Aesop e-gift card",
    provider: "Aesop",
    buyUrl: "https://example.com/aesop",
    domains: ["urn:entity:brand"],
    entityHints: ["aesop"],
    tags: ["skincare", "fragrance"],
  },
  {
    sku: "diptyque-egift",
    title: "Diptyque e-gift card",
    provider: "Diptyque",
    buyUrl: "https://example.com/diptyque",
    domains: ["urn:entity:brand"],
    entityHints: ["diptyque"],
    tags: ["candles", "fragrance"],
  },
]);

vi.mock("@/lib/gift/catalog", async () => {
  const byHint = new Map(CATALOG.map((e) => [e.entityHints[0], e]));
  return {
    allEntries: () => CATALOG,
    exactByHint: (n: string) => byHint.get(n.toLowerCase()),
  };
});

import { resolveGift } from "@/lib/gift/resolve";
import type { QlooPick } from "@/lib/types";

function pick(partial: Partial<QlooPick>): QlooPick {
  return {
    entityId: "e",
    name: "Aesop",
    type: "urn:entity:brand",
    affinity: null,
    rankBand: "high",
    rankPosition: 1,
    explain: [],
    ...partial,
  };
}

describe("resolveGift", () => {
  it("exact hint wins and is labeled exact", () => {
    const m = resolveGift(pick({ name: "Aesop" }));
    expect(m?.sku).toBe("aesop-egift");
    expect(m?.matchType).toBe("exact");
  });

  it("semantic fallback uses explainability tag overlap and discloses semantic", () => {
    const m = resolveGift(
      pick({ name: "Unknownbrand", explain: [{ entityId: "c", label: "fragrance", score: 0.5 }] }),
    );
    expect(m?.matchType).toBe("semantic");
  });

  it("domain-only last resort still returns a disclosed semantic match", () => {
    const m = resolveGift(pick({ name: "Nothingmatches", explain: [] }));
    expect(m).not.toBeNull();
    expect(m?.matchType).toBe("semantic");
  });
});
