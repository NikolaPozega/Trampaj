/**
 * Test script: Koliko posto oglasa odmah nađe poklapanje?
 * Simulira bazu od 20 realnih oglasa i pokreće matching algoritam.
 *
 * Pokreni: pnpm --filter @workspace/scripts run test-matches
 */

// ─── TIPOVI ───────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  title: string;
  description: string;
  wantedFor: string;
  category: string;
  price: number | null;
  status: "active";
  isMine: boolean;
  nudimTags: string[];
  trazimTags: string[];
}

interface TradeMatch {
  myListing: Listing;
  theirListing: Listing;
  score: number;
  matchType: "both" | "i_want" | "they_want";
}

// ─── LOKALNA DETEKCIJA (kopija iz openai.ts) ──────────────────────────────────

const LOCAL_KEYWORDS: Record<string, string[]> = {
  Namještaj: ["stolic", "stolac", " stol", "ormar", "krevet", "polica", "sofa", "fotelja", "ladica", "lampa", "komoda", "garnitura", "divan", "klupa", "regal"],
  Elektronika: ["laptop", "iphone", "samsung", "telefon", "mobitel", "tablet", "slušalic", "kamera", "konzola", "punjač", "zvučnik", "monitor", "computer", "računalo", "printer", "ekran", "playstation", "xbox", "airpod"],
  Odjeća: ["jakna", "majica", "hlač", "cipele", "torba", "kaput", "haljina", "tenisic", "džemper", "šešir", "prsluk", "suknja", "košulja", "odijelo", "mantil", "traperice", "traperic", "bluza", "vjetrovka"],
  Knjige: ["knjig", "roman", "udžbenik", "strip", "rječnik", "kuharica", "atlas", "priručnik"],
  Sport: ["bicikl", "lopta", " ski ", "skijaš", "skijanje", "roler", "fitnes", "tenis", "šator", "ruksak", "daska", "jedrilica", "reketa", "kajakaš", "ronilac", "snowboard"],
  Nakit: ["narukvic", "ogrlica", "prsten", "naušnic", "broš", "lančić", "medaljon", "nakit", "dijamant"],
  Igračke: ["lego", "puzzle", "igračk", "kocke", "figuric", "plišan", "barbika"],
};

function detectCategoryLocally(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(LOCAL_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "";
}

// ─── MATCHING ALGORITAM (kopija iz tradeMatches.ts) ───────────────────────────

function keywordsOverlap(a: string, b: string): boolean {
  const aWords = a.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const bLower = b.toLowerCase();
  return aWords.some((w) => bLower.includes(w));
}

function findMatches(mine: Listing, allListings: Listing[]): TradeMatch[] {
  const theirActive = allListings.filter((l) => !l.isMine && l.status === "active");
  const matches: TradeMatch[] = [];
  const iWantCat = detectCategoryLocally(mine.wantedFor);

  for (const theirs of theirActive) {
    const theyWantCat = detectCategoryLocally(theirs.wantedFor);

    const iWantThem =
      (iWantCat && iWantCat === theirs.category) ||
      keywordsOverlap(mine.wantedFor, theirs.title) ||
      keywordsOverlap(mine.wantedFor, theirs.description);

    const theyWantMe =
      (theyWantCat && theyWantCat === mine.category) ||
      keywordsOverlap(theirs.wantedFor, mine.title) ||
      keywordsOverlap(theirs.wantedFor, mine.description);

    if (!iWantThem && !theyWantMe) continue;

    const matchType: TradeMatch["matchType"] =
      iWantThem && theyWantMe ? "both" : iWantThem ? "i_want" : "they_want";

    let score = matchType === "both" ? 3 : 1;
    if (mine.price != null && theirs.price != null) {
      const diff = Math.abs(mine.price - theirs.price);
      const avg = (mine.price + theirs.price) / 2 || 1;
      score += (1 - Math.min(diff / avg, 1)) * 2;
    }

    matches.push({ myListing: mine, theirListing: theirs, score, matchType });
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ─── BAZA OGLASA (20 realnih primjera) ────────────────────────────────────────

function listing(id: string, title: string, desc: string, wantedFor: string, cat: string, price: number | null, isMine = false): Listing {
  return { id, title, description: desc, wantedFor, category: cat, price, status: "active", isMine, nudimTags: [], trazimTags: [] };
}

const DATABASE: Listing[] = [
  // Elektronika
  listing("1",  "iPhone 12 128GB",           "Kao novo, s kutijom, bez ogrebotina",            "Laptop ili tablet",              "Elektronika", 300),
  listing("2",  "Samsung S21",                "Malo korišten, 8GB RAM, 256GB",                  "iPhone ili Pixel",               "Elektronika", 280),
  listing("3",  "MacBook Air M1",             "Odlično stanje, 8GB RAM, 256GB SSD",             "iPad ili monitor",               "Elektronika", 700),
  listing("4",  "iPad Pro 11",                "2022 model, malo korišten, s torbom",             "Laptop ili MacBook",             "Elektronika", 600),
  listing("5",  "Sony slušalice WH-1000XM4",  "Bežične, noise cancelling, crne",                "Zvučnik ili gitara",             "Elektronika", 180),

  // Namještaj
  listing("6",  "Drvena barska stolica",      "Moderna, tapecirana, 2 komada",                  "Stol kuhinjski ili polica",      "Namještaj",   120),
  listing("7",  "IKEA Billy polica",          "Bijela, 200cm, odlično stanje",                  "Komoda ili ormar",               "Namještaj",    60),
  listing("8",  "Trosjed Ikea Ektorp",        "Sivi, 3 sjedišta, malo nošen",                   "Fotelja ili krevet",             "Namještaj",   250),
  listing("9",  "Kuhinjski stol s 4 stolice", "Bijela boja, drvo, odlično stanje",              "Polica ili komoda",              "Namještaj",   200),

  // Sport
  listing("10", "MTB bicikl Trek 29",         "Shimano mjenjač, 21 brzina, malo korišten",      "Roleri ili teniski reket",       "Sport",       350),
  listing("11", "Skijaška oprema komplet",    "Skije 170cm + cipele 43, vezovi Marker",         "Snowboard ili ruksak",           "Sport",       400),
  listing("12", "Fitnes sprava za dom",       "Multifunkcionalna, odlično stanje",              "Bicikl ili roleri",              "Sport",       300),

  // Odjeća
  listing("13", "Nike Air Max 270 br.43",     "Malo nošene, bez oštećenja",                     "Tenisice Adidas ili torba",      "Odjeća",      120),
  listing("14", "Zimska jakna Columbia L",    "Topla, vodonepropusna, crna",                    "Planinski ruksak ili šator",     "Odjeća",      150),
  listing("15", "Kožna torba Zara",           "Smeđa, malo korištena, bez ogrebotina",          "Cipele ili jakna",               "Odjeća",       80),

  // Knjige / Igračke
  listing("16", "Lego Technic 42083",         "Kompletan set, nije sklapano, s kutijom",        "Puzzle ili igračke",             "Igračke",     120),
  listing("17", "Set od 20 knjiga",           "Romani, dobro stanje, različiti autori",         "Udžbenici ili strip",            "Knjige",       50),

  // Ostalo
  listing("18", "Akustična gitara Yamaha",    "Odlično stanje, s kofičem",                      "Električna gitara ili efekti",   "Ostalo",      200),
  listing("19", "DSLR Canon 700D s objektivom","18-55mm objektiv, malo korišten, s torbom",     "Mirrorless ili telefon",         "Elektronika", 350),
  listing("20", "Zlatna ogrlica 14K",         "Dužina 45cm, težina 5g",                         "Narukvica ili prsten",           "Nakit",       300),
];

// ─── TEST ─────────────────────────────────────────────────────────────────────

function pad(s: string, n: number) { return s.slice(0, n).padEnd(n); }
function fmtType(t: string) {
  if (t === "both")     return "🟡 Obostrano";
  if (t === "i_want")   return "🔵 Ja tražim";
  return "🟢 Oni traže";
}

console.log("\n🔍 TRAMPAJ — Test poklapanja oglasa\n");
console.log("Baza: 20 oglasa, svaki oglas traži poklapanje s ostalih 19\n");
console.log("═".repeat(70));

let totalWithMatch = 0;
let totalBoth = 0;

for (const listing of DATABASE) {
  // Postavi isMine=true za ovaj oglas, ostali su tuđi
  const myL = { ...listing, isMine: true };
  const others = DATABASE.filter(l => l.id !== listing.id);

  const matches = findMatches(myL, others);

  const hasBoth    = matches.some(m => m.matchType === "both");
  const hasAny     = matches.length > 0;

  if (hasAny) totalWithMatch++;
  if (hasBoth) totalBoth++;

  const best = matches[0];
  const bestStr = best
    ? `${fmtType(best.matchType)} → "${best.theirListing.title}" (score: ${best.score.toFixed(1)})`
    : "❌  nema poklapanja";

  console.log(`${pad(listing.title, 30)}  ${pad(bestStr, 50)} [${matches.length} match/a]`);
}

console.log("═".repeat(70));
console.log(`\nRezultati:`);
console.log(`  Oglasi s barem jednim poklapanjem: ${totalWithMatch}/20 (${Math.round(totalWithMatch/20*100)}%)`);
console.log(`  Oglasi s OBOSTRANIM poklapanjem:   ${totalBoth}/20 (${Math.round(totalBoth/20*100)}%)`);
console.log(`  Bez ijednog poklapanja:            ${20-totalWithMatch}/20 (${Math.round((20-totalWithMatch)/20*100)}%)\n`);
