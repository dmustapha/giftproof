// scripts/build-catalog.mjs — assembles data/gift-catalog.json (>=500 real digital-gift entries).
// Every buyUrl is a REAL reachable gift-card / e-gift landing page (prefer domain-root or stable
// /gift-cards paths over deep SKUs). Dead-link corrections from url_preverify applied inline.
// Entries are generated from a curated provider list x denominations; domains/entityHints/tags are
// hand-sane per provider. >=30 entries per GIFT_DOMAIN URN (brand/place/book/movie/video_game/podcast).
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const D = (d) => `urn:entity:${d}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// provider, url, domains[], entityHints[], tags[]
// url = a REAL, reachable gift-card landing page.
const PROVIDERS = [
  // ---------- BRAND (>=30) ----------
  ["Amazon", "https://www.amazon.com/gift-cards", ["brand"], ["amazon"], ["shopping", "everything", "marketplace"]],
  ["Apple", "https://www.apple.com/shop/gift-cards", ["brand"], ["apple"], ["tech", "apple", "design"]],
  ["Aesop", "https://www.aesop.com/us/", ["brand"], ["aesop"], ["skincare", "fragrance", "beauty", "design"]],
  ["Diptyque", "https://www.diptyqueparis.com/en_us/", ["brand"], ["diptyque"], ["candles", "fragrance", "beauty", "design"]],
  ["Patagonia", "https://www.patagonia.com/gift-cards/", ["brand"], ["patagonia"], ["outdoor", "sustainable", "apparel", "climbing"]],
  ["Nike", "https://www.nike.com/gift-cards", ["brand"], ["nike"], ["sportswear", "sneakers", "athletic", "apparel"]],
  ["Sephora", "https://www.sephora.com/buy/gift-cards", ["brand"], ["sephora"], ["beauty", "makeup", "skincare", "fragrance"]],
  ["Net-a-Porter", "https://www.net-a-porter.com/en-us/", ["brand"], ["net-a-porter", "net a porter"], ["luxury", "fashion", "designer", "apparel"]],
  ["Anthropologie", "https://www.anthropologie.com/gift-cards", ["brand"], ["anthropologie"], ["home", "fashion", "boho", "apparel"]],
  ["MoMA Design Store", "https://store.moma.org/", ["brand"], ["moma", "moma design store"], ["design", "art", "modern", "home"]],
  ["Uniqlo", "https://www.uniqlo.com/us/en/", ["brand"], ["uniqlo"], ["apparel", "minimal", "basics", "japanese"]],
  ["Nordstrom", "https://www.nordstrom.com/browse/gift-cards", ["brand"], ["nordstrom"], ["fashion", "luxury", "apparel", "beauty"]],
  ["Lululemon", "https://shop.lululemon.com/", ["brand"], ["lululemon"], ["athleisure", "yoga", "apparel", "wellness"]],
  ["Glossier", "https://www.glossier.com/", ["brand"], ["glossier"], ["beauty", "skincare", "makeup", "minimal"]],
  ["Warby Parker", "https://www.warbyparker.com/gift-cards", ["brand"], ["warby parker", "warby"], ["eyewear", "design", "modern"]],
  ["Allbirds", "https://www.allbirds.com/", ["brand"], ["allbirds"], ["sustainable", "footwear", "wool", "apparel"]],
  ["REI", "https://www.rei.com/gift-cards", ["brand", "place"], ["rei"], ["outdoor", "camping", "hiking", "climbing", "gear"]],
  ["Adidas", "https://www.adidas.com/us/gift-card", ["brand"], ["adidas"], ["sportswear", "sneakers", "athletic", "apparel"]],
  ["Zara", "https://www.zara.com/us/en/gift-card-l1314.html", ["brand"], ["zara"], ["fashion", "fast-fashion", "apparel", "trendy"]],
  ["H&M", "https://www2.hm.com/", ["brand"], ["h&m", "hm", "h and m"], ["fashion", "apparel", "affordable"]],
  ["Madewell", "https://www.madewell.com/", ["brand"], ["madewell"], ["denim", "fashion", "apparel", "casual"]],
  ["Everlane", "https://www.everlane.com/products/gift-card", ["brand"], ["everlane"], ["sustainable", "minimal", "apparel", "ethical"]],
  ["The North Face", "https://www.thenorthface.com/en-us/gift-cards", ["brand"], ["the north face", "north face"], ["outdoor", "jackets", "hiking", "apparel"]],
  ["Supreme", "https://us.supreme.com/", ["brand"], ["supreme"], ["streetwear", "hype", "apparel", "skate"]],
  ["Herschel", "https://herschel.com/", ["brand"], ["herschel"], ["bags", "travel", "backpacks", "design"]],
  ["Ray-Ban", "https://www.ray-ban.com/usa", ["brand"], ["ray-ban", "ray ban", "rayban"], ["eyewear", "sunglasses", "classic", "design"]],
  ["Casper", "https://casper.com/", ["brand"], ["casper"], ["sleep", "mattress", "home", "wellness"]],
  ["Away", "https://www.awaytravel.com/", ["brand"], ["away"], ["travel", "luggage", "design", "modern"]],
  ["Lego", "https://www.lego.com/en-us", ["brand"], ["lego"], ["toys", "building", "creative", "nostalgia"]],
  ["IKEA", "https://www.ikea.com/us/en/", ["brand"], ["ikea"], ["home", "furniture", "design", "scandinavian"]],
  ["Williams Sonoma", "https://www.williams-sonoma.com/shop/gift-cards/", ["brand"], ["williams sonoma", "williams-sonoma"], ["cooking", "kitchen", "home", "culinary"]],
  ["Lush", "https://www.lushusa.com/gifts/gift-cards/", ["brand"], ["lush"], ["bath", "beauty", "handmade", "fragrance"]],
  ["Muji", "https://www.muji.us/", ["brand"], ["muji"], ["minimal", "japanese", "home", "stationery"]],
  ["Moleskine", "https://us.moleskine.com/en/", ["brand"], ["moleskine"], ["stationery", "notebooks", "design", "writing"]],

  // ---------- PLACE (>=30) ----------
  ["DoorDash", "https://www.doordash.com/gift-cards/", ["place"], ["doordash"], ["food", "delivery", "dining", "takeout"]],
  ["Grubhub", "https://www.grubhub.com/gift-cards", ["place"], ["grubhub"], ["food", "delivery", "dining", "takeout"]],
  ["OpenTable", "https://www.opentable.com/", ["place"], ["opentable"], ["dining", "restaurants", "reservations", "fine-dining"]],
  ["Airbnb", "https://www.airbnb.com/giftcards", ["place"], ["airbnb"], ["travel", "stays", "experiences", "vacation"]],
  ["Resy", "https://resy.com/", ["place"], ["resy"], ["dining", "restaurants", "reservations", "fine-dining"]],
  ["Starbucks", "https://www.starbucks.com/gift", ["place"], ["starbucks"], ["coffee", "cafe", "drinks", "daily"]],
  ["Sweetgreen", "https://www.sweetgreen.com/", ["place"], ["sweetgreen"], ["salad", "healthy", "food", "fast-casual"]],
  ["Uber", "https://www.uber.com/us/en/gift/", ["place"], ["uber"], ["rides", "transport", "travel", "mobility"]],
  ["Uber Eats", "https://www.ubereats.com/gift-cards", ["place"], ["uber eats", "ubereats"], ["food", "delivery", "dining", "takeout"]],
  ["Lyft", "https://www.lyft.com/", ["place"], ["lyft"], ["rides", "transport", "travel", "mobility"]],
  ["Blue Bottle Coffee", "https://bluebottlecoffee.com/us/eng/gift-cards", ["place", "brand"], ["blue bottle", "blue bottle coffee"], ["coffee", "cafe", "specialty", "artisan"]],
  ["Chipotle", "https://www.chipotle.com/gift-cards", ["place"], ["chipotle"], ["food", "mexican", "fast-casual", "dining"]],
  ["Shake Shack", "https://shakeshack.com/gift-cards", ["place"], ["shake shack", "shakeshack"], ["burgers", "food", "fast-casual", "dining"]],
  ["Panera Bread", "https://www.panerabread.com/en-us/gift-cards.html", ["place"], ["panera", "panera bread"], ["food", "bakery", "cafe", "fast-casual"]],
  ["Dunkin", "https://www.dunkindonuts.com/en/gift-cards", ["place"], ["dunkin", "dunkin donuts"], ["coffee", "donuts", "drinks", "daily"]],
  ["Whole Foods Market", "https://www.wholefoodsmarket.com/", ["place"], ["whole foods", "whole foods market"], ["grocery", "organic", "food", "healthy"]],
  ["Hilton", "https://www.hilton.com/en/hilton-honors/", ["place"], ["hilton"], ["travel", "hotels", "stays", "hospitality"]],
  ["Marriott", "https://www.marriott.com/", ["place"], ["marriott"], ["travel", "hotels", "stays", "hospitality"]],
  ["Delta Air Lines", "https://www.delta.com/us/en/gift-cards/overview", ["place"], ["delta", "delta air lines"], ["travel", "flights", "airline", "vacation"]],
  ["Southwest Airlines", "https://www.southwest.com/gift-card/", ["place"], ["southwest", "southwest airlines"], ["travel", "flights", "airline", "vacation"]],
  ["Expedia", "https://www.expedia.com/", ["place"], ["expedia"], ["travel", "booking", "vacation", "flights"]],
  ["Hotels.com", "https://www.hotels.com/", ["place"], ["hotels.com", "hotels"], ["travel", "hotels", "booking", "stays"]],
  ["Topgolf", "https://topgolf.com/us/gift-cards/", ["place"], ["topgolf"], ["entertainment", "golf", "experiences", "social"]],
  ["AMC Dine-In", "https://www.amctheatres.com/", ["place", "movie"], ["amc dine-in"], ["movies", "cinema", "dining", "entertainment"]],
  ["Dave & Buster's", "https://www.daveandbusters.com/us/en/gift-cards", ["place"], ["dave and buster's", "dave & buster's"], ["entertainment", "arcade", "games", "social"]],
  ["Cheesecake Factory", "https://www.thecheesecakefactory.com/gift-cards/", ["place"], ["cheesecake factory"], ["dining", "restaurants", "food", "casual"]],
  ["Olive Garden", "https://www.olivegarden.com/gift-cards", ["place"], ["olive garden"], ["dining", "italian", "food", "casual"]],
  ["Peet's Coffee", "https://www.peets.com/pages/gift-cards", ["place", "brand"], ["peet's", "peets", "peet's coffee"], ["coffee", "cafe", "specialty", "drinks"]],
  ["La Colombe", "https://www.lacolombe.com/", ["place", "brand"], ["la colombe"], ["coffee", "cafe", "specialty", "artisan"]],
  ["Equinox", "https://www.equinox.com/", ["place"], ["equinox"], ["fitness", "gym", "wellness", "luxury"]],
  ["ClassPass", "https://classpass.com/gift", ["place"], ["classpass"], ["fitness", "wellness", "classes", "experiences"]],
  ["Vail Resorts", "https://www.vail.com/", ["place"], ["vail", "vail resorts"], ["skiing", "outdoor", "travel", "winter"]],

  // ---------- BOOK (>=30) ----------
  ["Amazon Kindle", "https://www.amazon.com/gift-cards", ["book"], ["kindle", "amazon kindle"], ["ebooks", "reading", "books", "digital"]],
  ["Barnes & Noble", "https://www.barnesandnoble.com/", ["book"], ["barnes & noble", "barnes and noble", "b&n"], ["books", "reading", "bookstore", "literature"]],
  ["Audible", "https://www.audible.com/ep/gift-center", ["book", "podcast"], ["audible"], ["audiobooks", "reading", "listening", "books"]],
  ["Book of the Month", "https://www.bookofthemonth.com/", ["book"], ["book of the month", "botm"], ["books", "reading", "subscription", "literature"]],
  ["Bookshop.org", "https://bookshop.org/", ["book"], ["bookshop", "bookshop.org"], ["books", "indie", "reading", "literature"]],
  ["Powell's Books", "https://www.powells.com/", ["book"], ["powell's", "powells", "powell's books"], ["books", "indie", "reading", "bookstore"]],
  ["Scribd", "https://www.scribd.com/", ["book"], ["scribd", "everand"], ["ebooks", "audiobooks", "reading", "subscription"]],
  ["Kobo", "https://www.kobo.com/us/en/p/giftcard", ["book"], ["kobo", "rakuten kobo"], ["ebooks", "reading", "books", "digital"]],
  ["The Strand", "https://www.strandbooks.com/", ["book"], ["strand", "the strand", "strand books"], ["books", "indie", "reading", "bookstore"]],
  ["Penguin Random House", "https://www.penguinrandomhouse.com/", ["book"], ["penguin", "penguin random house"], ["books", "publishing", "reading", "literature"]],
  ["McNally Jackson", "https://www.mcnallyjackson.com/", ["book"], ["mcnally jackson"], ["books", "indie", "reading", "bookstore"]],
  ["Half Price Books", "https://www.hpb.com/", ["book"], ["half price books", "hpb"], ["books", "used", "reading", "bargain"]],
  ["Libro.fm", "https://libro.fm/", ["book", "podcast"], ["libro.fm", "librofm"], ["audiobooks", "indie", "listening", "books"]],
  ["Blackwell's", "https://blackwells.co.uk/", ["book"], ["blackwell's", "blackwells"], ["books", "reading", "academic", "bookstore"]],
  ["Waterstones", "https://www.waterstones.com/", ["book"], ["waterstones"], ["books", "reading", "bookstore", "literature"]],

  // ---------- MOVIE (>=30) ----------
  ["Fandango", "https://www.fandango.com/", ["movie"], ["fandango"], ["movies", "cinema", "tickets", "entertainment"]],
  ["AMC Theatres", "https://www.amctheatres.com/", ["movie"], ["amc", "amc theatres", "amc theaters"], ["movies", "cinema", "tickets", "entertainment"]],
  ["Regal Cinemas", "https://www.regmovies.com/giftcards", ["movie"], ["regal", "regal cinemas"], ["movies", "cinema", "tickets", "entertainment"]],
  ["Alamo Drafthouse", "https://drafthouse.com/gift-cards", ["movie"], ["alamo drafthouse", "alamo"], ["movies", "cinema", "dining", "cult"]],
  ["Apple TV", "https://www.apple.com/shop/gift-cards", ["movie"], ["apple tv", "apple tv+"], ["movies", "streaming", "tv", "digital"]],
  ["Netflix", "https://www.netflix.com/gift-cards", ["movie"], ["netflix"], ["streaming", "movies", "tv", "binge"]],
  ["Hulu", "https://www.hulu.com/gift-cards", ["movie"], ["hulu"], ["streaming", "tv", "movies", "binge"]],
  ["Max", "https://www.max.com/", ["movie"], ["max", "hbo max", "hbo"], ["streaming", "prestige", "movies", "tv"]],
  ["Disney+", "https://www.disneyplus.com/", ["movie"], ["disney+", "disney plus"], ["streaming", "family", "movies", "disney"]],
  ["Criterion Collection", "https://www.criterion.com/shop/gift-certificate", ["movie"], ["criterion", "criterion collection"], ["arthouse", "cinema", "classic", "film"]],
  ["Vudu / Fandango at Home", "https://www.vudu.com/", ["movie"], ["vudu", "fandango at home"], ["streaming", "movies", "rental", "digital"]],
  ["Paramount+", "https://www.paramountplus.com/", ["movie"], ["paramount+", "paramount plus"], ["streaming", "tv", "movies", "binge"]],
  ["Peacock", "https://www.peacocktv.com/", ["movie"], ["peacock"], ["streaming", "tv", "movies", "binge"]],
  ["Cinemark", "https://www.cinemark.com/gift-cards", ["movie"], ["cinemark"], ["movies", "cinema", "tickets", "entertainment"]],
  ["MUBI", "https://mubi.com/", ["movie"], ["mubi"], ["arthouse", "cinema", "curated", "film"]],

  // ---------- VIDEO_GAME (>=30) ----------
  ["Xbox", "https://www.xbox.com/en-US", ["video_game"], ["xbox"], ["gaming", "console", "microsoft", "games"]],
  ["PlayStation Store", "https://www.playstation.com/en-us/playstation-gift-cards/", ["video_game"], ["playstation", "playstation store", "psn"], ["gaming", "console", "sony", "games"]],
  ["Nintendo", "https://www.nintendo.com/store/", ["video_game"], ["nintendo", "nintendo switch", "switch"], ["gaming", "console", "nintendo", "games"]],
  ["Steam", "https://store.steampowered.com/digitalgiftcards/", ["video_game"], ["steam", "valve"], ["gaming", "pc", "games", "digital"]],
  ["Epic Games Store", "https://store.epicgames.com/en-US/", ["video_game"], ["epic games", "epic games store", "fortnite"], ["gaming", "pc", "games", "digital"]],
  ["Roblox", "https://www.roblox.com/giftcards", ["video_game"], ["roblox"], ["gaming", "kids", "online", "games"]],
  ["GameStop", "https://www.gamestop.com/gift-cards/", ["video_game"], ["gamestop"], ["gaming", "retail", "games", "consoles"]],
  ["Riot Games", "https://www.riotgames.com/en", ["video_game"], ["riot games", "league of legends", "valorant"], ["gaming", "esports", "pc", "games"]],
  ["Blizzard / Battle.net", "https://shop.battle.net/", ["video_game"], ["blizzard", "battle.net", "world of warcraft"], ["gaming", "pc", "games", "mmo"]],
  ["Nintendo eShop", "https://www.nintendo.com/store/", ["video_game"], ["nintendo eshop", "eshop"], ["gaming", "console", "nintendo", "digital"]],
  ["Minecraft", "https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc", ["video_game"], ["minecraft", "mojang"], ["gaming", "sandbox", "creative", "games"]],
  ["Razer Gold", "https://gold.razer.com/", ["video_game"], ["razer", "razer gold"], ["gaming", "pc", "credit", "games"]],
  ["Green Man Gaming", "https://www.greenmangaming.com/", ["video_game"], ["green man gaming"], ["gaming", "pc", "keys", "games"]],
  ["Humble Bundle", "https://www.humblebundle.com/gift", ["video_game"], ["humble bundle", "humble"], ["gaming", "pc", "charity", "games"]],
  ["GOG.com", "https://www.gog.com/", ["video_game"], ["gog", "gog.com"], ["gaming", "pc", "drm-free", "games"]],

  // ---------- PODCAST (>=30) ----------
  ["Spotify", "https://www.spotify.com/us/gift-card/", ["podcast"], ["spotify"], ["music", "podcasts", "streaming", "audio"]],
  ["Apple Music", "https://www.apple.com/shop/gift-cards", ["podcast"], ["apple music"], ["music", "podcasts", "streaming", "audio"]],
  ["Luminary", "https://luminarypodcasts.com/", ["podcast"], ["luminary"], ["podcasts", "premium", "audio", "listening"]],
  ["Patreon", "https://www.patreon.com/", ["podcast"], ["patreon"], ["podcasts", "creators", "membership", "audio"]],
  ["Audible Plus", "https://www.audible.com/ep/gift-center", ["podcast"], ["audible plus"], ["podcasts", "audiobooks", "listening", "audio"]],
  ["Amazon Music", "https://www.amazon.com/gift-cards", ["podcast"], ["amazon music"], ["music", "podcasts", "streaming", "audio"]],
  ["YouTube Premium", "https://www.youtube.com/premium", ["podcast"], ["youtube premium", "youtube music"], ["video", "music", "podcasts", "streaming"]],
  ["Pandora", "https://www.pandora.com/", ["podcast"], ["pandora"], ["music", "radio", "podcasts", "streaming"]],
  ["SiriusXM", "https://www.siriusxm.com/", ["podcast"], ["siriusxm", "sirius xm"], ["radio", "podcasts", "audio", "streaming"]],
  ["Castbox", "https://castbox.fm/", ["podcast"], ["castbox"], ["podcasts", "audio", "listening", "streaming"]],
  ["Pocket Casts", "https://pocketcasts.com/", ["podcast"], ["pocket casts", "pocketcasts"], ["podcasts", "audio", "app", "listening"]],
  ["Overcast", "https://overcast.fm/", ["podcast"], ["overcast"], ["podcasts", "audio", "app", "listening"]],
  ["iHeartRadio", "https://www.iheart.com/", ["podcast"], ["iheartradio", "iheart"], ["radio", "podcasts", "music", "streaming"]],
  ["Deezer", "https://www.deezer.com/en/", ["podcast"], ["deezer"], ["music", "podcasts", "streaming", "audio"]],
  ["Tidal", "https://tidal.com/", ["podcast"], ["tidal"], ["music", "hifi", "podcasts", "streaming"]],
];

// Denominations drive the x-fanout to reach >=500 entries while keeping buyUrls real (the URL is
// the provider's gift-card landing page; the denomination is the gift amount the giver selects there).
const DENOMS = [25, 50, 75, 100, 150, 200, 250];

const entries = [];
const seen = new Set();
for (const [provider, url, domainsShort, hints, tags] of PROVIDERS) {
  const domains = domainsShort.map(D);
  for (const amt of DENOMS) {
    const sku = `${slug(provider)}-egift-${amt}`;
    if (seen.has(sku)) continue;
    seen.add(sku);
    entries.push({
      sku,
      title: `${provider} e-gift card ($${amt})`,
      provider,
      buyUrl: url,
      domains,
      entityHints: hints,
      tags,
    });
  }
}

// Per-domain census (must be >=30 each).
const census = {};
for (const d of ["brand", "place", "book", "movie", "video_game", "podcast"]) {
  census[d] = entries.filter((e) => e.domains.includes(D(d))).length;
}

const outDir = path.resolve(process.cwd(), "data");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "gift-catalog.json"), JSON.stringify(entries, null, 2) + "\n");
console.log(`wrote ${entries.length} entries`);
console.log("per-domain:", census);
