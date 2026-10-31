// File: src/lib/gift/product.ts
// Per-pick PRODUCT resolver: turn a Qloo pick (name+type) into the ACTUAL item page via FREE, keyless
// APIs — iTunes / Open Library / Steam / Nominatim / Clearbit. Qloo still CHOOSES the pick; this layer
// only resolves a buyable FORM for it. A CONFIDENCE GATE fuzzily confirms the returned item's name vs
// the pick (reject weak matches); on any miss / timeout / fetch error / low confidence we return null so
// the caller falls back to the guaranteed buyUrlForPick SEARCH url (INVARIANTS NN-4 — every link is a
// REAL resolved item, NEVER a fabricated /dp/ or /app/ id). NEVER throws to the caller.
import { LRUCache } from "lru-cache";
import type { QlooEntityType } from "@/lib/types";
import type { BuyTarget } from "./buyurl";

// lru-cache v11 constrains values to non-null, so we box the nullable result (null = a confirmed miss,
// cached so repeat picks don't re-hit the API). Same pattern as src/lib/infra/cache.ts (DEV-005).
const cache = new LRUCache<string, { t: BuyTarget | null }>({ max: 500, ttl: 1000 * 60 * 60 }); // 1 h
const TIMEOUT_MS = 1500;

// ── fetch helper: per-call AbortSignal timeout, JSON, never throws upward ──────────────────────────
async function getJSON<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

// ── confidence gate: normalized token overlap between resolved title and the pick name ─────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter(Boolean));
function confident(pick: string, got: string): boolean {
  const a = norm(pick), b = norm(got);
  if (!a || !b) return false;
  if (a === b || b.startsWith(a) || a.startsWith(b)) return true;
  const ta = tokens(pick), tb = tokens(got);
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / ta.size >= 0.6; // ≥60% of the pick's tokens present in the resolved title
}

// Return the resolved target only if the title clears the gate; else null (→ search fallback).
function gate(pick: string, t: BuyTarget | null): BuyTarget | null {
  return t && confident(pick, t.title) ? t : null;
}

const q = (s: string) => encodeURIComponent(s.trim());

// ── per-domain lookups (each returns a BuyTarget pre-gate, or null) ─────────────────────────────────
type ITunes = { results?: Array<{ collectionName?: string; trackName?: string; collectionViewUrl?: string; trackViewUrl?: string }> };
async function itunes(name: string, media: string, entity?: string): Promise<BuyTarget | null> {
  const ent = entity ? `&entity=${entity}` : "";
  const d = await getJSON<ITunes>(`https://itunes.apple.com/search?term=${q(name)}&media=${media}${ent}&limit=1`);
  const r = d?.results?.[0];
  const url = r?.collectionViewUrl ?? r?.trackViewUrl;
  const title = r?.collectionName ?? r?.trackName;
  if (!url || !title) return null;
  return { buyUrl: url, provider: "Apple", title };
}

type OL = { docs?: Array<{ title?: string; isbn?: string[]; key?: string }> };
async function openLibrary(name: string): Promise<BuyTarget | null> {
  const d = await getJSON<OL>(`https://openlibrary.org/search.json?title=${q(name)}&limit=1&fields=title,isbn,key`);
  const doc = d?.docs?.[0];
  if (!doc?.title) return null;
  const isbn10 = doc.isbn?.find((i) => i.length === 10);
  if (isbn10) return { buyUrl: `https://www.amazon.com/dp/${isbn10}`, provider: "Amazon", title: doc.title };
  if (doc.key) return { buyUrl: `https://openlibrary.org${doc.key}`, provider: "Open Library", title: doc.title };
  return null;
}

type Steam = { items?: Array<{ id?: number; name?: string }> };
async function steam(name: string): Promise<BuyTarget | null> {
  const d = await getJSON<Steam>(`https://store.steampowered.com/api/storesearch/?term=${q(name)}&cc=us&l=en`);
  const it = d?.items?.[0];
  if (!it?.id || !it.name) return null;
  return { buyUrl: `https://store.steampowered.com/app/${it.id}`, provider: "Steam", title: it.name };
}

type Nominatim = Array<{ display_name?: string; lat?: string; lon?: string }>;
async function nominatim(name: string): Promise<BuyTarget | null> {
  const d = await getJSON<Nominatim>(
    `https://nominatim.openstreetmap.org/search?q=${q(name)}&format=json&limit=1`,
    { "User-Agent": "giftproof/1.0" },
  );
  const hit = d?.[0];
  if (!hit?.display_name) return null;
  // Nominatim CONFIRMS the place is real; the deep-link is a Maps search keyed by the exact name (the
  // honest "find/visit it" destination — a verified real place, not a fabricated place_id).
  return { buyUrl: `https://www.google.com/maps/search/?api=1&query=${q(name)}`, provider: "Google Maps", title: hit.display_name };
}

// Dispatch a pick type to its resolver. BRAND/PERSON → null on purpose (no free, SAFE "the product"
// resolver exists for an arbitrary brand — Clearbit returned confident-but-wrong/unsafe domains, e.g.
// Steam→steamunlocked.net, so it was dropped 2026-10-31; brands keep the honest Amazon SEARCH fallback).
// movie → null (iTunes movie unreliable; caller keeps the JustWatch search fallback).
function lookup(name: string, type: QlooEntityType): Promise<BuyTarget | null> {
  switch (type) {
    case "urn:entity:tv_show": return itunes(name, "tvShow", "tvSeason");
    case "urn:entity:artist": return itunes(name, "music");
    case "urn:entity:podcast": return itunes(name, "podcast", "podcast");
    case "urn:entity:book": return openLibrary(name);
    case "urn:entity:video_game": return steam(name);
    case "urn:entity:place":
    case "urn:entity:destination": return nominatim(name);
    default: return Promise.resolve(null); // brand, person, movie, anything else → search fallback
  }
}

// PUBLIC: resolve a pick to a specific product page, or null on miss/low-confidence/error. Cached by
// `${type}|${name}`. NEVER throws (a resolver error is swallowed → null → search fallback upstream).
export async function resolveProductUrl(name: string, type: QlooEntityType): Promise<BuyTarget | null> {
  const n = name?.trim();
  if (!n) return null;
  const key = `${type}|${n}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit.t;
  let result: BuyTarget | null = null;
  try { result = gate(n, await lookup(n, type)); } catch { result = null; }
  cache.set(key, { t: result });
  return result;
}
