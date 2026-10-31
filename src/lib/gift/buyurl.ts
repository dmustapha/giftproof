// File: src/lib/gift/buyurl.ts
// Pick-relevant buy destinations. Qloo chooses WHAT the gift is about; this layer routes the
// EXACT pick name to a domain-appropriate destination. We use each provider's SEARCH endpoint
// keyed by the pick name: a search page is GUARANTEED to resolve for any query, so every link is
// real and reachable (INVARIANTS NN-4 — never a fabricated/dead deep-link), and the destination is
// genuinely about the pick rather than a generic gift-card landing page.
import type { QlooEntityType } from "@/lib/types";

export interface BuyTarget {
  buyUrl: string;
  provider: string;
  title: string; // honest, pick-specific label — names the destination kind (search/watch/store)
}

const q = (name: string) => encodeURIComponent(name.trim());

// Domain → real search destination. Default (brand/place/person/anything buyable) is an Amazon
// keyword search for the exact pick name.
export function buyUrlForPick(name: string, type: QlooEntityType): BuyTarget {
  const n = name.trim();
  const k = q(n);
  switch (type) {
    case "urn:entity:movie":
    case "urn:entity:tv_show":
      // JustWatch aggregates every streaming + rental/buy provider for a title (real, reachable).
      return { buyUrl: `https://www.justwatch.com/us/search?q=${k}`, provider: "JustWatch", title: `Watch “${n}”` };
    case "urn:entity:book":
      // Amazon Books search for the exact title (scoped to the Books department).
      return { buyUrl: `https://www.amazon.com/s?k=${k}&i=stripbooks`, provider: "Amazon", title: `“${n}” (book) on Amazon` };
    case "urn:entity:video_game":
      return { buyUrl: `https://store.steampowered.com/search/?term=${k}`, provider: "Steam", title: `“${n}” on Steam` };
    case "urn:entity:artist":
    case "urn:entity:podcast":
      return { buyUrl: `https://music.amazon.com/search/${k}`, provider: "Amazon Music", title: `“${n}” on Amazon Music` };
    case "urn:entity:place":
    case "urn:entity:destination":
      // A place/cafe/venue isn't an Amazon product — route to Maps for the exact name (find/visit it).
      return { buyUrl: `https://www.google.com/maps/search/?api=1&query=${k}`, provider: "Google Maps", title: `Find “${n}” on Maps` };
    default:
      // brand, person, and any future type → Amazon search for the exact name.
      return { buyUrl: `https://www.amazon.com/s?k=${k}`, provider: "Amazon", title: `Shop “${n}” on Amazon` };
  }
}

// A catalog entry's URL counts as a real PRODUCT match only when it's a specific page, not the
// generic gift-card landing. Used to decide exact-product vs. pick-name routing.
export function isProductUrl(url: string): boolean {
  return !!url && !/\/gift-cards\/?($|\?)/.test(url);
}
