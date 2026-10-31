// File: src/app/api/thumb/route.ts
// Per-domain REAL-image resolver (owner-chosen: morrow "photography=luxe, overlay=credibility").
// Resolves a real thumbnail for a Qloo pick by its gift domain using keyless public sources, then
// 302-redirects to the real image. On a miss it returns 404 so the card falls back to the drawn
// bridge (never a placeholder, never a fabricated/wrong-domain image dressed as real). Server-side +
// lru-cached so it works for both server-rendered seed pages and the live /app grid.
import { NextRequest, NextResponse } from "next/server";
import { LRUCache } from "lru-cache";

export const runtime = "nodejs";

// value "" is the cached-miss sentinel (LRUCache values must be non-null)
const cache = new LRUCache<string, string>({ max: 1000, ttl: 1000 * 60 * 60 * 24 });
const UA = { "User-Agent": "GiftProof/1.0 (+thumbnail resolver)" };
const bare = (t: string) => t.replace("urn:entity:", "");

async function ok(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "GET", headers: UA, redirect: "follow", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return false;
    const ct = r.headers.get("content-type") || "";
    const len = Number(r.headers.get("content-length") || "0");
    // reject Qloo's 117b oops.png; keep legit small brand logos (patagonia's real png is ~375b)
    return ct.startsWith("image/") && (len === 0 || len > 220);
  } catch {
    return false;
  }
}

async function itunes(term: string, media: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=${media}&limit=1`,
      { headers: UA, signal: AbortSignal.timeout(6000) },
    );
    const j = (await r.json()) as { results?: Array<{ artworkUrl100?: string }> };
    const art = j.results?.[0]?.artworkUrl100;
    return art ? art.replace(/\/100x100(bb)?\./, "/600x600$1.") : null;
  } catch {
    return null;
  }
}

async function openLibrary(title: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1&fields=cover_i`,
      { headers: UA, signal: AbortSignal.timeout(6000) },
    );
    const j = (await r.json()) as { docs?: Array<{ cover_i?: number }> };
    const id = j.docs?.[0]?.cover_i;
    return id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : null;
  } catch {
    return null;
  }
}

async function brandLogo(name: string): Promise<string | null> {
  // 1) resolve name -> domain via Clearbit's keyless autocomplete
  let domain: string | null = null;
  try {
    const r = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
      { headers: UA, signal: AbortSignal.timeout(6000) },
    );
    const j = (await r.json()) as Array<{ domain?: string }>;
    domain = j?.[0]?.domain ?? null;
  } catch {
    domain = null;
  }
  if (!domain) return null;
  // 2) unavatar aggregates real logos/avatars across sources (keyless); fall back to a high-res favicon
  const ua = `https://unavatar.io/${domain}?ttl=7d`;
  if (await ok(ua)) return ua;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

async function resolve(type: string, q: string): Promise<string | null> {
  const d = bare(type);
  if (d === "book") return (await openLibrary(q)) ?? (await itunes(q, "ebook"));
  if (d === "movie") return (await itunes(q, "movie")) ?? (await itunes(q, "tvShow"));
  if (d === "tv_show") return (await itunes(q, "tvShow")) ?? (await itunes(q, "movie"));
  if (d === "podcast") return itunes(q, "podcast");
  if (d === "video_game") return brandLogo(q); // studio/title logo as a reasonable real mark
  // brand, place, artist, person, destination, …
  return brandLogo(q);
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "urn:entity:brand";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return new NextResponse(null, { status: 400 });

  const key = `${type}::${q.toLowerCase()}`;
  let url = cache.get(key);
  if (url === undefined) {
    url = (await resolve(type, q)) ?? "";
    cache.set(key, url);
  }
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { status: 302 });
}
