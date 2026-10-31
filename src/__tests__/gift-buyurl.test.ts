// File: src/__tests__/gift-buyurl.test.ts
// Regression: "Get this gift" must route to a pick-relevant, real destination — never the generic
// Amazon gift-cards landing page. Covers domain routing, handoff round-trip, and NN-4 reachability.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buyUrlForPick, isProductUrl } from "@/lib/gift/buyurl";
import { handoff } from "@/lib/action/handoff";
import { resolveGift } from "@/lib/gift/resolve";
import type { QlooPick, QlooEntityType } from "@/lib/types";

// handoff() now RE-RESOLVES via resolveProductUrl (real free APIs). Force every resolver call to fail
// so these tests are offline/deterministic and the handoff falls back to the SEARCH url it round-trips
// against. (The actual product-resolution path is covered in gift-product.test.ts with mocked fetch.)
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); })); });
afterEach(() => { vi.unstubAllGlobals(); });

const pick = (name: string, type: QlooEntityType): QlooPick => ({
  entityId: "e", name, type, affinity: null, rankBand: "high", rankPosition: 1, explain: [],
});

describe("buyUrlForPick — domain routing", () => {
  it("routes each domain to its real search destination, keyed by the exact pick name", () => {
    expect(buyUrlForPick("Blade Runner", "urn:entity:movie").buyUrl).toBe("https://www.justwatch.com/us/search?q=Blade%20Runner");
    expect(buyUrlForPick("Succession", "urn:entity:tv_show").provider).toBe("JustWatch");
    expect(buyUrlForPick("Dune", "urn:entity:book").buyUrl).toBe("https://www.amazon.com/s?k=Dune&i=stripbooks");
    expect(buyUrlForPick("Hades", "urn:entity:video_game").buyUrl).toContain("store.steampowered.com");
    expect(buyUrlForPick("A24", "urn:entity:brand").buyUrl).toBe("https://www.amazon.com/s?k=A24");
    // places/venues route to Maps for the exact name (not an Amazon product).
    expect(buyUrlForPick("Bruegger's Bagels", "urn:entity:place").buyUrl).toContain("google.com/maps/search");
  });

  it("never returns the generic gift-cards landing page", () => {
    for (const t of ["urn:entity:movie", "urn:entity:book", "urn:entity:brand", "urn:entity:place"] as QlooEntityType[]) {
      expect(buyUrlForPick("Anything", t).buyUrl).not.toContain("/gift-cards");
    }
  });
});

describe("isProductUrl", () => {
  it("rejects the generic gift-card landing, accepts specific pages", () => {
    expect(isProductUrl("https://www.amazon.com/gift-cards")).toBe(false);
    expect(isProductUrl("https://www.aesop.com/us/")).toBe(true);
  });
});

describe("handoff round-trip — click lands where the card promised", () => {
  it("regenerates the pick-relevant SEARCH fallback from the encoded prod sku (never the generic card)", async () => {
    // With resolvers offline (fetch stubbed to throw), handoff falls back to the search url the card shows.
    for (const [name, type] of [["Succession", "urn:entity:tv_show"], ["A24", "urn:entity:brand"], ["Blade Runner: The Final Cut", "urn:entity:movie"]] as const) {
      const m = resolveGift(pick(name, type));
      expect(m).not.toBeNull();
      expect(m!.sku).toMatch(/^prod:/);              // sku now carries the product scheme
      const h = await handoff(m!.sku);
      expect(h.buyUrl).toBe(m!.buyUrl);              // click === display (search fallback on resolver miss)
      expect(h.buyUrl).not.toContain("/gift-cards"); // pick-relevant, not generic
    }
  });

  it("rejects an empty pick name honestly (ACTION_UNAVAILABLE)", async () => {
    await expect(handoff("prod:urn:entity:brand:   ")).rejects.toThrow(/ACTION_UNAVAILABLE/);
  });
});
