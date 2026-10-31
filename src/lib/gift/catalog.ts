// File: src/lib/gift/catalog.ts
import catalog from "../../../data/gift-catalog.json";
export interface CatalogEntry {
  sku: string; title: string; provider: string; buyUrl: string;
  domains: string[];      // Qloo entity-type URNs this gift suits
  entityHints: string[];  // normalized entity names it exactly matches (e.g. "aesop", "a24")
  tags: string[];         // taste tags for semantic fallback
}
const entries = catalog as CatalogEntry[];
const byHint = new Map<string, CatalogEntry>();
for (const e of entries) for (const h of e.entityHints) byHint.set(h.toLowerCase(), e);
export function allEntries(): CatalogEntry[] { return entries; }
export function exactByHint(name: string): CatalogEntry | undefined { return byHint.get(name.toLowerCase()); }
