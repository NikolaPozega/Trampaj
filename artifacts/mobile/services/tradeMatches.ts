import type { Listing } from "@/context/ListingsContext";
import { detectCategoryLocally } from "@/services/openai";

export interface TradeMatch {
  myListing: Listing;
  theirListing: Listing;
  score: number;
  matchType: "both" | "i_want" | "they_want";
}

function keywordsOverlap(a: string, b: string): boolean {
  const aWords = a.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const bLower = b.toLowerCase();
  return aWords.some((w) => bLower.includes(w));
}

export function findTradeMatches(
  myListings: Listing[],
  allListings: Listing[]
): TradeMatch[] {
  const myActive = myListings.filter((l) => l.status === "active");
  const theirActive = allListings.filter((l) => !l.isMine && l.status === "active");

  const matches: TradeMatch[] = [];
  const seen = new Set<string>();

  for (const mine of myActive) {
    const iWantCat = detectCategoryLocally(mine.wantedFor);
    const myCat = mine.category;

    for (const theirs of theirActive) {
      const key = `${mine.id}::${theirs.id}`;
      if (seen.has(key)) continue;

      const theyWantCat = detectCategoryLocally(theirs.wantedFor);

      const iWantThem =
        (iWantCat && iWantCat === theirs.category) ||
        keywordsOverlap(mine.wantedFor, theirs.title) ||
        keywordsOverlap(mine.wantedFor, theirs.description);

      const theyWantMe =
        (theyWantCat && theyWantCat === myCat) ||
        keywordsOverlap(theirs.wantedFor, mine.title) ||
        keywordsOverlap(theirs.wantedFor, mine.description);

      if (!iWantThem && !theyWantMe) continue;

      const matchType: TradeMatch["matchType"] =
        iWantThem && theyWantMe ? "both" : iWantThem ? "i_want" : "they_want";

      // Score: both=3, single=1, boosted by price proximity
      let score = matchType === "both" ? 3 : 1;

      if (mine.price != null && theirs.price != null) {
        const diff = Math.abs(mine.price - theirs.price);
        const avg = (mine.price + theirs.price) / 2 || 1;
        const proximity = 1 - Math.min(diff / avg, 1);
        score += proximity * 2;
      }

      seen.add(key);
      matches.push({ myListing: mine, theirListing: theirs, score, matchType });
    }
  }

  // Sort best first, deduplicate their listings (keep highest score per theirListing.id)
  matches.sort((a, b) => b.score - a.score);

  const seenTheirs = new Set<string>();
  const deduped: TradeMatch[] = [];
  for (const m of matches) {
    if (!seenTheirs.has(m.theirListing.id)) {
      seenTheirs.add(m.theirListing.id);
      deduped.push(m);
    }
  }

  return deduped.slice(0, 20);
}
