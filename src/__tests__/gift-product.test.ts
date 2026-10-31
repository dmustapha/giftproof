// File: src/__tests__/gift-product.test.ts
// Per-pick PRODUCT resolver — offline/deterministic (fetch fully mocked, NO real network). Asserts the
// specific-URL shapes per domain, the confidence gate (weak title → null), and the error/miss → null
// contract (caller falls back to the search url). Also covers the handoff round-trip over a `prod:` sku.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveProductUrl } from "@/lib/gift/product";
import { handoff } from "@/lib/action/handoff";
import type { QlooEntityType } from "@/lib/types";

// Build a fetch stub that routes by URL substring to a JSON body (or throws for the error case).
type Route = { match: string; body?: unknown; throws?: boolean };
function stubFetch(routes: Route[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const r = routes.find((x) => url.includes(x.match));
    if (!r || r.throws) throw new Error("network");
    return { ok: true, json: async () => r.body } as Response;
  }));
}
// Unique names per case so the module-level LRU cache never bleeds a prior result across tests.
let n = 0;
const uniq = (s: string) => `${s} ${++n}`;

beforeEach(() => { n = 0; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("resolveProductUrl — specific-item resolution per domain", () => {
  it("tv_show → iTunes collectionViewUrl", async () => {
    const name = uniq("Severance");
    stubFetch([{ match: "itunes.apple.com", body: { results: [{ collectionName: name, collectionViewUrl: `https://tv.apple.com/show/${name}` }] } }]);
    const t = await resolveProductUrl(name, "urn:entity:tv_show" as QlooEntityType);
    expect(t?.buyUrl).toBe(`https://tv.apple.com/show/${name}`);
    expect(t?.provider).toBe("Apple");
  });

  it("video_game → Steam /app/<id>", async () => {
    const name = uniq("Hollow Knight");
    stubFetch([{ match: "store.steampowered.com", body: { items: [{ id: 367520, name }] } }]);
    const t = await resolveProductUrl(name, "urn:entity:video_game" as QlooEntityType);
    expect(t?.buyUrl).toBe("https://store.steampowered.com/app/367520");
  });

  it("book → Amazon /dp/<isbn10>", async () => {
    const name = uniq("Dune");
    stubFetch([{ match: "openlibrary.org/search", body: { docs: [{ title: name, isbn: ["9780441013593", "0441013597"], key: "/works/OL1W" }] } }]);
    const t = await resolveProductUrl(name, "urn:entity:book" as QlooEntityType);
    expect(t?.buyUrl).toBe("https://www.amazon.com/dp/0441013597"); // ISBN-10 chosen
  });

  it("book without ISBN-10 → Open Library work key", async () => {
    const name = uniq("Some Rare Title");
    stubFetch([{ match: "openlibrary.org/search", body: { docs: [{ title: name, isbn: ["9780441013593"], key: "/works/OL42W" }] } }]);
    const t = await resolveProductUrl(name, "urn:entity:book" as QlooEntityType);
    expect(t?.buyUrl).toBe("https://openlibrary.org/works/OL42W");
  });

  it("brand → null (Clearbit dropped as unsafe; caller keeps Amazon search fallback)", async () => {
    const t = await resolveProductUrl(uniq("Oculus"), "urn:entity:brand" as QlooEntityType);
    expect(t).toBeNull();
  });

  it("place → Google Maps deep-link (Nominatim-confirmed)", async () => {
    const name = uniq("Blue Bottle Coffee");
    stubFetch([{ match: "nominatim.openstreetmap.org", body: [{ display_name: `${name}, Oakland, CA, USA`, lat: "37.8", lon: "-122.2" }] }]);
    const t = await resolveProductUrl(name, "urn:entity:place" as QlooEntityType);
    expect(t?.buyUrl).toContain("google.com/maps/search");
    expect(t?.provider).toBe("Google Maps");
  });

  it("movie → null (no resolver; caller keeps JustWatch search fallback)", async () => {
    stubFetch([{ match: "itunes.apple.com", body: { results: [] } }]);
    const t = await resolveProductUrl(uniq("Blade Runner"), "urn:entity:movie" as QlooEntityType);
    expect(t).toBeNull();
  });
});

describe("resolveProductUrl — confidence gate + error → null (search fallback)", () => {
  it("weak title match → null (does not route to an unrelated item)", async () => {
    const name = uniq("Girl Friends");
    // Open Library fuzzily returns an unrelated title — the gate must reject it.
    stubFetch([{ match: "openlibrary.org/search", body: { docs: [{ title: "The Complete Works of Shakespeare", isbn: ["0451530659"], key: "/works/OLx" }] } }]);
    const t = await resolveProductUrl(name, "urn:entity:book" as QlooEntityType);
    expect(t).toBeNull();
  });

  it("fetch error → null (never throws to the caller)", async () => {
    stubFetch([{ match: "store.steampowered.com", throws: true }]);
    const t = await resolveProductUrl(uniq("Hades"), "urn:entity:video_game" as QlooEntityType);
    expect(t).toBeNull();
  });

  it("empty result set → null", async () => {
    stubFetch([{ match: "store.steampowered.com", body: { items: [] } }]);
    const t = await resolveProductUrl(uniq("Nonexistent Game"), "urn:entity:video_game" as QlooEntityType);
    expect(t).toBeNull();
  });
});

describe("handoff — prod sku round-trips to the resolved product url", () => {
  it("re-resolves the actual product page from a prod:<type>:<name> sku", async () => {
    const name = "Celeste"; // deterministic (no uniq) — single call, no cache concern
    stubFetch([{ match: "store.steampowered.com", body: { items: [{ id: 504230, name }] } }]);
    const h = await handoff(`prod:urn:entity:video_game:${name}`);
    expect(h.buyUrl).toBe("https://store.steampowered.com/app/504230");
  });
});
