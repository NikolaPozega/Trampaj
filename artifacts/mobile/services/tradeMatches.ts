import type { Listing } from "@/context/ListingsContext";
import { detectCategoryLocally } from "@/services/openai";
import { queryMatchesFields, stemTokens } from "@/utils/stemHr";

export interface TradeMatch {
  myListing: Listing;
  theirListing: Listing;
  score: number;
  matchType: "both" | "i_want" | "they_want";
}

// Preklapa li se slobodan tekst s listom polja (s HR stemmerjem)
function textMatchesFields(text: string, fields: string[]): boolean {
  return queryMatchesFields(text, fields);
}

// Preklapa li se jedan set tagova s drugim (stem usporedba)
function tagsOverlap(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const aStems = a.flatMap(stemTokens);
  const bStems = b.flatMap(stemTokens);
  return aStems.some((at) => bStems.some((bt) => at.startsWith(bt) || bt.startsWith(at)));
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

      // Ja tražim njih: kategorija, slobodan tekst, ili tagovi (s HR stemmerjem)
      const iWantThem =
        (iWantCat && iWantCat === theirs.category) ||
        textMatchesFields(mine.wantedFor, [theirs.title, theirs.description, ...(theirs.nudimTags ?? [])]) ||
        tagsOverlap(mine.trazimTags ?? [], theirs.nudimTags ?? []);

      // Oni traže mene: kategorija, slobodan tekst, ili tagovi (s HR stemmerjem)
      const theyWantMe =
        (theyWantCat && theyWantCat === myCat) ||
        textMatchesFields(theirs.wantedFor, [mine.title, mine.description, ...(mine.nudimTags ?? [])]) ||
        tagsOverlap(theirs.trazimTags ?? [], mine.nudimTags ?? []);

      if (!iWantThem && !theyWantMe) continue;

      const matchType: TradeMatch["matchType"] =
        iWantThem && theyWantMe ? "both" : iWantThem ? "i_want" : "they_want";

      // Osnova: both=3, jedno=1
      let score = matchType === "both" ? 3 : 1;

      // Bonus za tag poklapanje (preciznije od slobodnog teksta)
      const tagBonus =
        tagsOverlap(mine.trazimTags ?? [], theirs.nudimTags ?? []) ||
        tagsOverlap(theirs.trazimTags ?? [], mine.nudimTags ?? []);
      if (tagBonus) score += 1;

      // Bonus za blizinu cijene
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
